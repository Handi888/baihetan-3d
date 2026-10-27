import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {damPoint,makeOpenings,makeDrainOpenings,section} from './math.js';
import {MeshBuilder,mesh,line} from './geometry.js';

/** Round drainage bore cut into the parametric face. The surrounding annulus
 * fills the rectangular grid cell's corners, leaving a true elliptic mouth.
 * The lining and dark recessed end stay separately selectable meshes.
 */
function roundDrain(root,o,materials){
  const rim=new MeshBuilder(),lining=new MeshBuilder(),back=new MeshBuilder();
  const triangle=(builder,a,b,c)=>{
    const ab=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),ac=new THREE.Vector3(...c).sub(new THREE.Vector3(...a));
    if(ab.cross(ac).lengthSq()<1e-16)return;
    const start=builder.positions.length/3;builder.positions.push(...a,...b,...c);builder.uvs.push(0,0,1,0,0,1);builder.indices.push(start,start+1,start+2);
  };
  const yc=(o.y0+o.y1)/2,hu=(o.u1-o.u0)/2,hy=(o.y1-o.y0)/2;
  const depthSide=-1+2.4/section(yc).thickness;
  const point=(angle,rect,side)=>{
    const x=Math.cos(angle),y=Math.sin(angle),scale=rect?1/Math.max(Math.abs(x),Math.abs(y)):1;
    return damPoint(o.u+x*hu*scale,yc+y*hy*scale,side);
  };
  for(let i=0;i<40;i++){
    const a=i*Math.PI/20,b=(i+1)*Math.PI/20;
    // At the four cardinal angles circle and rectangular grid coincide: use
    // nonzero-area triangles instead of creating collapsed annulus quads.
    triangle(rim,point(a,true,-1),point(b,true,-1),point(b,false,-1));
    triangle(rim,point(a,true,-1),point(b,false,-1),point(a,false,-1));
    lining.quad(point(a,false,-1),point(b,false,-1),point(b,false,depthSide),point(a,false,depthSide));
    // Triangle fan, without a degenerate quad at the centre.
    const start=back.positions.length/3;back.positions.push(...damPoint(o.u,yc,depthSide),...point(a,false,depthSide),...point(b,false,depthSide));back.uvs.push(0,0,1,0,0,1);back.indices.push(start,start+1,start+2);
  }
  mesh(rim.geometry(),materials.concrete,root).name='Drain circular face surround';
  mesh(lining.geometry(),materials.darkConcrete,root).name='Independent circular drain lining';
  mesh(back.geometry(),materials.recess,root).name='Recessed drain bore end';
}
export function createDam(materials,{details=true}={}) {
  const group=new THREE.Group();group.name='Double-curvature arch dam';
  const openings=[...makeOpenings(),...makeDrainOpenings()],H=P.dam.height;
  const us=[...new Set([...Array.from({length:P.dam.horizontalSegments+1},(_,i)=>-1+2*i/P.dam.horizontalSegments),...openings.flatMap(o=>[o.u0,o.u1])])].sort((a,b)=>a-b);
  const ys=[...new Set([...Array.from({length:P.dam.verticalSegments+1},(_,i)=>H*i/P.dam.verticalSegments),...openings.flatMap(o=>[o.y0,o.y1])])].sort((a,b)=>a-b);
  const outer=new MeshBuilder();
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<us.length-1;i++){
    const u0=us[i],u1=us[i+1],y0=ys[j],y1=ys[j+1],u=(u0+u1)/2,y=(y0+y1)/2;
    const hole=details&&openings.find(o=>u>o.u0&&u<o.u1&&y>o.y0&&y<o.y1);
    for(const side of [-1,1])if(!hole||(hole.kind==='drain'&&side===1))outer.quad(damPoint(u0,y0,side),damPoint(u1,y0,side),damPoint(u1,y1,side),damPoint(u0,y1,side),side===1);
  }
  for(let i=0;i<us.length-1;i++)for(const y of [0,H])outer.quad(damPoint(us[i],y,1),damPoint(us[i+1],y,1),damPoint(us[i+1],y,-1),damPoint(us[i],y,-1),y===H);
  for(let j=0;j<ys.length-1;j++)for(const u of [-1,1])outer.quad(damPoint(u,ys[j],-1),damPoint(u,ys[j],1),damPoint(u,ys[j+1],1),damPoint(u,ys[j+1],-1),u===1);
  const body=mesh(outer.geometry(),materials.concrete,group);body.name='Layered arch shell';
  if(details)for(const o of openings){
    const inner=new MeshBuilder(),root=new THREE.Group();root.name=`${o.kind} opening ${o.index+1}`;group.add(root);
    if(o.kind==='drain'){roundDrain(root,o,materials);continue;}
    // Each opening has four interior walls between independently curved surfaces.
    const {u0,u1,y0,y1}=o;
    const back=o.kind==='drain'?-1+2.4/section((y0+y1)/2).thickness:1;
    for(const y of [y0,y1])inner.quad(damPoint(u0,y,-1),damPoint(u1,y,-1),damPoint(u1,y,back),damPoint(u0,y,back),y===y1);
    for(const u of [u0,u1])inner.quad(damPoint(u,y0,back),damPoint(u,y0,-1),damPoint(u,y1,-1),damPoint(u,y1,back),u===u1);
    const im=mesh(inner.geometry(),materials.darkConcrete,root);im.material.side=THREE.DoubleSide;im.name='Independent opening lining';
    const gate=new MeshBuilder(); const layer=o.kind==='drain'?back:o.kind==='sealed'?-.92:.60;
    gate.quad(damPoint(u0,y0,layer),damPoint(u1,y0,layer),damPoint(u1,y1,layer),damPoint(u0,y1,layer));
    const g=mesh(gate.geometry(),o.kind==='drain'?materials.recess:o.kind==='sealed'?materials.sealed:materials.gate,root);g.material.side=THREE.DoubleSide;g.name=`${o.kind} ${o.index+1}`;
    if(!['sealed','drain'].includes(o.kind)){
      // Small radial rim projecting from the downstream face; never a black decal.
      const rim=new MeshBuilder(); const border=o.kind==='surface'?.006:.0065;
      for(const u of [u0-border,u1])rim.quad(damPoint(u,y0-2,-1,-2.5),damPoint(u+border,y0-2,-1,-2.5),damPoint(u+border,y1+2,-1,-2.5),damPoint(u,y1+2,-1,-2.5));
      rim.quad(damPoint(u0-border,y0-2,-1,-2.5),damPoint(u1+border,y0-2,-1,-2.5),damPoint(u1+border,y0,-1,-2.5),damPoint(u0-border,y0,-1,-2.5));
      mesh(rim.geometry(),materials.darkConcrete,root).name='Independent outlet rim';
    }
  }
  if(details){
    for(let i=1;i<31;i++){
      const u=-1+2*i/31; const pts=[];
      for(let j=0;j<=90;j++){const y=H*j/90;if(!openings.some(o=>u>o.u0&&u<o.u1&&y>o.y0-1&&y<o.y1+1))pts.push(damPoint(u,y,-1,-.06));else {if(pts.length>1)line(group,pts.splice(0),0x667771,.18);pts.length=0;}}
      if(pts.length>1)line(group,pts,0x667771,.18);
    }
    // Each lift joint is an independent narrow surface strip, interrupted at openings.
    for(const side of [-1,1])for(let y=P.details.castingLift;y<H;y+=P.details.castingLift){
      const strip=new MeshBuilder();
      for(let i=0;i<360;i++){
        const a=-1+i/180,b=a+1/180,u=(a+b)/2;
        if(openings.some(o=>u>o.u0&&u<o.u1&&y>o.y0-.15&&y<o.y1+.15))continue;
        strip.quad(damPoint(a,y,side,side*.025),damPoint(b,y,side,side*.025),damPoint(b,y+.038,side,side*.025),damPoint(a,y+.038,side,side*.025),side===1);
      }
      mesh(strip.geometry(),materials.joint,group).name='Concrete casting lift joint';
    }
  }
  group.userData={openings:makeOpenings(),drains:makeDrainOpenings().length};return group;
}
