import * as THREE from 'three';
import {groundHeight,groundShoreline} from './ground-surface.js';
import {foliageGeometry,sprigTexture,grassGeometry} from './reservoir/vegetation.js';
import {rng,noise} from './reservoir/landscape.js';

/** 视频中的植被覆山位于工程开挖区外。树根贴合同一三角网格，避开所有
 * 432 m 以下支护、山间公路及平台；原有墙层、道路和水面完全保留。 */
export function createCanyonForest(){
  const group=new THREE.Group();group.name='Canyon natural ridge forest';
  const random=rng(20261027),cells=new Map(),palette=[0x426339,0x3d5d35,0x577044,0x335633,0x637a4c];
  const roads=[];for(const side of [-1,1])for(let i=0;i<=280;i++){const t=i/280,z=80-570*Math.cos(t*Math.PI*3),y=343+t*170;roads.push([groundShoreline(z,y,side),z]);}
  for(let i=0;i<13000;i++){
    const side=i%2?-1:1,z=-1600+random()*3600,edge=groundShoreline(z,438,side),x=edge+side*(28+random()*650),y=groundHeight(x,z);
    if(y<460||noise(x*.009,z*.009)<.35||random()>.8)continue;
    // 保留岩脊、沟槽与不规则林窗，避免匀距的人工林效果。
    const slope=Math.hypot(groundHeight(x+3,z)-groundHeight(x-3,z),groundHeight(x,z+3)-groundHeight(x,z-3))/6;
    if(slope>2.5||roads.some(p=>Math.abs(z-p[1])<12&&Math.hypot(x-p[0],z-p[1])<11))continue;
    const cell=Math.floor(x/440)+','+Math.floor(z/440);if(!cells.has(cell))cells.set(cell,[]);
    cells.get(cell).push({x,y:y-.2,z,scale:.7+random()*1.1,stretch:.75+random()*.5,angle:random()*Math.PI*2,color:palette[Math.floor(random()*palette.length)]});
  }
  const crown=foliageGeometry(733,10,4.5,74,2.2),trunk=new THREE.CylinderGeometry(.07,.23,7,6,1);
  trunk.translate(0,3.5,0);
  const leaf=new THREE.MeshStandardMaterial({map:sprigTexture(),color:0xffffff,alphaTest:.38,alphaToCoverage:true,side:THREE.DoubleSide,roughness:.96});
  const bark=new THREE.MeshStandardMaterial({color:0x4f4a35,roughness:1});const dummy=new THREE.Object3D();let count=0;
  for(const entries of cells.values()){
    count+=entries.length;
    for(const [geo,mat,foliage] of [[crown,leaf,true],[trunk,bark,false]]){
      const inst=new THREE.InstancedMesh(geo,mat,entries.length);inst.name=foliage?'Irregular broadleaf ridge canopy':'Ridge tree trunks';
      entries.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.scale,p.scale*p.stretch,p.scale);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);if(foliage)inst.setColorAt(i,new THREE.Color(p.color));});
      inst.computeBoundingSphere();inst.receiveShadow=true;group.add(inst);
    }
  }
  // 林缘补齐灌、草和小片野花。共用原型与空间分块，不创建逐株独立材质。
  const under=new Map(),flowers=[];
  for(let i=0;i<5200;i++){
    const side=i%2?-1:1,z=-1150+random()*2700,x=groundShoreline(z,452,side)+side*(12+random()*420),y=groundHeight(x,z);
    const slope=Math.hypot(groundHeight(x+2,z)-groundHeight(x-2,z),groundHeight(x,z+2)-groundHeight(x,z-2))/4;
    if(y<455||slope>1.65||noise(x*.017,z*.017)<.4||roads.some(p=>Math.hypot(x-p[0],z-p[1])<8))continue;
    const key=Math.floor(x/220)+','+Math.floor(z/220);if(!under.has(key))under.set(key,[]);
    const p={x,y:y-.08,z,scale:.6+random()*1.3,angle:random()*6.28};under.get(key).push(p);if(i%4===0)flowers.push(p);
  }
  const shrub=foliageGeometry(845,1.9,1.4,24),grass=grassGeometry(),grassMat=new THREE.MeshStandardMaterial({color:0x788848,roughness:1,side:THREE.DoubleSide});let shrubs=0,grasses=0;
  for(const entries of under.values())for(const [g,mat,kind] of [[shrub,leaf,'灌木'],[grass,grassMat,'草丛']]){
    const points=entries.filter((_,i)=>kind==='灌木'?i%3===0:i%3!==0);if(!points.length)continue;
    const inst=new THREE.InstancedMesh(g,mat,points.length);inst.name='林缘'+kind;
    points.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);if(kind==='灌木')inst.setColorAt(i,new THREE.Color(palette[i%palette.length]));});
    inst.computeBoundingSphere();group.add(inst);if(kind==='灌木')shrubs+=points.length;else grasses+=points.length;
  }
  const petals=new THREE.CircleGeometry(.19,6);petals.rotateX(-Math.PI/2);petals.translate(0,.65,0);
  const blooms=new THREE.InstancedMesh(petals,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,side:THREE.DoubleSide}),flowers.length*5);blooms.name='林缘零散野花';
  flowers.forEach((p,i)=>{for(let j=0;j<5;j++){dummy.position.set(p.x+Math.cos(j*2.4)*.55,p.y,p.z+Math.sin(j*2.4)*.55);dummy.rotation.set(.2,0,.15);dummy.scale.setScalar(p.scale);dummy.updateMatrix();blooms.setMatrixAt(i*5+j,dummy.matrix);blooms.setColorAt(i*5+j,new THREE.Color([0xe5dba2,0xe9e6d8,0xc89caf][i%3]));}});blooms.computeBoundingSphere();group.add(blooms);
  group.userData={trees:count,shrubs,grasses,flowers:flowers.length*5,cells:cells.size,placement:'seeded clusters on natural ridges; engineered benches excluded'};return group;
}
