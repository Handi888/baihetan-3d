import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {box,mesh} from './geometry.js';
import {member,cable} from './detail-geometry.js';
import {groundHeight} from './ground-surface.js';
export function createPowerlines(m){
  const g=new THREE.Group();g.name='Lattice transmission towers and sagging conductors';const attachments=[];
  for(const spec of P.details.towers){
    const root=new THREE.Group();root.name='Independent lattice electricity pylon';const baseY=Math.max(...[-10,10].flatMap(dx=>[-10,10].map(dz=>groundHeight(spec.x+dx,spec.z+dz))))+1;root.position.set(spec.x,baseY,spec.z);g.add(root);
    const H=spec.height,levels=[0,14,29,H-18,H-5,H],widths=[10,7.2,4.2,2.8,2.2,.4];
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const footingBottom=groundHeight(spec.x-sz*10,spec.z+sx*10)-baseY-1;
      box(root,m.concrete,[5,1-footingBottom,5],[sx*10,(footingBottom+1)/2,sz*10]).name='Pylon concrete footing';
      for(let i=0;i<levels.length-1;i++){
        member(root,m.rail,[sx*widths[i],levels[i],sz*widths[i]],[sx*widths[i+1],levels[i+1],sz*widths[i+1]],.30,.30,'Pylon main leg');
        member(root,m.rail,[sx*widths[i],levels[i],sz*widths[i]],[-sx*widths[i+1],levels[i+1],sz*widths[i+1]],.15,.15,'Lattice diagonal');
        member(root,m.rail,[sx*widths[i],levels[i],sz*widths[i]],[sx*widths[i+1],levels[i+1],-sz*widths[i+1]],.15,.15,'Lattice diagonal');
        member(root,m.rail,[sx*widths[i],levels[i],sz*widths[i]],[-sx*widths[i],levels[i],sz*widths[i]],.19,.19,'Lattice horizontal');
      }
    }
    const local=[];
    for(let row=0;row<3;row++)for(const side of [-1,1]){
      const y=H-9-row*10,x=side*(row===1?15:12);
      for(const z of [-2,2]){
        member(root,m.rail,[0,y,z],[x,y-.8,z],.35,.35,'Crossarm chord');
        member(root,m.rail,[0,y-5,z],[x,y-.8,z],.2,.2,'Crossarm brace');
        member(root,m.rail,[x/2,y-2.5,z],[x/2,y-.3,z],.15,.15,'Crossarm vertical');
      }
      // Conductor attachment along local Z gives a transverse span across the valley.
      for(let k=0;k<9;k++){const disc=mesh(new THREE.CylinderGeometry(.36,.36,.19,16),m.insulator,root);disc.position.set(x,y-1.1-k*.3,0);disc.name='Insulator disc';}
      local.push([x,y-4,0]);
    }
    attachments.push({spec,root,local});
  }
  for(const [a,b] of [[attachments[0],attachments[1]],[attachments[2],attachments[3]]]){
    for(let j=0;j<a.local.length;j++){
      const aa=a.local[j],bb=b.local[j],start=[a.spec.x,a.root.position.y+aa[1],a.spec.z+aa[0]],end=[b.spec.x,b.root.position.y+bb[1],b.spec.z+bb[0]];
      // Crossarms aligned along valley Z, wires run across X.
      // Four individual sub-conductors per phase, with independent spacer frames.
      // Normalized catenary has zero displacement at both tower attachment points.
      const sample=(t,dy=0,dz=0)=>{
        const sag=31*(Math.cosh(.7)-Math.cosh((t-.5)*1.4))/(Math.cosh(.7)-1);
        return [start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t-sag+dy,start[2]+(end[2]-start[2])*t+dz];
      };
      for(const dy of [-.25,.25])for(const dz of [-.25,.25]){
        cable(g,m.cable,Array.from({length:65},(_,k)=>sample(k/64,dy,dz)),.055).name='Independent bundled transmission conductor';
      }
      for(let k=1;k<12;k++){
        const p=sample(k/12);
        for(const dy of [-.25,.25])member(g,m.rail,[p[0],p[1]+dy,p[2]-.25],[p[0],p[1]+dy,p[2]+.25],.04,.04,'Conductor bundle spacer');
        for(const dz of [-.25,.25])member(g,m.rail,[p[0],p[1]-.25,p[2]+dz],[p[0],p[1]+.25,p[2]+dz],.04,.04,'Conductor bundle spacer');
      }
    }
    // Rotate tower steel so its attachments agree with the wire coordinates above.
    a.root.rotation.y=b.root.rotation.y=-Math.PI/2;
  }
  g.userData={towers:P.details.towers.length,phaseBundles:12,conductors:48};return g;
}
