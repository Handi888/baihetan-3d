import * as THREE from 'three';
import {heightAt,surfaceNormal,southShore,northShore,pathZ,DECK,noise,rng} from './landscape.js';

// 以枝叶簇为原型，而不是圆球树冠。每个原型有真实树干/分枝和多方向叶片。
// 同种植被复用完整原型的 InstancedMesh；无 LOD，也不按画质减株数。
const wind={value:0};
function sprigTexture(){
  if(typeof document==='undefined'){const t=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);t.needsUpdate=true;return t;}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
  const random=rng(8729);c.lineCap='round';
  for(let b=0;b<4;b++){
    const ox=240+(b-1.5)*36,oy=490,ex=95+b*105,ey=30+random()*95;
    c.strokeStyle='#92977b';c.lineWidth=3;c.beginPath();c.moveTo(ox,oy);c.quadraticCurveTo(ox,200,ex,ey);c.stroke();
    for(let i=1;i<=8;i++)for(const sign of [-1,1]){
      const t=i/9,x=ox+(ex-ox)*t,y=oy+(ey-oy)*t;
      c.save();c.translate(x+sign*19,y);c.rotate(sign*.85+(ex-ox)/600);
      const len=22+random()*20;c.fillStyle=`rgb(${150+random()*70},${165+random()*70},${115+random()*60})`;
      c.beginPath();c.ellipse(sign*len*.38,0,len,9+random()*7,0,0,Math.PI*2);c.fill();
      c.strokeStyle='rgba(224,232,185,.5)';c.lineWidth=.9;c.beginPath();c.moveTo(-len*.4,0);c.lineTo(len,0);c.stroke();c.restore();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
function joined(parts){const positions=[],normals=[],uvs=[];for(const {g,matrix} of parts){const a=g.index?g.toNonIndexed():g;const p=a.attributes.position,n=a.attributes.normal,u=a.attributes.uv;const nm=new THREE.Matrix3().getNormalMatrix(matrix),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();normals.push(v.x,v.y,v.z);uvs.push(u?u.getX(i):0,u?u.getY(i):0);}if(a!==g)a.dispose();g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeBoundingSphere();return g;}
function branch(a,b,r0,r1,segments=7){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p),matrix=new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()),new THREE.Vector3(1,1,1));return {g:new THREE.CylinderGeometry(r1,r0,d.length(),segments,1),matrix};}
function foliageGeometry(seed,height,radius,count){
  const random=rng(seed),p=[],n=[],uv=[],idx=[],up=new THREE.Vector3(0,1,0);
  for(let i=0;i<count;i++){
    const az=random()*Math.PI*2,v=random()*2-1,rr=radius*Math.cbrt(random()),rad=Math.sqrt(1-v*v);
    const center=new THREE.Vector3(Math.cos(az)*rr*rad,height*.70+v*height*.28,Math.sin(az)*rr*rad);
    const normal=new THREE.Vector3(Math.cos(az)*.5,.55+random()*.55,Math.sin(az)*.5).normalize();
    const right=new THREE.Vector3().crossVectors(normal,up).normalize();if(right.lengthSq()<.1)right.set(1,0,0);
    const vertical=new THREE.Vector3().crossVectors(right,normal).normalize(),size=.95+random()*.9;
    // 三向交错簇片。倾角和大小不统一，可近看叶片轮廓和枝脉。
    const turn=random()*Math.PI*2;right.applyAxisAngle(normal,turn);vertical.applyAxisAngle(normal,turn);
    const base=p.length/3;
    for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const point=center.clone().addScaledVector(right,a*size*.5).addScaledVector(vertical,b*size*.67);p.push(...point);n.push(...normal);uv.push((a+1)/2,(b+1)/2);}
    idx.push(base,base+1,base+2,base,base+2,base+3);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();return g;
}
function windMaterial(m,height=8,amplitude=.12){
  m.onBeforeCompile=s=>{s.uniforms.uWindTime=wind;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uWindTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
  vec4 wp=instanceMatrix*vec4(position,1.);float w=pow(clamp(position.y/${height.toFixed(2)},0.,1.),1.7);
  transformed.x+=sin(uWindTime*.7+wp.x*.19+wp.z*.17)*${amplitude.toFixed(3)}*w;
  transformed.z+=cos(uWindTime*.52+wp.z*.21)*${(amplitude*.55).toFixed(3)}*w;`);};m.customProgramCacheKey=()=>`plant-wind-${height}-${amplitude}`;return m;
}
function grassGeometry(){const random=rng(311),p=[],n=[],uv=[],idx=[];for(let b=0;b<17;b++){
  const a=random()*Math.PI*2,r=random()*.55,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.5+random()*.8,w=.018+random()*.035,bend=.18+random()*.35;
  const base=p.length/3;for(let j=0;j<=4;j++){const t=j/4,xx=x+Math.cos(a)*bend*t*t,zz=z+Math.sin(a)*bend*t*t,ww=w*(1-t*.97);for(const sign of [-1,1]){p.push(xx+Math.sin(a)*ww*sign,h*t,zz-Math.cos(a)*ww*sign);n.push(Math.cos(a)*.4,.8,Math.sin(a)*.4);uv.push(sign<0?0:1,t);}}
  for(let j=0;j<4;j++){const i=base+j*2;idx.push(i,i+2,i+1,i+1,i+2,i+3);}
}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();return g;}
function instance(g,m,points,root,name,palette){
  // 保留每一株及其原有几何，按空间分组，使视锥剔除能跳过镜头外的整块植被。
  const cells=new Map();for(let i=0;i<points.length;i++){const p=points[i],key=Math.floor(p.x/220)+','+Math.floor(p.z/220);if(!cells.has(key))cells.set(key,[]);cells.get(key).push({...p,colorIndex:i});}
  const batch=new THREE.Group();batch.name=name;root.add(batch);const dummy=new THREE.Object3D();
  for(const entries of cells.values()){
    const obj=new THREE.InstancedMesh(g,m,entries.length);
    entries.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.scale,p.scale*p.stretch,p.scale*.88);dummy.updateMatrix();obj.setMatrixAt(i,dummy.matrix);obj.setColorAt(i,new THREE.Color(palette[p.colorIndex%palette.length]));});
    obj.name=name;obj.castShadow=true;obj.receiveShadow=true;obj.frustumCulled=true;obj.computeBoundingSphere();obj.boundingSphere.radius+=.4;obj.instanceMatrix.needsUpdate=true;batch.add(obj);
  }
  return batch;
}
export function createVegetation(){
  const root=new THREE.Group();root.name='Instanced layered ecological vegetation';const random=rng(81923),trees=[[],[],[]],shrubs=[],grasses=[],reeds=[];
  function allowed(x,z){return Math.abs(z-pathZ(x))>5.8&&((x-DECK.x)/36)**2+((z-DECK.z)/31)**2>1;}
  function add(list,x,z,scale){list.push({x,z,y:heightAt(x,z)-.08,scale,stretch:.82+random()*.35,angle:random()*Math.PI*2});}
  for(let i=0;i<11500;i++){
    let x,z;
    if(i<3000){x=-1110+random()*1670;z=southShore(x)+12+random()*560;}
    else if(i<4700){x=-2150+random()*1100;z=-1150+random()*1600;}
    else{x=-4400+random()*8000;z=northShore(x)-20-random()*1400;}
    const y=heightAt(x,z),density=noise(x*.008,z*.008),slope=surfaceNormal(x,z).y;
    if(y<3||y>830||slope<.56||density<.31||!allowed(x,z))continue;
    if(i<3000&&random()>.45)continue;
    add(trees[i%3],x,z,(i<3000?.65:1.0)+random()*.9);
  }
  for(let i=0;i<11500;i++){
    const x=-1080+random()*1640,z=southShore(x)-4+random()*440,y=heightAt(x,z);
    if(y<-.15||y>140||!allowed(x,z)||noise(x*.032,z*.032)<.42||random()>.65)continue;
    add(shrubs,x,z,.6+random()*1.55);
  }
  // 草本在土壤与浅水边密集成簇；随机场控制空隙，既无整齐队列也不铺满步道。
  for(let i=0;i<33000;i++){
    const x=-1000+random()*1630,z=southShore(x)-3+random()*400,y=heightAt(x,z);
    if(y<-.35||y>110||!allowed(x,z)||noise(x*.018,z*.018)<.26)continue;
    add(y<3.5?reeds:grasses,x,z,y<3.5?1.3+random()*.9:.42+random()*.7);
  }
  const map=sprigTexture(),leaf=windMaterial(new THREE.MeshStandardMaterial({color:0xffffff,map,alphaTest:.39,alphaToCoverage:true,side:THREE.DoubleSide,roughness:.92,metalness:0}),9,.16);
  const bark=new THREE.MeshStandardMaterial({color:0x625b42,roughness:1});
  const palette=[0x527335,0x43642e,0x637c3d,0x3e642f,0x768d42,0x486c35];
  const geometryStats=[];
  for(let k=0;k<3;k++){
    const h=7+k*1.4,r=2.5+k*.28,parts=[branch([0,0,0],[.1,h*.78,0],.21,.075)];
    for(let j=0;j<8;j++){const a=j*2.4+k,y=h*(.32+j*.055);parts.push(branch([0,y,0],[Math.cos(a)*r*.86,y+h*.19,Math.sin(a)*r*.86],.065,.018));}
    const trunk=joined(parts),crown=foliageGeometry(931+k,h,r,190+k*22);
    instance(trunk,bark,trees[k],root,'Instanced branching tree trunks '+k,[0xffffff]);
    instance(crown,leaf,trees[k],root,'Instanced detailed broadleaf crowns '+k,palette);
    geometryStats.push({species:k,instances:trees[k].length,crownTriangles:crown.index.count/3});
  }
  const shrubGeo=foliageGeometry(672,1.65,1.0,62);instance(shrubGeo,leaf,shrubs,root,'Instanced irregular shrubs',palette);
  const grassM=windMaterial(new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide}),1.4,.10),grass=grassGeometry();
  instance(grass,grassM,grasses,root,'Instanced layered grass clumps',[0x6f863c,0x85994b,0x576d30,0x8b9d51]);
  instance(grass,grassM,reeds,root,'Instanced waterside reeds',[0x8c995e,0xa4ad77,0x73854a]);
  root.userData={trees:trees.flat().length,shrubs:shrubs.length,grasses:grasses.length,reeds:reeds.length,species:geometryStats,placement:'seeded density fields; no regular planting grid; no LOD'};
  return {group:root,update:t=>wind.value=t};
}

