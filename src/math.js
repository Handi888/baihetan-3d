import { PARAMS as P } from './config.js';
import {bankContourOffset} from './bank-layout.js';
import {naturalHeight} from './reservoir/landscape.js';
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const mix = (a,b,t) => a+(b-a)*t;
export const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
export function section(y) {
  const d=P.dam, t=clamp(y/d.height,0,1), topR=d.crestArcLength/(2*d.halfAngle);
  const topWidth=topR*Math.sin(d.halfAngle);
  const halfWidth=d.baseHalfWidth+(topWidth-d.baseHalfWidth)*Math.pow(t,d.spanExponent);
  const angle=d.halfAngle*(0.7+0.3*t), radius=halfWidth/Math.sin(angle);
  const crown=-topR*(1-Math.cos(d.halfAngle))+d.verticalLean*(1-t)+d.verticalBow*Math.sin(Math.PI*t);
  const thickness=d.topThickness+(d.bottomThickness-d.topThickness)*Math.pow(1-t,d.thicknessExponent);
  return { halfWidth, angle, radius, crown, thickness };
}
// side +1 = upstream radial surface, -1 = downstream; 0 = centreline.
export function damPoint(u,y,side=0,extra=0) {
  const s=section(y), a=u*s.angle, r=s.radius+side*s.thickness/2+extra;
  return [r*Math.sin(a),y,s.crown+s.radius-r*Math.cos(a)];
}
export function faceZ(x,y,side) {
  const s=section(y),r=s.radius+side*s.thickness/2;
  const a=Math.asin(clamp(x/r,-Math.sin(s.angle),Math.sin(s.angle)));
  return s.crown+s.radius-r*Math.cos(a);
}
export function riverCentre(z) {
  const strength=smooth(200,1450,Math.abs(z));
  // The distant river turns behind the ridges instead of ending as a straight
  // wedge at the terrain boundary. The dam abutments remain at their original coordinates.
  return strength*(155*Math.sin(z/690)+48*Math.sin(z/270));
}
export function riverBottomHalfWidth(z) {
  return 72-23*(1-smooth(130,380,Math.abs(z)))+smooth(100,1800,-z)*91+smooth(250,1500,z)*(11+9*Math.sin(z/290));
}
export function originalTerrainHeight(x,z) {
  const topWidth=section(P.dam.height).halfWidth;
  const flank=x<riverCentre(z)?-1:1;
  const dist=Math.abs(x-riverCentre(z)), base=riverBottomHalfWidth(z)+bankContourOffset(z,flank), d=dist-base;
  if(d<=0) return -12+3*Math.sin(z/145)+2*Math.cos(x/33);
  const influence=smooth(65,530,Math.abs(z));
  const span=(topWidth-65)*(1-influence*.28)+influence*(26*Math.sin(z/230+flank)+13*Math.sin(z/87+flank*.3));
  let h=P.dam.height*Math.pow(d/span,1/P.dam.spanExponent);
  if(h>370) h=370+205*(1-Math.exp(-(h-370)/410));
  const distant=smooth(260,730,dist);
  const ridge=(90*Math.sin(z/390+flank*.7)+47*Math.sin(z/173-flank)+44*Math.sin(x/181+z/217)+24*Math.sin(x/95-z/146));
  h+=ridge*distant;
  // Higher, irregular background shoulders frame the excavated canyon. This
  // term is zero at both abutments and is not a displacement of any civil structure.
  h+=smooth(430,1350,dist)*(185+74*Math.sin(z/610+flank*1.3)+42*Math.sin(x/280-z/410));
  h+=influence*smooth(20,240,d)*(13*Math.sin(z/67+x/87)+6*Math.sin(z/27+x/42));
  // Actual rock relief outside the engineered faces: coherent ledges and fissures,
  // with zero perturbation at the dam joints or at building foundations.
  const natural=smooth(390,510,h)*(1-smooth(1500,2100,dist));
  h+=natural*(7*Math.sin(x*.11+z*.047)+4*Math.sin(x*.23-z*.13)+2.5*Math.sin(x*.49+z*.29));
  // Monotone stepped excavation profile: a steep riser followed by a real flat berm.
  // Kept before small building benches so those foundations remain horizontal.
  const rise=P.terrain.benchRise,cell=Math.floor(h/rise),fraction=h/rise-cell;
  const fractionBench=P.terrain.benchFraction+.12*smooth(35,100,z);
  const stepped=rise*(cell+Math.min(1,fraction/(1-fractionBench)));
  const excavation=(1-smooth(560,1000,Math.abs(z)))*smooth(25,65,h)*(1-smooth(420,490,h));
  h=mix(h,stepped,excavation);
  // 支护之间保留细碎裸岩起伏。幅度远小于坡面梯度，岸线仍以同一
  // 三角网格求交；墙身采用独立设计放样，不随这层风化纹理抖动。
  const cutRelief=excavation*smooth(75,125,h)*(1-smooth(395,445,h));
  h+=cutRelief*(.65*Math.sin(x*.38+z*.26)+.38*Math.sin(x*.77-z*.43));
  // Small engineered benches support the visible bank buildings; no floating slabs.
  const bx=flank*(topWidth+48);
  const bench=(1-smooth(31,59,Math.abs(x-bx)))*(1-smooth(23,47,Math.abs(z+12)));
  h=mix(h,P.dam.height*1.245,bench);
  // Cut horizontal permanent operation plazas into the slope; support slabs meet the ground.
  for(const p of P.details.platforms){
    const weight=(1-smooth(p.width/2-5,p.width/2+14,Math.abs(x-p.x)))*(1-smooth(p.length/2-5,p.length/2+16,Math.abs(z-p.z)));
    h=mix(h,Math.min(h,p.y-1.1),weight);
  }
  const shafts=P.details.shafts,shaftBench=(1-smooth(21,34,Math.abs(x-shafts.x)))*(1-smooth(20,30,Math.abs(z-shafts.z)));
  h=mix(h,Math.min(h,shafts.level-1),shaftBench);
  return h;
}
/** 坝址保持原坐标；库区局部原点移至 (0,259,-5000)。
 * -1800 至 -3600 为连续过渡带，且切出通往开阔湖湾的蜿蜒水道。
 * 这是照片约束的空间组合，连接段位置并非测绘坐标。
 */
