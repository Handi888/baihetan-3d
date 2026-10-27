import * as THREE from 'three';
import {mesh,MeshBuilder,box} from './geometry.js';
import {member,hollowCylinder,railPath} from './detail-geometry.js';
import {retainingWallSpecs} from './bank-layout.js';
import {wallSurface,wallFrontX,bankEnvelopeX} from './bank-surface.js';
import {groundHeight,groundShoreline} from './ground-surface.js';
import {portalSpecs,portalProfile,subtractPortal} from './portals.js';
import {PARAMS as P} from './config.js';

/** 构造真实厚壁；每个浇筑段为独立 Mesh，不对挡墙做 merge / LOD。
 * 混凝土与天然岩坡使用不同材质。圆形洞口从前后墙皮及岩坡实际扣除，
 * 再加入独立环形衬砌，不能用黑圆贴片替代孔洞。
 */
function triangle(builder,a,b,c,holes){
  let polygons=[[a,b,c]];
  for(const h of holes){
    const zmin=Math.min(a[2],b[2],c[2]),zmax=Math.max(a[2],b[2],c[2]);
    const ymin=Math.min(a[1],b[1],c[1]),ymax=Math.max(a[1],b[1],c[1]);
    if(zmax<h.position[2]-h.width/2||zmin>h.position[2]+h.width/2||ymax<h.position[1]||ymin>h.position[1]+h.height)continue;
    polygons=polygons.flatMap(p=>subtractPortal(p,h.profile));
  }
  for(const poly of polygons)for(let i=1;i<poly.length-1;i++){
    // Check after Float32 conversion: discard only zero-area numerical remnants,
    // never valid boundary triangles or small independent structural members.
    const p=[poly[0],poly[i],poly[i+1]].map(v=>v.map(Math.fround));
    const u=new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0]));
    const v=new THREE.Vector3(...p[2]).sub(new THREE.Vector3(...p[0]));
    const n=u.cross(v);if(n.lengthSq()<1e-18)continue;
    const start=builder.positions.length/3;
    for(const q of p){builder.positions.push(...q);builder.uvs.push(builder.formCoordinate?builder.formCoordinate(q[2]):q[2],Math.abs(n.y)>Math.abs(n.x)*2?q[0]:q[1]);}
    builder.indices.push(start,start+1,start+2);
  }
}
function quad(builder,a,b,c,d,holes=[],reverse=false){
  if(reverse){triangle(builder,a,c,b,holes);triangle(builder,a,d,c,holes);}
  else{triangle(builder,a,b,c,holes);triangle(builder,a,c,d,holes);}
}
function roundGallery(parent,m,spec){
  const root=new THREE.Group();root.name=spec.name;root.userData={wallId:spec.wallId,radius:spec.width/2};
  root.position.set(spec.position[0]-spec.side*.8,spec.position[1]+spec.height/2,spec.position[2]);
  root.rotation.y=spec.rotation;parent.add(root);const r=spec.width/2;
  const collar=hollowCylinder(root,m.retaining,r+.42,.42,2.1,[0,0,.12]);collar.rotation.x=-Math.PI/2;collar.name='Independent circular wall portal collar';
  const tube=hollowCylinder(root,m.darkConcrete,r,.22,spec.depth,[0,0,0]);tube.rotation.x=-Math.PI/2;tube.name='Independent round drainage tunnel lining';
  const back=mesh(new THREE.CircleGeometry(r-.22,64),m.recess,root);back.position.z=-spec.depth+.02;back.name='Drainage tunnel recessed rear';
  return root;
}

