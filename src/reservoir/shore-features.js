import * as THREE from 'three';
import {DECK,heightAt,southShore,northShore,pathZ,mesh,box,rod,ribbon,rng,hash} from './landscape.js';

function platform(root,m){
  // 用严格闭合的 192 点环避免椭圆首尾浮点重复造成零面积三角形。
  const shape=new THREE.Shape();for(let i=0;i<192;i++){const a=i/192*Math.PI*2,x=Math.cos(a)*DECK.rx,z=Math.sin(a)*DECK.rz;if(i===0)shape.moveTo(x,z);else shape.lineTo(x,z);}shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:.7,bevelEnabled:false,curveSegments:96});g.rotateX(-Math.PI/2);
  const deck=mesh(g,m.curb,root,'Lakeside elliptical observation platform');deck.position.set(DECK.x,DECK.y-.7,DECK.z);
  // 实体基础及支柱延伸至地形，观景平台有支撑，不悬浮在水上。
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=DECK.x+Math.cos(a)*21,z=DECK.z+Math.sin(a)*16,b=heightAt(x,z)-.5;
    if(b<DECK.y-.5)box(root,m.curb,[.6,DECK.y-b,.6],[x,(DECK.y+b)/2,z],'Platform foundation pier');}
  const rail=[];for(let i=0;i<=40;i++){const a=Math.PI+i/40*Math.PI,x=DECK.x+Math.cos(a)*26.5,z=DECK.z+Math.sin(a)*21.4;rail.push([x,DECK.y+1.1,z]);if(i%2===0)rod(root,m.metal,[x,DECK.y,z],[x,DECK.y+1.1,z],.045);}
  for(let i=0;i<rail.length-1;i++)rod(root,m.metal,rail[i],rail[i+1],.04);
  for(const dx of [-10,9]){
    const cx=DECK.x+dx,cz=DECK.z+3,w=16,d=12,top=DECK.y+4.6;
    for(const [x,z] of [[-w/2,-d/2],[w/2,-d/2],[-w/2,d/2],[w/2,d/2]])box(root,m.white,[.22,4.55,.22],[cx+x,DECK.y+2.275,cz+z],'White pergola column');
    for(const z of [-d/2,d/2])box(root,m.white,[w+.5,.28,.22],[cx,top,cz+z],'Pergola longitudinal beam');
    for(let i=0;i<=16;i++)box(root,m.white,[.16,.19,d+.6],[cx-w/2+i*w/16,top+.18,cz],'Individual white pergola slat');
    // 参考图的浅色遮阴顶，细分曲面在跨中略微下垂。
    const roof=new THREE.PlaneGeometry(w+.8,d+.8,24,18);roof.rotateX(-Math.PI/2);const p=roof.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,.16+.24*(Math.abs(p.getX(i))/(w/2))**2+.13*(Math.abs(p.getZ(i))/(d/2))**2);roof.computeVertexNormals();
    const canopy=mesh(roof,m.white,root,'White shade canopy');canopy.position.set(cx,top+.17,cz);
  }
  for(const dx of [-17,17])for(const dz of [-7,9]){box(root,m.wood,[3,.2,.7],[DECK.x+dx,DECK.y+.58,DECK.z+dz],'Lakeside timber seat');for(const sx of [-1,1])box(root,m.metal,[.12,.55,.5],[DECK.x+dx+sx,DECK.y+.275,DECK.z+dz],'Bench support');}
}
function addPaths(root,m){
  const points=[];for(let x=-1100;x<=650;x+=4){const z=pathZ(x);points.push([x,heightAt(x,z)+.24,z]);}
  ribbon(root,points,5.4,m.path);
  for(const side of [-1,1])ribbon(root,points.map(p=>[p[0],p[1]+.04,p[2]+side*2.7]),.23,m.curb);
  const link=[];const startZ=pathZ(DECK.x);
  for(let i=0;i<=40;i++){const t=i/40,z=startZ+(DECK.z+16-startZ)*t,x=DECK.x+9*Math.sin(t*Math.PI);link.push([x,Math.max(heightAt(x,z)+.25,DECK.y*t),z]);}
  ribbon(root,link,4.5,m.path);
  // 前景小径随坡面回转，形成植物分层的自然边界。
  const winding=[];for(let i=0;i<=160;i++){const t=i/160,z=450+t*520,x=140+115*Math.sin(t*4.5);winding.push([x,heightAt(x,z)+.25,z]);}
  ribbon(root,winding,3.6,m.path);
  for(let i=0;i<points.length;i+=19){const p=points[i];rod(root,m.metal,[p[0],p[1],p[2]+4],[p[0],p[1]+3.2,p[2]+4],.055);box(root,m.white,[.55,.12,.32],[p[0],p[1]+3.2,p[2]+4],'Pedestrian path light');}
}
function villages(root,m){
  const random=rng(18729);let houses=0;
  for(const cx of [-2750,-1720,-700,520,1570,2570])for(let j=0;j<27;j++){
    const x=cx+(random()-.5)*470,z=northShore(x)-70-random()*350,y=heightAt(x,z),w=7+random()*8,d=7+random()*6,h=5+random()*7;
    const home=new THREE.Group();home.name='Scattered village residence';home.position.set(x,y-.8,z);home.rotation.y=(random()-.5)*.8;root.add(home);
    box(home,m.curb,[w+1.4,2,d+1.4],[0,.3,0],'House foundation');box(home,m.wall,[w,h,d],[0,h/2+1,0],'Village white dwelling');
    const roof=mesh(new THREE.ConeGeometry(Math.max(w,d)*.76,2.1,4),m.roof,home,'Pitched village roof');roof.rotation.y=Math.PI/4;roof.position.y=h+2;
    for(let level=0;level<(h>8?2:1);level++)for(const dx of [-.25,.25])box(home,m.windows,[w*.19,1.4,.04],[w*dx,3+level*3,d/2+.03],'Dwelling window');houses++;
  }
  const road=[];for(let x=-3550;x<=3350;x+=15){const z=northShore(x)-120-45*Math.sin(x/290);road.push([x,heightAt(x,z)+.45,z]);}ribbon(root,road,6.2,m.path);
  // 山腰另一路线横穿梯田；固定采样保留每个弯折。
  const hillRoad=[];for(let x=-3100;x<=2100;x+=13){const z=northShore(x)-570-80*Math.sin(x/340);hillRoad.push([x,heightAt(x,z)+.4,z]);}ribbon(root,hillRoad,4.5,m.curb);
  // 全景参考右侧的零散中层建筑群，采用小范围分布，避免占满山岸。
  for(let i=0;i<9;i++){const x=2450+i*32,z=northShore(x)-45-i%3*24,y=heightAt(x,z),h=20+random()*24;box(root,m.wall,[17,h,13],[x,y+h/2,z],'Distant lakeside midrise');for(let j=3;j<h;j+=3)box(root,m.windows,[14,.65,.15],[x,y+j,z+6.6],'Distant window band');}
  return houses;
}
function rocks(root,m){
  const random=rng(639),positions=[];
  for(let i=0;i<620;i++){const x=-1100+random()*1750,z=southShore(x)+(random()-.45)*10,y=heightAt(x,z);if(y>5||y<-4)continue;positions.push({x,z,y,size:.5+Math.pow(random(),2)*2.6});}
  for(let i=0;i<230;i++){const z=-1150+random()*1250;let lo=-2200,hi=-700;for(let j=0;j<28;j++){const x=(lo+hi)/2;if(heightAt(x,z)>1)lo=x;else hi=x;}const x=(lo+hi)/2;positions.push({x,z,y:heightAt(x,z),size:1.8+random()*5});}
  const g=new THREE.DodecahedronGeometry(1,2),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=.82+hash(x*1000+z*300,y*1000)*.30;p.setXYZ(i,x*f,y*f*.66,z*f);}g.computeVertexNormals();
  const stones=new THREE.InstancedMesh(g,m.rock,positions.length),dummy=new THREE.Object3D();for(let i=0;i<positions.length;i++){const q=positions[i];dummy.position.set(q.x,q.y-.25,q.z);dummy.rotation.set(.1*random(),random()*6.28,.2*random());dummy.scale.set(q.size,q.size*.9,q.size*1.5);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);stones.setColorAt(i,new THREE.Color().setScalar(.7+random()*.5));}stones.castShadow=true;stones.receiveShadow=true;stones.name='Irregular shoreline rocks intersecting continuous water';stones.computeBoundingSphere();root.add(stones);return positions.length;
}
export function createShoreFeatures(m){const root=new THREE.Group();root.name='Ecological waterfront and hillside settlement';platform(root,m);addPaths(root,m);root.userData={houses:villages(root,m),shoreRocks:rocks(root,m),pergolas:2};return root;}