export function reservoirChannelX(z){
  const a=riverCentre(-1800);
  return z>=-3500?mix(a,1250,smooth(1800,3500,-z)):mix(1250,700,smooth(3500,5000,-z));
}
export function terrainHeight(x,z){
  if(z>=-1800)return originalTerrainHeight(x,z);
  const t=smooth(1800,3600,-z),lake=P.water.upstream+naturalHeight(x,z+5000);
  let h=t===1?lake:mix(originalTerrainHeight(x,z),lake,t);
  if(z>-5050){
    const floor=mix(-12,P.water.upstream-65,smooth(1800,3400,-z));
    const width=155+32*Math.sin(z/137)+17*Math.sin(z/63);
    const distance=Math.max(0,Math.abs(x-reservoirChannelX(z))-width);
    const valley=floor+Math.pow(distance,1.13)*.55;
    h=mix(h,Math.min(h,valley),smooth(1800,2200,-z));
  }
  return h;
}
export function shoreline(z,level,side) {
  const center=riverCentre(z);
  let lo=0,hi=P.terrain.halfExtent-Math.abs(center);
  for(let i=0;i<28;i++){const m=(lo+hi)/2;if(terrainHeight(center+side*m,z)<level)lo=m;else hi=m;}
  return center+side*(lo+hi)/2;
}
export function makeOpenings() {
  return Object.entries(P.outlets).flatMap(([kind,spec])=>Array.from({length:spec.count},(_,i)=>{
    const u=(i-(spec.count-1)/2)*spec.spacing;
    return {kind,index:i,u,u0:u-spec.halfWidth,u1:u+spec.halfWidth,y0:spec.bottom,y1:spec.top};
  }));
}
/** Single source of truth for the six crest wells and their seven separating piers.
 * All u values are the SAME parameter used by the actual surface-outlet holes.
 * Dimensions follow radial / tangential directions, rather than world-axis boxes.
 */
export function crestGateLayout(){
  const spec=P.outlets.surface, radius=section(P.dam.height).radius;
  const wells=makeOpenings().filter(o=>o.kind==='surface');
  const pierHalfU=(spec.spacing-2*spec.halfWidth)/2;
  const piers=Array.from({length:spec.count+1},(_,i)=>{
    const u=(i-spec.count/2)*spec.spacing;
    return {u,u0:u-pierHalfU,u1:u+pierHalfU,
      width:2*(radius+19)*Math.sin(pierHalfU*P.dam.halfAngle)};
  });
  return {wells,piers,halfDeck:spec.count*spec.spacing/2+.045};
}
export function makeDrainOpenings(){
  const out=[];
  for(const y of P.details.drainRows)for(let i=-10;i<=10;i++){
    const u=i*P.details.drainSpacing,half=.42/(section(y).radius*section(y).angle);
    if(makeOpenings().some(o=>u>o.u0-.008&&u<o.u1+.008&&y>o.y0-2&&y<o.y1+2))continue;
    out.push({kind:'drain',index:out.length,u,u0:u-half,u1:u+half,y0:y-.27,y1:y+.27});
  }return out;
}
export function crestLength(samples=20000) {
  let length=0,last=damPoint(-1,P.dam.height);
  for(let i=1;i<=samples;i++){const p=damPoint(-1+2*i/samples,P.dam.height);length+=Math.hypot(p[0]-last[0],p[2]-last[2]);last=p;}
  return length;
}
