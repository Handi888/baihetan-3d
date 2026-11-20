import {PARAMS as P} from './config.js';
import {groundShoreline} from './ground-surface.js';

// 外部进水建筑与地下单机引水洞共用八个孔位，不能各自另算一套坐标。
export function intakeLayout(bank){
  const spec=P.details.intakes[bank],{side,z,length}=spec,level=P.dam.height; // 进水塔顶平台与坝顶同高 834 m
  const station=zz=>({x:groundShoreline(zz,P.water.upstream,side)-side*10,z:zz});
  const gates=Array.from({length:8},(_,i)=>{const p=station(z-length/2+(i+.5)*length/8);return {...p,y:P.water.levels.dead-545-22,index:i};});
  // 进口底槛约 743 m，低于死水位 765 m，水库消落时仍能取水（示意高程）。
  return {...spec,level,station,gates};
}
