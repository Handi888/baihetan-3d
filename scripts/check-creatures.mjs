// 校验真实网格、绑定和全时段路线；浏览器画面另外复核。
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {rm,mkdir} from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'scripts/.creature-audit-generated.mjs');
await mkdir(path.join(root,'docs/qa'),{recursive:true});
await build({stdin:{resolveDir:root,contents:String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {groundHeight} from './src/ground-surface.js';
import {faceZ,section} from './src/math.js';
import {decodeCreatureMesh} from './src/creature-asset.js';
import {prepareRigGeometry,createRiggedActor} from './src/creature-rig.js';
import {createCreatureInstances} from './src/creature-instances.js';
import {createHabitatPlan,motionAt,CREATURE_COUNT,TRANSFER,TRANSFER_TRICKS,flightTrick,transferRoute,swimJump,GRAVITY,PARK_JUMPS} from './src/creature-motion.js';
import {PRESETS,PARAMS} from './src/config.js';
import {softMotionAt,softTarget} from './src/creature-soft-motion.js';
import {createCrest} from './src/crest.js';
import {makeMaterials} from './src/materials.js';
const report={passed:false,actors:CREATURE_COUNT,states:[],minSwimmingGroundClearance:Infinity,crestClearance:Infinity,maxStep:0,originalRetained:true};
const bytes=readFileSync('assets/creature/runtime/creature.mesh');
const source=decodeCreatureMesh(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const geometry=prepareRigGeometry(source),weights=geometry.attributes.skinWeight,ids=geometry.attributes.skinIndex,p=geometry.attributes.position;
for(const attr of Object.values(geometry.attributes))for(const value of attr.array)assert(Number.isFinite(value));
for(const index of geometry.index.array)assert(index<p.count);
for(let i=0;i<p.count;i++){
  let total=0;for(let k=0;k<4;k++){total+=weights.array[i*4+k];assert(ids.array[i*4+k]<6);assert(weights.array[i*4+k]>=0);}
  assert(Math.abs(total-1)<1e-6);
}
const rig=createRiggedActor(geometry,new THREE.MeshStandardMaterial());rig.group.updateMatrixWorld(true);rig.mesh.skeleton.update();
for(let i=0;i<p.count;i+=17){const rest=new THREE.Vector3().fromBufferAttribute(p,i),bound=rig.mesh.getVertexPosition(i,new THREE.Vector3());assert(rest.distanceTo(bound)<1e-6,'Neutral pose must preserve supplied surface');}
rig.pose(2.4,{state:'swim',activity:.8},1);rig.group.updateMatrixWorld(true);rig.mesh.skeleton.update();
let movingVertices=0;for(let i=0;i<p.count;i+=17){const v=rig.mesh.getVertexPosition(i,new THREE.Vector3());assert(v.toArray().every(Number.isFinite));if(v.distanceTo(new THREE.Vector3().fromBufferAttribute(p,i))>.003)movingVertices++;}
assert(movingVertices>100,'Animation must deform the supplied mesh, not only its root');
// 在实际变形网格上检查整个推进周期的尾鳍浸没，不只检查中心点。
let tailWaterMargin=Infinity;
const swimActor={id:4,size:4.2},world=new THREE.Matrix4().makeRotationX(Math.PI/2);
for(const activity of [.55,.6])for(const roll of [-.06,.06])for(let step=0;step<120;step++){
  const time=step/120*Math.PI*2/3.5;world.makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeRotationY(roll));
  rig.pose(time,{state:'swim',activity},swimActor.id);rig.group.updateMatrixWorld(true);rig.mesh.skeleton.update();
  for(let i=0;i<p.count;i++){if(weights.array[i*4+2]<.8)continue;
    const v=rig.mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(world);
    tailWaterMargin=Math.min(tailWaterMargin,(.19-v.y)*swimActor.size);
  }
}
assert(tailWaterMargin>.01,'Tail flukes must remain submerged through the propulsion cycle');report.tailWaterMargin=tailWaterMargin;
const plan=createHabitatPlan(groundHeight),states=new Set();assert.equal(plan.length,CREATURE_COUNT);assert.equal(plan.length,91);
report.zones=Object.fromEntries([...new Set(plan.map(a=>a.zone))].map(zone=>[zone,plan.filter(a=>a.zone===zone).length]));
assert(report.zones['dam-upstream']>=18&&report.zones['dam-downstream']>=8&&report.zones.downstream>=11);
assert.equal(report.zones.park,28);assert.equal(plan.filter(a=>a.zone==='park'&&a.type==='shore').length,4);
assert.equal(report.zones['dam-transfer'],12);assert.equal(new Set(plan.filter(a=>a.type==='transfer').map(a=>a.trick)).size,6);
const batch=createCreatureInstances(source,new THREE.MeshStandardMaterial(),plan.length),matrix=new THREE.Matrix4(),orientation=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3();
report.maxFlightRotationStep=0;
for(const a of plan){
  let previous=null,previousRotation=null;
  for(let step=0;step<=4800;step++){
    const t=step*.05,s=motionAt(a,t,groundHeight);states.add(s.state);
    for(const key of ['x','y','z','heading','pitch','roll'])assert(Number.isFinite(s[key]),key);
    const clearance=s.y-groundHeight(s.x,s.z);
    if(a.type==='swim'){report.minSwimmingGroundClearance=Math.min(report.minSwimmingGroundClearance,clearance);assert(clearance>a.size*.45,'Path intersects terrain: '+a.id);}
    if(a.type==='shore'){assert(clearance>a.size*.26,'Bank transition intersects terrain: '+a.id);assert.equal(s.pitch,Math.PI/2,'Resting and bank approach must stay horizontal');}
    if(a.type==='transfer'){
      assert(clearance>a.size*.45,'Transfer intersects terrain');
      if(s.z>faceZ(s.x,289,1)-a.size*.5&&s.z<faceZ(s.x,289,-1)+a.size*.5){report.crestClearance=Math.min(report.crestClearance,s.y-289-a.size*.5);assert(s.y>289+a.size*.5,'Jump intersects crest');}
      batch.write(a.id,a,s,t);batch.mesh.getMatrixAt(a.id,matrix);matrix.decompose(position,orientation,scale);
      if(previousRotation){const angle=orientation.angleTo(previousRotation);report.maxFlightRotationStep=Math.max(report.maxFlightRotationStep,angle);assert(angle<.8,'Abrupt orientation change for actor '+a.id+' at '+t);}
      previousRotation=orientation.clone();
    }
    if(previous){const step=Math.hypot(s.x-previous.x,s.y-previous.y,s.z-previous.z);report.maxStep=Math.max(step,report.maxStep);assert(step<5,'Teleport detected: '+a.id+' at '+t);}
    previous=s;
  }
}
for(const name of ['swim','breach','dive','rest','enter','land','transfer','return'])assert(states.has(name),'Missing behavior '+name);
// 六种旋转真正影响实例矩阵，并在入水前归位；连续循环边界不重置位置。
const signatures=new Set();
for(let i=0;i<6;i++){
  const s=flightTrick(i,.47);signatures.add(s.trickRotation.map(v=>v.toFixed(3)).join(','));
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...flightTrick(i,.9).trickRotation));assert(q.angleTo(new THREE.Quaternion())<1e-6,'Finish trick before impact');
}
assert.equal(signatures.size,6);
for(const a of plan.filter(a=>a.type==='transfer')){
  const route=transferRoute(a);
  for(const boundary of [0,route.duration,route.duration+route.lowerSwim,2*route.duration+route.lowerSwim,route.period]){
    const before=motionAt(a,route.start+boundary-.0001,groundHeight),after=motionAt(a,route.start+boundary+.0001,groundHeight);
    assert(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<.02,'Loop transition must remain continuous');
  }
}
const starts=plan.filter(a=>a.type==='transfer').map(a=>transferRoute(a).start).sort((a,b)=>a-b);
for(let i=1;i<starts.length;i++)assert.equal(starts[i]-starts[i-1],6);
report.tricks=TRANSFER_TRICKS;report.launchInterval=TRANSFER.interval;report.cycleSeconds=TRANSFER.period;
const variations=[];
for(const a of plan.filter(a=>a.type==='swim'))for(let cycle=0;cycle<4;cycle++){
  const launch=cycle*a.period-a.phase+7,jump=swimJump(a,launch),start=motionAt(a,launch,groundHeight),end=motionAt(a,launch+jump.duration,groundHeight);
  variations.push({...jump,distance:Math.hypot(end.x-start.x,end.z-start.z)});
  for(const offset of [0,jump.duration]){
    const p0=motionAt(a,launch+offset-.0001,groundHeight),p1=motionAt(a,launch+offset+.0001,groundHeight);
    assert(Math.hypot(p0.x-p1.x,p0.y-p1.y,p0.z-p1.z)<.01,'Variable breach boundary remains continuous');
  }
}
for(const property of ['height','duration','distance'])assert(new Set(variations.map(v=>v[property].toFixed(2))).size>15,'Jumps must vary '+property);
report.surfaceJumps=Object.fromEntries(['height','duration','distance'].map(k=>[k,{min:Math.min(...variations.map(v=>v[k])),max:Math.max(...variations.map(v=>v[k]))}]));
assert.equal(new Set(variations.map(v=>v.style)).size,6);
// 用实际原件顶点校验眼睑收合与腹部局部位移，不改尾部、头顶或 UV。
const softGeometry=batch.mesh.geometry;let eyeVertices=0,bellyVertices=0;
for(let i=0;i<p.count;i++){
  const b=softGeometry.attributes.blinkDelta,belly=softGeometry.attributes.bellyDelta;
  if(Math.hypot(b.getX(i),b.getY(i),b.getZ(i))>.0001)eyeVertices++;
  if(Math.hypot(belly.getX(i),belly.getY(i),belly.getZ(i))>.0001)bellyVertices++;
  if(p.getY(i)<-.27)assert.equal(belly.getZ(i),0,'Elastic belly must not deform tail');
  if(p.getY(i)>.25)assert.equal(belly.getZ(i),0,'Elastic belly must not deform face');
}
assert(eyeVertices>40&&bellyVertices>200,'Morph targets cover actual detailed surfaces');
const eyeTop=softTarget(.0777,.415,.24,'blink'),eyeBottom=softTarget(.0777,.391,.24,'blink');
assert(eyeTop[1]-eyeBottom[1]<.001,'Closed eyelids compress the pupil into a fine seam');
let blinkPeak=0,openFrames=0,bellyMin=1,bellyMax=-1;
for(let i=0;i<2000;i++){const s=softMotionAt({id:0},{state:'rest'},i*.01);blinkPeak=Math.max(blinkPeak,s.blink);if(s.blink===0)openFrames++;bellyMin=Math.min(bellyMin,s.belly);bellyMax=Math.max(bellyMax,s.belly);assert(s.blink>=0&&s.blink<=1&&Math.abs(s.belly)<=1);}
assert(blinkPeak>.99&&openFrames>1500,'Natural blinking is brief and fully closes');assert(bellyMin<-.6&&bellyMax>.15,'Patting compresses then rebounds');
assert.notEqual(softMotionAt({id:0},{state:'swim'},.9).blink,softMotionAt({id:1},{state:'swim'},.9).blink,'Independent blink phases');
report.softMotion={eyeVertices,bellyVertices,blinkPeak,bellyMin,bellyMax};
// 对实际位移求导，避免仅让朝向/显示速度变化、轨迹仍然匀速播放。
function auditBallistic(a,start,duration){
  const energies=[],h=.001;
  for(const q of [.1,.25,.5,.75,.9]){
    const t=start+duration*q,s=motionAt(a,t,groundHeight),before=motionAt(a,t-h,groundHeight),after=motionAt(a,t+h,groundHeight);
    assert(Math.abs((after.y-2*s.y+before.y)/(h*h)+GRAVITY)<.00001,'Airborne vertical acceleration must be -g');
    for(const [axis,i] of [['x',0],['y',1],['z',2]])assert(Math.abs((after[axis]-before[axis])/(2*h)-s.velocity[i])<1e-6,'Velocity must match actual trajectory');
    energies.push(.5*s.speed*s.speed+GRAVITY*s.y);
  }
  assert(Math.max(...energies)-Math.min(...energies)<1e-6,'Kinetic plus potential energy stays constant in flight');
}
for(const a of plan.filter(a=>a.type==='swim')){const start=a.period-a.phase+7,jump=swimJump(a,start);auditBallistic(a,start,jump.duration);
  const launch=motionAt(a,start+.001,groundHeight),apex=motionAt(a,start+jump.duration/2,groundHeight),land=motionAt(a,start+jump.duration-.001,groundHeight);
  assert(launch.speed>apex.speed&&land.speed>apex.speed,'Ascend slower, descend faster');
}
for(const a of plan.filter(a=>a.type==='transfer')){const p=transferRoute(a);auditBallistic(a,p.start,p.duration);assert(motionAt(a,p.start+p.duration-.01,groundHeight).speed>motionAt(a,p.start+.01,groundHeight).speed,'Lower landing gains kinetic energy');}
report.physics={gravity:GRAVITY,airEnergyConserved:true,horizontalTransferSpeed:TRANSFER.vz};
// 检查新增六条通道避开实际门机、坝顶小房及栏杆，不只检查坝体中心线。
const structures=createCrest(makeMaterials());structures.updateMatrixWorld(true);
const obstacles=[];structures.traverse(o=>{if(!o.isMesh)return;const bounds=new THREE.Box3().setFromObject(o);if(bounds.max.y<289||bounds.min.x>100||bounds.max.x< -100)return;obstacles.push({o,bounds});});
const ball=new THREE.Sphere(),tri=new THREE.Triangle(),near=new THREE.Vector3();
for(const a of plan.filter(a=>a.type==='transfer').slice(0,6)){
  const route=transferRoute(a);
  for(const begin of [route.start,route.start+route.duration+route.lowerSwim])for(let u=.05;u<route.duration;u+=.05){
    const s=motionAt(a,begin+u,groundHeight);ball.center.set(s.x,s.y,s.z);ball.radius=a.size*.55;
    for(const {o,bounds} of obstacles){if(!bounds.intersectsSphere(ball))continue;const p=o.geometry.attributes.position,ix=o.geometry.index;
      for(let j=0;j<(ix?.count??p.count);j+=3){for(const [v,k] of [[tri.a,0],[tri.b,1],[tri.c,2]])v.fromBufferAttribute(p,ix?ix.getX(j+k):j+k).applyMatrix4(o.matrixWorld);
        tri.closestPointToPoint(ball.center,near);assert(near.distanceTo(ball.center)>ball.radius,'Flight too close to crest structure: '+o.name+' / '+o.parent.name+' actor '+a.id+' time '+u+' at '+JSON.stringify([s.x,s.y,s.z])+' bounds '+JSON.stringify([bounds.min.toArray(),bounds.max.toArray()]));
      }
    }
  }
}
// 十分钟逐 50ms 检查：必须有真正露出水面的跃起，且位于默认公园镜头内。
// 用模型中心高于水面 25cm 的区间，而非单凭 breach 状态判断。
const park=plan.filter(a=>a.zone==='park'),core=park.filter(a=>a.parkSlot!=null);
assert.equal(core.length,16);assert.equal(new Set(core.map(a=>a.parkSlot)).size,16);
const preset=PRESETS.park,camera=new THREE.PerspectiveCamera(PARAMS.camera.fov,16/9,1,30000),screen=new THREE.Vector3();
camera.position.set(...preset.eye);camera.lookAt(new THREE.Vector3(...preset.target));camera.updateMatrixWorld();
let minVisible=Infinity,maxAirborne=0,minAirborne=Infinity;
for(let step=0;step<=12000;step++){
  const t=step*.05;let visible=0,airborne=0;
  for(const a of park){const s=motionAt(a,t,groundHeight);if(s.state!=='breach'||s.y<=s.level+.25)continue;airborne++;
    screen.set(s.x,s.y,s.z).project(camera);
    // 右侧留出默认控制面板区域，不能把躲在面板后的跃起算作可见。
    if(screen.x>-.9&&screen.x<.55&&Math.abs(screen.y)<.9&&screen.z> -1&&screen.z<1)visible++;
  }
  minAirborne=Math.min(minAirborne,airborne);maxAirborne=Math.max(maxAirborne,airborne);minVisible=Math.min(minVisible,visible);
  assert(visible>=1,'Park has a visible jump gap at '+t+' seconds');
  assert(airborne<=6,'Park jumps should overlap a little, not become a synchronized crowd');
}
// 对 100 轮实际起跳时刻排序，检查错峰不漂移；包括循环边界，不仅比较初始相位。
const launches=[];
for(const a of park.filter(a=>a.type==='swim'))for(let cycle=-2;cycle<100;cycle++){
  const launch=cycle*a.period-a.phase+7;if(launch>=0&&launch<1400)launches.push(launch);
}
launches.sort((a,b)=>a-b);let maxLaunchGap=0;
for(let i=1;i<launches.length;i++){const gap=launches[i]-launches[i-1];assert(gap>.1,'Park individuals launch together');maxLaunchGap=Math.max(maxLaunchGap,gap);}
assert(maxLaunchGap<=1,'At least one fresh park launch per second');
// 最小跳高和最大体型也有足够可见空中时间，让相邻 0.9 秒起跳连续衔接。
const minV=Math.sqrt(2*GRAVITY*2.4),maxSize=Math.max(...core.map(a=>a.size));
const clearWindow=2*Math.sqrt(minV*minV-2*GRAVITY*(maxSize*.19+.25))/GRAVITY;
assert(clearWindow>PARK_JUMPS.interval+.1,'Guaranteed visible airtime exceeds launch spacing');
report.parkSchedule={population:park.length,coreSwimmers:core.length,launchSpacing:PARK_JUMPS.interval,maxLaunchGap,
  minAirborne,maxAirborne,minVisibleInParkPreset:minVisible,checkedSeconds:600,sampleSeconds:.05,minimumClearAirtime:clearWindow};
report.states=[...states];report.vertices=p.count;report.triangles=geometry.index.count/3;report.movingVerticesSample=movingVertices;
report.plan=plan;report.passed=true;writeFileSync('docs/qa/CREATURE_AUDIT.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,plan:undefined},null,2));
`},outfile:out,bundle:true,platform:'node',format:'esm',alias:{three:path.join(root,'vendor/three.module.js')}});
try{await import(pathToFileURL(out));}finally{await rm(out,{force:true});}
