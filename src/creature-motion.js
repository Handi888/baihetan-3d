// 动作和路线只使用米、秒。纯函数便于校验完整轨迹，不依赖帧率。
// 公园主视野内固定错峰，最长 0.9 秒就有下一只起跳；不能依赖随机概率填空。
export const PARK_JUMPS={count:16,interval:.9,period:14.4};
export const CREATURE_COUNT=75+PARK_JUMPS.count;
export const GRAVITY=9.81;
const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const mod=(v,n)=>(v%n+n)%n;

export function createHabitatPlan(heightAt){
  function shore(x,above=-.35){let a=-4840,b=-4100;for(let i=0;i<30;i++){const z=(a+b)/2;if(heightAt(x,z)>259+above)b=z;else a=z;}return (a+b)/2;}
  const list=[];
  const add=(type,zone,x,z,rx,rz,level,period,size,phase)=>list.push({id:list.length,type,zone,x,z,rx,rz,level,period,size,phase});
  // 4 只在浅水边侧卧；身体保持横向，不采用立姿或直立行走。
  for(const [x,phase] of [[-630,0],[-435,38],[-100,79],[180,17]]){const bankZ=shore(x);add('shore','park',x,bankZ,0,0,259,128,4.7,phase);list.at(-1).ground=heightAt(x,bankZ);}
  // 原有外围 8 只保留位置；起跳落在核心轮次之间，之后循环也不会整群同步。
  for(let i=0;i<8;i++){
    const x=[-560,-455,-355,-245,-120,50,210,385][i],period=PARK_JUMPS.period*2;
    const launch=((i*3)%8)*period/8+PARK_JUMPS.interval/2;
    add('swim','park',x,shore(x)-72-13*(i%3),18,27,259,period,4.2+(i%3)*.35,mod(7-launch,period));
  }
  // 开阔湖湾 14 只，保持大范围疏散。
  for(let i=0;i<14;i++)add('swim','lake',-420+(i%7)*280,-5300-Math.floor(i/7)*740-(i%3)*85,36,48,259,71+i*2,4.3+(i%4)*.3,i*17);
  // 坝前高水位 18 只，靠坝与较远处都有，不能只集中在公园。
  for(let i=0;i<18;i++)add('swim','dam-upstream',(i%3-1)*85,-310-Math.floor(i/3)*110,17,31,259,48+i*2.1,4.4+(i%3)*.3,i*9.3);
  // 12 只沿六条通道错峰跨坝：总数仅增加 11，仍共享同一份实例网格。
  for(let i=0;i<12;i++){
    add('transfer','dam-transfer',[-65,-39,-13,13,39,65][i%6],-280,0,0,259,72,4.8+(i%3)*.2,i*6);
    list.at(-1).trick=i%6;
  }
  // 坝下低水位水垫塘 8 只。
  for(let i=0;i<8;i++)add('swim','dam-downstream',(i%2?1:-1)*28,80+Math.floor(i/2)*115,13,27,24,53+i*3,4.2+(i%3)*.35,i*8.7);
  // 下游河道 11 只，随真实水深选取安全的河心路线。
  for(let i=0;i<11;i++)add('swim','downstream',(i%2?1:-1)*18,600+i*65,12,22,24,55+i*2.3,4.3+(i%4)*.25,3+i*12.7);
  // 新增在原清单之后，保持坝区等旧个体 ID、眨眼相位和花样种子不变。
  // 沿公园主视野散点布置，近远错落；空间顺序与起跳顺序不同，不排队齐跳。
  const parkPoints=[[-415,62],[-355,65],[-295,55],[-465,97],[-399,113],[-335,103],[-278,95],[-445,158],
    [-382,166],[-319,153],[-495,208],[-425,222],[-355,221],[-480,266],[-407,282],[-340,281]];
  for(let i=0;i<PARK_JUMPS.count;i++){
    const [x,offshore]=parkPoints[i],slot=(i*7)%PARK_JUMPS.count;
    add('swim','park',x,shore(x)-offshore,8+(i%3)*1.3,10+(i%4)*1.4,259,PARK_JUMPS.period,4.2+(i%4)*.15,mod(7-slot*PARK_JUMPS.interval,PARK_JUMPS.period));
    list.at(-1).parkSlot=slot;
  }
  for(const a of list){
    if(a.type!=='swim')continue;
    // 检查整个闭环都处于实际水域；只调整路线，不改地形、水面或模型。
    const safe=x=>{for(let j=0;j<128;j++){const t=j/128*TAU;if(heightAt(x+a.rx*Math.sin(t),a.z+a.rz*Math.cos(t))>a.level-a.size*1.5)return false;}return true;};
    if(!safe(a.x)){
      let found=false;for(let d=4;d<=240&&!found;d+=4)for(const sign of [1,-1])if(safe(a.x+sign*d)){a.x+=sign*d;found=true;break;}
      if(!found)throw new Error('Swimming path has no safe water corridor');
    }
  }
  return list;
}

