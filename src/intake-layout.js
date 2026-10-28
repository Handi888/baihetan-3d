import {PARAMS as P} from './config.js';
import {groundShoreline} from './ground-surface.js';

// 外部进水建筑与地下单机引水洞共用八个孔位，不能各自另算一套坐标。
export function intakeLayout(bank){
  const spec=P.details.intakes[bank],{side,z,length}=spec,level=P.water.upstream+24;
  const station=zz=>({x:groundShoreline(zz,P.water.upstream,side)-side*10,z:zz});
  const gates=Array.from({length:8},(_,i)=>{const p=station(z-length/2+(i+.5)*length/8);return {...p,y:P.water.upstream-17,index:i};});
  return {...spec,level,station,gates};
}
