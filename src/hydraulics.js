import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {damPoint,makeOpenings,section} from './math.js';
import {groundHeight,groundShoreline} from './ground-surface.js';
import {mesh,box,ribbon,MeshBuilder} from './geometry.js';
import {member,hollowCylinder,tunnelMouth,railPath} from './detail-geometry.js';
import {createGantry} from './gantry.js';
import {smallBuilding} from './crest.js';
import {portalSpecs} from './portals.js';
export function createHydraulics(m){
  const g=new THREE.Group();g.name='Intakes, hollow shafts, outlet basin and permanent operation plazas';const H=P.dam.height;
  for(const spec of P.details.intakes){
    const {side,z,length}=spec,root=new THREE.Group();root.name=`${side} bank intake gallery`;g.add(root);
    const level=P.water.upstream+24,front=[],back=[];
    for(let i=0;i<=48;i++){const zz=z-length/2+length*i/48,x=groundShoreline(zz,P.water.upstream,side)-side*10;front.push([x-side*12,level,zz]);back.push([x+side*9,level,zz]);}
    ribbon(root,front,5.5,m.concrete).name='Intake front operation deck';ribbon(root,back,5,m.concrete).name='Intake rear deck';
    for(let i=0;i<=8;i++){
      const zz=z-length/2+length*i/8,x=groundShoreline(zz,P.water.upstream,side)-side*10;
      box(root,m.concrete,[27,34,3.5],[x,level-17,zz]).name='Intake gate pier';box(root,m.concrete,[28,2,4.3],[x,level-1,zz]).name='Intake transverse deck';
      if(i<8){
        const mid=zz+length/16,edge=groundShoreline(mid,P.water.upstream,side)-side*23;
        box(root,m.recess,[.5,27,length/8-4],[edge+side*2,level-16,mid]).name='Recessed intake opening';
        for(let j=0;j<10;j++){const dz=-(length/8-5)/2+(length/8-5)*j/9;member(root,m.rail,[edge,level-30,mid+dz],[edge,level-3,mid+dz],.18,.18,'Separate intake trash-rack bar');}
        for(const y of [level-25,level-15,level-5])box(root,m.rail,[.4,.3,length/8-4],[edge-side*.1,y,mid]).name='Rack transverse member';
      }
    }
    railPath(root,m.rail,front.filter((_,i)=>i%4===0));
    for(const strip of [front,back])ribbon(root,strip.map(p=>[p[0],p[1]+.12,p[2]]),.25,m.rail).name='Bank gantry rail';
    // Both ends of the bank galleries carry a red travelling hoist in the references.
    for(const offset of [-.34,.34]){const zz=z+length*offset,x=groundShoreline(zz,P.water.upstream,side)-side*11.5;createGantry(root,m,[x,level,zz],Math.PI/2,.62,{depth:34});}
  }
  for(const p of P.details.platforms){
    box(g,m.concrete,[p.width,4,p.length],[p.x,p.y-2,p.z]).name='Permanent concrete construction / maintenance plaza';
    for(let i=0;i<3;i++){
      const z=p.z-30+i*30,side=Math.sign(p.x),root=new THREE.Group();root.position.set(p.x-side*12,p.y,z);g.add(root);root.name='Open auxiliary gate base';
      for(const x of [-7,7])box(root,m.concrete,[1.5,3,15],[x,1.5,0]);for(const zz of [-7,7])box(root,m.concrete,[15,3,1.5],[0,1.5,zz]);box(root,m.gate,[12,.5,12],[0,.2,0]);
    }
    smallBuilding(g,m,[p.x+Math.sign(p.x)*25,p.y,p.z+p.length*.26],[21,7,14],'Platform control room');
    // Perimeter barriers are individual precast units.
    for(let z=p.z-p.length/2+5;z<p.z+p.length/2;z+=9)box(g,m.concrete,[.6,1.1,5],[p.x-Math.sign(p.x)*(p.width/2-1),p.y+.55,z]).name='Platform edge barrier';
  }
  const s=P.details.shafts,sx=s.x,sy=s.level,foundationBottom=Math.min(...[-18,18].flatMap(dx=>[-17,17].map(dz=>groundHeight(sx+dx,s.z+dz))))-1;
  box(g,m.darkConcrete,[37,sy-foundationBottom,35],[sx,(sy+foundationBottom)/2,s.z]).name='Circular shaft support terrace';
  for(let i=0;i<s.count;i++){
    const x=sx+(i%3-1)*11.7,z=s.z+(Math.floor(i/3)-.5)*12.5;
    hollowCylinder(g,m.concrete,s.radius,.75,s.height,[x,sy,z]);
    const lining=hollowCylinder(g,m.rusty,s.radius-.76,.12,s.height-.45,[x,sy,z]);lining.name='Visible inner lining of circular structure';
    const floor=mesh(new THREE.CircleGeometry(s.radius-.9,64),m.recess,g);floor.rotation.x=-Math.PI/2;floor.position.set(x,sy+.1,z);
    for(let k=0;k<12;k++){const a=k*Math.PI/6;box(g,m.concrete,[.48,s.height,.48],[x+Math.cos(a)*(s.radius+.05),sy+s.height/2,z+Math.sin(a)*(s.radius+.05)],-a).name='Circular shaft exterior rib';}
  }
  for(const o of makeOpenings().filter(o=>o.kind==='deep')){
    const b=new MeshBuilder(),a=damPoint(o.u0-.004,o.y0-2,-1,-1),c=damPoint(o.u1+.004,o.y0-2,-1,-1),ae=[a[0]*.985,a[1]-8,a[2]+17],ce=[c[0]*.985,c[1]-8,c[2]+17];
    b.quad(a,ae,ce,c);b.quad([a[0]-1,a[1]+6,a[2]],a,ae,[ae[0]-1,ae[1]+3,ae[2]]);b.quad(c,[c[0]+1,c[1]+6,c[2]],[ce[0]+1,ce[1]+3,ce[2]],ce);
    mesh(b.geometry(),m.darkConcrete,g).name='Independent deep-outlet deflector';
  }
  // Baihetan plunge / water-cushion basin, downstream sill and retaining walls.
  const basinBottom=new MeshBuilder();
  for(let z=0;z<436;z+=4){const a=groundShoreline(z,21,-1),b=groundShoreline(z,21,1),c=groundShoreline(z+4,21,-1),d=groundShoreline(z+4,21,1);basinBottom.quad([a,4,z],[c,4,z+4],[d,4,z+4],[b,4,z]);}
  mesh(basinBottom.geometry(),m.darkConcrete,g).name='Submerged water-cushion basin floor';
  for(const side of [-1,1]){
    const path=[],wall=new MeshBuilder();
    for(let z=5;z<=525;z+=5)path.push([groundShoreline(z,31,side)-side*1.5,31,z]);
    ribbon(g,path,7,m.concrete).name='Basin maintenance walkway';
    for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1];wall.quad([a[0],3,a[2]],[b[0],3,b[2]],[b[0],40,b[2]],[a[0],40,a[2]],side<0);}
    mesh(wall.geometry(),m.concrete,g).name='Continuous basin retaining wall';
    railPath(g,m.rail,path.filter((_,i)=>i%5===0));
    tunnelMouth(g,m,portalSpecs().find(s=>s.side===side&&s.name==='Bank diversion-tunnel outlet'));
    // Varying-depth solid buttress ribs run down the excavated face, separate per rib.
    if(side===1)for(let z=50;z<=485;z+=43){
      const b=new MeshBuilder();for(let y=40;y<333;y+=4){const p=(h,dz,inset)=>[groundShoreline(z+dz,h,side)-inset,h,z+dz];
        b.quad(p(y,-1.8,3),p(y,1.8,3),p(y+4,1.8,3),p(y+4,-1.8,3));b.quad(p(y,-1.8,3),p(y,-1.8,-1),p(y+4,-1.8,-1),p(y+4,-1.8,3));b.quad(p(y,1.8,-1),p(y,1.8,3),p(y+4,1.8,3),p(y+4,1.8,-1));}
      mesh(b.geometry(),m.darkConcrete,g).name='Individual downstream buttress rib';
    }
    const bx=side*(section(H).halfWidth+48),bz=12,by=groundHeight(bx,bz)+1;
    box(g,m.darkConcrete,[52,7,33],[bx,by-3.5,bz]);smallBuilding(g,m,[bx,by,bz],[44,12,25],'Bank management building');
  }
  const z=435,left=groundShoreline(z,25,-1),right=groundShoreline(z,25,1);
  box(g,m.concrete,[right-left+4,11,9],[(left+right)/2,22,z]).name='Downstream secondary sill';box(g,m.darkConcrete,[right-left+6,.55,7],[(left+right)/2,27.8,z]).name='Secondary sill crest';
  g.userData={intakes:2,circularShafts:s.count,platforms:2,diversionOutlets:2};return g;
}