const randomAt=(id,cycle,salt)=>{const n=Math.sin(id*127.1+cycle*311.7+salt*74.7)*43758.5453;return n-Math.floor(n);};
export function swimJump(a,t){
  const cycle=Math.floor((t+a.phase)/a.period);
  const height=2.4+randomAt(a.id,cycle,1)*6.4,verticalSpeed=Math.sqrt(2*GRAVITY*height),duration=2*verticalSpeed/GRAVITY;
  const w=TAU/a.period,startAngle=7*w,radius=Math.hypot(a.rx*Math.cos(startAngle),a.rz*Math.sin(startAngle));
  const desiredSpeed=3.8+randomAt(a.id,cycle,2)*6.2;
  const travelAngle=Math.max(w*duration,Math.min(.85,desiredSpeed*duration/radius));
  return {height,duration,verticalSpeed,travelAngle,style:Math.floor(randomAt(a.id,cycle,3)*6)};
}
function swim(a,t){
  const phase=mod(t+a.phase,a.period),jump=swimJump(a,t),{duration,height,style,verticalSpeed,travelAngle}=jump,landing=7+duration;
  const w=TAU/a.period,startAngle=7*w,endAngle=startAngle+travelAngle,offset=travelAngle-w*duration,rejoin=4+1.6*offset/w;
  const after=clamp((phase-landing)/rejoin),angle=phase*w+(phase>landing?offset*(1-smooth(after)):0);
  const angularSpeed=w-(phase>landing?offset*6*after*(1-after)/rejoin:0);
  const p={x:a.x+a.rx*Math.sin(angle),z:a.z+a.rz*Math.cos(angle)};
  const launch={x:a.x+a.rx*Math.sin(startAngle),z:a.z+a.rz*Math.cos(startAngle)};
  const land={x:a.x+a.rx*Math.sin(endAngle),z:a.z+a.rz*Math.cos(endAngle)};
  const airVX=(land.x-launch.x)/duration,airVZ=(land.z-launch.z)/duration,airHeading=Math.atan2(airVX,airVZ);
  // 每圈只有一次跃出，另外半圈短暂下潜；相位错开，不会同时跳满画面。
  const q=(phase-7)/duration,breach=q>=0&&q<=1;
  let y=a.level-a.size*.19,state='swim';
  // 腾空段遵循真实秒和重力：水平匀速，竖直速度 vy=v0-g*t。
  // 合速度 sqrt(vx²+vy²+vz²) 随高度自然变化，绝不匀速插值整条弧线。
  if(breach){const u=phase-7;p.x=launch.x+airVX*u;p.z=launch.z+airVZ*u;y+=verticalSpeed*u-.5*GRAVITY*u*u;state='breach';}
  else {
    // 高频公园轮次先完成入水恢复再下潜，不能把旧长周期的下潜段叠到落水上。
    const diveStart=a.parkSlot!=null?Math.max(a.period*.70,landing+1.3):a.period*.58;
    const diveEnd=a.parkSlot!=null?a.period*.94:a.period*.77;
    if(phase>diveStart&&phase<diveEnd){const u=(phase-diveStart)/(diveEnd-diveStart);y-=Math.sin(u*Math.PI)*a.size*.48;state='dive';}
  }
  const vx=breach?airVX:a.rx*angularSpeed*Math.cos(angle),vz=breach?airVZ:-a.rz*angularSpeed*Math.sin(angle),vy=breach?verticalSpeed-GRAVITY*(phase-7):0;
  let pitch=Math.PI/2-Math.atan2(vy,Math.hypot(vx,vz));
  let heading=Math.atan2(vx,vz);
  const launchAngle=Math.atan2(verticalSpeed,Math.hypot(airVX,airVZ));
  const turnTo=(from,to,u)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*smooth(u);
  if(phase>6.1&&phase<7){const u=(phase-6.1)/.9;y-=Math.sin(u*Math.PI)*.6;pitch-=smooth(u)*launchAngle;heading=turnTo(heading,airHeading,u);state='gather';}
  if(phase>landing&&phase<landing+1.1){const u=(phase-landing)/1.1;y-=Math.sin(u*Math.PI)*1.1;pitch+=(1-smooth(u))*launchAngle;heading=turnTo(airHeading,heading,u);state='recover';}
  let trick={};
  if(breach){
    // 低跳只侧倾 / 摆尾；腾空较充分时才作整周翻转，入水之前展开双鳍。
    if(height>4.5&&style>=3)trick=flightTrick([0,0,0,2,0,4][style],q);
    else trick={trickRotation:[0,style===1?.55*Math.sin(Math.PI*q)**2:style===2?-.55*Math.sin(Math.PI*q)**2:0,0],airTuck:.12*Math.sin(Math.PI*q)**2};
  }
  return {...p,y,level:a.level,state,heading,pitch,roll:.06*Math.sin(t*.7+a.id),activity:breach?.95:.55,surface:state==='swim',
    jumpHeight:height,jumpDuration:duration,jumpStyle:style,velocity:[vx,vy,vz],speed:Math.hypot(vx,vy,vz),impactAge:state==='recover'?phase-landing:null,...trick};
}

