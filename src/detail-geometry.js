import * as THREE from 'three';
import {mesh,box,MeshBuilder} from './geometry.js';
// These helpers create a new Mesh per member. Sharing a geometry is not mesh merging.
const unitBox=new THREE.BoxGeometry(1,1,1),up=new THREE.Vector3(0,1,0);
export function member(parent,material,a,b,width=.3,depth=width,name='Steel member'){
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);
  const m=mesh(unitBox,material,parent);m.position.copy(va).add(vb).multiplyScalar(.5);m.scale.set(width,delta.length(),depth);m.quaternion.setFromUnitVectors(up,delta.normalize());m.name=name;return m;
}
export function pipe(parent,material,a,b,radius=.15,segments=12,name='Pipe'){
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);
  const m=mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),segments),material,parent);m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(up,delta.normalize());m.name=name;return m;
}
export function cable(parent,material,points,radius=.11){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const m=mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*3),radius,6,false),material,parent);m.name='Independent overhead conductor';return m;
}
export function hollowCylinder(parent,material,radius,wall,height,position){
  // Explicit annular topology avoids the duplicate 0 / 2π contour edge emitted
  // by full-circle Shape extrusion. All four surfaces remain; no faces are decimated.
  const ring=new MeshBuilder(),segments=192;
  const point=(i,r,y)=>{const a=(i%segments)*Math.PI*2/segments;return [Math.cos(a)*r,y,Math.sin(a)*r];};
  for(let i=0;i<segments;i++){
    const ob=point(i,radius,0),oe=point(i+1,radius,0),ot=point(i,radius,height),on=point(i+1,radius,height);
    const ib=point(i,radius-wall,0),ie=point(i+1,radius-wall,0),it=point(i,radius-wall,height),inn=point(i+1,radius-wall,height);
    ring.quad(ob,ot,on,oe);ring.quad(ib,ie,inn,it);
    ring.quad(ot,it,inn,on);ring.quad(ob,oe,ie,ib);
  }
  const m=mesh(ring.geometry(),material,parent);m.position.set(...position);m.name='Open annular concrete shaft';return m;
}
export function railPath(parent,m,points,height=1.15){
  for(let i=0;i<points.length;i++){const p=points[i];member(parent,m,[p[0],p[1],p[2]],[p[0],p[1]+height,p[2]],.09,.09,'Handrail post');}
  for(const h of [.55,height])for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];member(parent,m,[a[0],a[1]+h,a[2]],[b[0],b[1]+h,b[2]],.07,.07,'Handrail beam');}
}
export function tunnelMouth(parent,m,{position,rotation,width=8,height=10,depth=6,name='Drainage gallery mouth'}){
  const root=new THREE.Group();root.name=name;root.position.set(...position);root.rotation.y=rotation;parent.add(root);
  const r=width/2,spring=height-r,shape=new THREE.Shape();
  shape.moveTo(-r-1.2,0);shape.lineTo(r+1.2,0);shape.lineTo(r+1.2,spring);shape.absarc(0,spring,r+1.2,0,Math.PI,false);shape.lineTo(-r-1.2,0);
  const hole=new THREE.Path();hole.moveTo(-r,.08);hole.lineTo(-r,spring);hole.absarc(0,spring,r,Math.PI,0,true);hole.lineTo(r,.08);hole.closePath();shape.holes.push(hole);
  const shell=mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:40}),m.darkConcrete,root);shell.position.z=-depth+.6;
  // A deep recess with closed rear: only the visible mouth is constrained by the photographs.
  const dark=new THREE.Shape();dark.moveTo(-r,0);dark.lineTo(r,0);dark.lineTo(r,spring);dark.absarc(0,spring,r,0,Math.PI,false);dark.lineTo(-r,0);
  const back=mesh(new THREE.ShapeGeometry(dark,40),m.recess,root);back.position.z=-depth+.05;back.name='Unsurveyed gallery rear closure';
  box(root,m.concrete,[width+3,.7,depth+2],[0,-.3,-depth/2+1]);return root;
}