export function createRetainingWalls(m){
  const group=new THREE.Group();group.name='Photo-referenced folded retaining walls';
  const openings=portalSpecs().map(s=>({...s,profile:portalProfile(s)}));
  let bayCount=0,deckCount=0,jointCount=0;
  for(const spec of retainingWallSpecs()){
    const root=new THREE.Group();root.name=`Independent curved retaining course ${spec.id}`;root.userData={...spec};group.add(root);
    const s=wallSurface(spec),holes=openings.filter(h=>h.side===spec.side&&h.position[2]+h.width/2>spec.z0&&h.position[2]-h.width/2<spec.z1&&h.position[1]<spec.top&&h.position[1]+h.height>spec.bottom),side=spec.side;
    const point=(i,j,back=false)=>[(back?s.backRows:s.rows)[j][i],s.ys[j],s.zs[i]];
    // A construction bay is at most 24 m long; its full 2–4 m contour sampling
    // and 2 m vertical rings are preserved inside its own closed shell.
    for(let first=0;first<s.zs.length-1;){
      let last=first+1;while(last<s.zs.length-1&&s.zs[last+1]-s.zs[first]<=24)last++;
      const body=new MeshBuilder();
      body.formCoordinate=z=>{let i=0;while(i<s.zs.length-2&&s.zs[i+1]<z)i++;return s.lengths[i]+(s.lengths[i+1]-s.lengths[i])*(z-s.zs[i])/(s.zs[i+1]-s.zs[i]);};
      for(let i=first;i<last;i++){
        for(let j=0;j<s.ys.length-1;j++){
          quad(body,point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1),holes,side<0);
          quad(body,point(i,j,true),point(i+1,j,true),point(i+1,j+1,true),point(i,j+1,true),holes,side>0);
        }
        const top=s.ys.length-1;
        quad(body,point(i,top),point(i,top,true),point(i+1,top,true),point(i+1,top),[],side>0);
        quad(body,point(i,0),point(i+1,0),point(i+1,0,true),point(i,0,true),[],side>0);
      }
      for(const i of [first,last])for(let j=0;j<s.ys.length-1;j++){
        quad(body,point(i,j),point(i,j,true),point(i,j+1,true),point(i,j+1),holes,(i===first)===(side>0));
      }
      const wall=mesh(body.geometry(),m.retaining,root);wall.name='Separate curved concrete retaining-wall bay';wall.userData={wallId:spec.id,z0:s.zs[first],z1:s.zs[last]};bayCount++;

      // Solid contour-following maintenance berm, with a thicker outer coping.
      const deck=new MeshBuilder(),coping=new MeshBuilder();
      const edge=(i,outer,dy=0)=>{
        const front=s.rows.at(-1)[i];
        // 最小 3.4 m 马道净宽；后缘伸入岩体，避免转角露缝。
        const rear=side*Math.max(side*groundShoreline(s.zs[i],spec.top+.18,side)+1.2,side*front+3.4);
        return [outer?front-side*.3:rear,spec.top+.28+dy,s.zs[i]];
      };
      for(let i=first;i<last;i++){
        quad(deck,edge(i,true),edge(i+1,true),edge(i+1,false),edge(i,false),[],side<0);
        quad(deck,edge(i,true,-.65),edge(i,false,-.65),edge(i+1,false,-.65),edge(i+1,true,-.65),[],side<0);
        for(const outer of [true,false])quad(deck,edge(i,outer,-.65),edge(i+1,outer,-.65),edge(i+1,outer),edge(i,outer),[],outer===(side>0));
        const a=edge(i,true),b=edge(i+1,true),c=a.map((v,k)=>k===0?v+side*.55:v),d=b.map((v,k)=>k===0?v+side*.55:v);
        quad(coping,a,b,d,c,[],side<0);
      }
      for(const i of [first,last])quad(deck,edge(i,true,-.65),edge(i,true),edge(i,false),edge(i,false,-.65),[],(i===first)===(side>0));
      mesh(deck.geometry(),m.concrete,root).name='Independent curved maintenance berm slab';deckCount++;
      mesh(coping.geometry(),m.white,root).name='Independent retaining-wall coping';

      // A narrow dark grout joint at each bay boundary. The complete wall behind
      // it is retained; this is a recessed-colour strip, not an empty cut.
      if(first>0){
        const seam=new MeshBuilder(),z=s.zs[first];
        for(let j=0;j<s.ys.length-1;j++){
          const q=(zz,y)=>[wallFrontX(spec,zz,y)-side*.018,y,zz];
          quad(seam,q(z-.035,s.ys[j]),q(z+.035,s.ys[j]),q(z+.035,s.ys[j+1]),q(z-.035,s.ys[j+1]),holes);
        }
        mesh(seam.geometry(),m.joint,root).name='Separate retaining construction expansion joint';jointCount++;
      }
      first=last;
    }
    // Sparse masonry curb blocks match the photos; there is no metallic fence
    // draped across every cliff face. Rails are confined to accessible paths.
    if(spec.layer%3===0){
      for(let z=spec.z0+8;z<spec.z1-4;z+=18){
        const x=wallFrontX(spec,z,spec.top)-side*.12;
        const angle=Math.atan2(wallFrontX(spec,z+1,spec.top)-wallFrontX(spec,z-1,spec.top),2);
        box(root,m.concrete,[.5,.8,3.2],[x,spec.top+.68,z],angle).name='Independent contour walkway curb';
      }
    }
  }
  for(const spec of openings.filter(s=>s.shape==='circle'))roundGallery(group,m,spec);
  group.userData={courses:retainingWallSpecs().length,wallBays:bayCount,bermSlabs:deckCount,expansionJoints:jointCount,circularPortals:openings.filter(s=>s.shape==='circle').length};
  return group;
}

/** Grounded rock blocks at the wet/dry margin. The underlying continuous bank
 * is retained, so no shoreline triangle is removed to make room for decoration.
 */
export function createShoreRocks(m){
  const group=new THREE.Group();group.name='Weathered shoreline rock ledges';let count=0;
  const hash=i=>{const f=Math.sin(i*127.1+37.9)*43758.5453;return f-Math.floor(f);};
  for(const side of [-1,1])for(const range of [{a:430,b:1100,level:P.water.downstream},{a:-860,b:-550,level:P.water.upstream}]){
    for(let z=range.a;z<range.b;z+=14){
      // 岩滩放在可见墙脚的水侧，不留在新墙背后被遮没。底部落到
      // 共享地形，顶部露出水面；实体深度遮挡自然形成水/岩交线。
      const sampleZ=z+(hash(z+side*61)-.5)*11;
      const size=1.2+Math.pow(hash(z+side),2)*4.8,x=bankEnvelopeX(sampleZ,range.level,side)-side*(.4+hash(z)*3.2);
      const g=new THREE.DodecahedronGeometry(size,1),pos=g.attributes.position;
      for(let i=0;i<pos.count;i++){
        const a=pos.getX(i),b=pos.getY(i),c=pos.getZ(i),f=.86+hash(a*7+b*11+c*13)*.28;
        pos.setXYZ(i,a*f*1.1,b*f*.7,c*f*1.65);
      }
      g.computeBoundingBox();const low=g.boundingBox.min.y,rangeY=g.boundingBox.max.y-low,base=groundHeight(x,sampleZ)-.4;
      const height=Math.max(size,range.level+1.2+hash(z+37)*1.5-base);
      for(let i=0;i<pos.count;i++)pos.setY(i,(pos.getY(i)-low)*height/rangeY);
      g.computeVertexNormals();g.computeBoundingSphere();const rock=mesh(g,m.rock,group);rock.position.set(x,base,sampleZ);rock.rotation.y=hash(z)*6.28;rock.name='Independent waterline fractured rock';count++;
    }
  }
  group.userData={rocks:count};return group;
}