function shoreState(a,t,heightAt){
  const phase=mod(t+a.phase,a.period),restY=a.ground+a.size*.29;
  if(phase<26||phase>=100)return {x:a.x,z:a.z,y:restY+.025*Math.sin(t*1.1+a.id),level:259,state:'rest',heading:Math.PI*(phase>=100?smooth((phase-100)/(a.period-100)):1),pitch:Math.PI/2,roll:-1.42+.012*Math.sin(t*.3),activity:.10,restBlend:1,surface:false};
  const entry={x:a.x,z:a.z-32};
  if(phase<37||phase>=89){
    const u=phase<37?smooth((phase-26)/11):1-smooth((phase-89)/11),z=mix(a.z,entry.z,u),ground=heightAt(a.x,z);
    const pitch=Math.PI/2;
    // 腹部支持面逐步过渡到水面；上岸阶段不会从坡面下方穿出。
    const support=.29*a.size;
    const y=Math.max(mix(restY,259-a.size*.19,u),ground+support*(1-u));
    return {x:a.x,z,y,level:259,state:phase<37?'enter':'land',heading:phase<37?Math.PI:0,pitch,roll:-1.42*(1-u),activity:.1+.5*u,restBlend:1-u,surface:u>.8};
  }
  const u=(phase-37)/52,v=u<.5?u*2:(u-.5)*2;
  // 两段三次曲线的起终切向分别朝离岸/上岸方向，避免突然横转 90°。
  const pts=u<.5?[[0,0],[0,-28],[24,-55],[0,-58]]:[[0,-58],[-24,-55],[0,-28],[0,0]];
  const axis=k=>Math.pow(1-v,3)*pts[0][k]+3*(1-v)**2*v*pts[1][k]+3*(1-v)*v*v*pts[2][k]+v**3*pts[3][k];
  const tangent=k=>3*(1-v)**2*(pts[1][k]-pts[0][k])+6*(1-v)*v*(pts[2][k]-pts[1][k])+3*v*v*(pts[3][k]-pts[2][k]);
  return {x:a.x+axis(0),z:entry.z+axis(1),y:259-a.size*.19,level:259,state:'swim',heading:Math.atan2(tangent(0),tangent(1)),pitch:Math.PI/2,roll:.04*Math.sin(u*TAU),activity:.6,surface:true};
}

export const TRANSFER={start:6,y:259-5.2*.19,z:-280,x:65,vy:31,vz:50,vx:-3,g:GRAVITY,period:72,interval:6,lowerSwim:22};
TRANSFER.duration=(TRANSFER.vy+Math.sqrt(TRANSFER.vy**2+2*TRANSFER.g*(TRANSFER.y-24)))/TRANSFER.g;
export const TRANSFER_TRICKS=['forward-flip','back-flip','barrel-roll','double-roll','twisting-flip','side-cartwheel'];

// 所有额外旋转均绕身体局部轴。起跳及最后 20% 的入水段保持沿速度方向。
// smooth 的端点角速度为 0，整周旋转结束与中立姿态等价，不在落水时硬切朝向。
export function flightTrick(style,progress){
  const turn=TAU*smooth((progress-.14)/.66),tuck=Math.sin(Math.PI*smooth((progress-.14)/.66));
  const rotations=[[turn,0,0],[-turn,0,0],[0,turn,0],[0,-2*turn,0],[turn,turn,0],[0,0,turn]][style%6];
  return {trickRotation:rotations,airTuck:tuck*([0,1,4].includes(style%6)?1:.3)};
}
export function transferRoute(a){
  return {...TRANSFER,x:a.x,z:a.z,vx:-a.x*.046,start:TRANSFER.start+a.phase};
}
function flight(a,p,u,reverse=false){
  const v=reverse?p.duration-u:u,sign=reverse?-1:1,vy=sign*(p.vy-p.g*v);
  // 回程偏离去程 12 m，双向相遇时不重合；端点位置和切向仍与游动相连。
  const offset=reverse?12*Math.sin(Math.PI*u/p.duration)**2:0,vx=sign*p.vx+(reverse?12*Math.PI/p.duration*Math.sin(TAU*u/p.duration):0);
  return {x:p.x+p.vx*v+offset,z:p.z+p.vz*v,y:p.y+p.vy*v-.5*p.g*v*v,level:reverse?259:24,
    state:reverse?'return':'transfer',heading:Math.atan2(vx,sign*p.vz),pitch:Math.PI/2-Math.atan2(vy,Math.hypot(vx,p.vz)),roll:0,
    activity:reverse?.65:.85,surface:false,velocity:[vx,vy,sign*p.vz],speed:Math.hypot(vx,vy,p.vz),flightProgress:u/p.duration,trickIndex:a.trick,
    ...(reverse?{}:flightTrick(a.trick,u/p.duration))};
}
function basinLoop(a,p,s,duration,lower){
  const q=clamp(s/duration),direction=lower?1:-1;
  const x0=lower?p.x+p.vx*p.duration:p.x,z0=lower?p.z+p.vz*p.duration:p.z;
  const wave=Math.sin(TAU*q)*Math.sin(Math.PI*q)**2;
  const waveV=(TAU*Math.cos(TAU*q)*Math.sin(Math.PI*q)**2+Math.PI*Math.sin(TAU*q)*Math.sin(TAU*q))/duration;
  const vx=direction*p.vx*(1-2*q)+10*waveV,vz=direction*p.vz*(1-2*q),level=lower?24:259;
  const base=lower?24:p.y,depth=lower?a.size*.19:0;
  const recovery=smooth(s/2)*smooth((duration-s)/2);
  const dip=5*Math.sin(Math.PI*clamp(s/3))*Math.exp(-s*.2);
  const incoming=lower?Math.PI/2-Math.atan2(p.vy-p.g*p.duration,Math.hypot(p.vx,p.vz)):Math.PI/2+Math.atan2(p.vy,Math.hypot(p.vx,p.vz));
  const outgoing=lower?Math.PI/2+Math.atan2(p.vy-p.g*p.duration,Math.hypot(p.vx,p.vz)):Math.PI/2-Math.atan2(p.vy,Math.hypot(p.vx,p.vz));
  const pitch=Math.PI/2+(incoming-Math.PI/2)*(1-smooth(s/3))+(outgoing-Math.PI/2)*smooth((s-duration+3)/3);
  const state=s<5?'dive':s>duration-4?'gather':'swim';
  return {x:x0+direction*p.vx*duration*q*(1-q)+10*wave,z:z0+direction*p.vz*duration*q*(1-q),
    y:base-depth*recovery-dip,level,state,heading:Math.atan2(vx,vz),pitch,roll:0,activity:state==='gather'?.9:.6,surface:state==='swim',impactAge:s<3?s:null};
}
export function motionAt(a,t,heightAt){
  if(a.type==='swim')return swim(a,t);
  if(a.type==='shore')return shoreState(a,t,heightAt);
  const p=transferRoute(a),u=mod(t-p.start,p.period),d=p.duration;
  if(u<=d)return flight(a,p,u);
  if(u<d+p.lowerSwim)return basinLoop(a,p,u-d,p.lowerSwim,true);
  if(u<2*d+p.lowerSwim)return flight(a,p,u-d-p.lowerSwim,true);
  // 回程也走完整越坝弧线，随后在上游游动蓄力；整个循环无重置、瞬移或穿坝。
  return basinLoop(a,p,u-2*d-p.lowerSwim,p.period-2*d-p.lowerSwim,false);
}

