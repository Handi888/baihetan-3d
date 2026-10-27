/** 挡墙的实际放样面及水位交线。共享缓存保证水面裁剪使用可见墙面，
 * 而不是另一个近似岸线，也不在交界处设置退让距离。
 */
import {PARAMS as P} from './config.js';
import {groundData,groundShoreline} from './ground-surface.js';
import {retainingWallSpecs} from './bank-layout.js';

const cache=new Map();
export function wallSurface(spec){
  if(cache.has(spec.id))return cache.get(spec.id);
  const zs=groundData().zs.filter(z=>z>=spec.z0&&z<=spec.z1);
  // Include both water levels as exact rings in the wall topology.
  const ys=[...new Set([spec.bottom,spec.top,
    ...Array.from({length:Math.ceil((spec.top-spec.bottom)/2)},(_,i)=>Math.min(spec.top,spec.bottom+i*2)),
    ...[P.water.upstream,P.water.downstream].filter(y=>y>spec.bottom&&y<spec.top)])].sort((a,b)=>a-b);
  // 墙面按上下两条设计等高线放样；不将每个高度环直接贴到阶梯地形上。
  // 在原有 2–4 m 站点间只平顺细小锯齿，所有弯折站点仍完整保留。
  const contour=(z,y)=>[-8,-4,0,4,8].reduce((sum,d,i)=>sum+groundShoreline(z+d,y,spec.side)*[1,2,4,2,1][i],0)/10;
  const lower=zs.map(z=>contour(z,spec.bottom)-spec.side*spec.projection);
  const upper=zs.map(z=>contour(z,spec.top-.9)-spec.side*(spec.projection+.35));
  // 阶梯岩坡在墙面背后。逐站检查整幅高程，将面层整体移至岩体外缘，
  // 避免直线放样的中段被岩坡穿出；背面仍伸入岩体形成真实挡墙体积。
  let penetration=0;
  for(let i=0;i<zs.length;i++){
    for(const y of ys){const t=(y-spec.bottom)/(spec.top-spec.bottom),x=lower[i]+(upper[i]-lower[i])*t;
      penetration=Math.max(penetration,spec.side*(x-groundShoreline(zs[i],y,spec.side))+.25);}
  }
  for(let i=0;i<zs.length;i++){lower[i]-=spec.side*penetration;upper[i]-=spec.side*penetration;}
  const rows=ys.map(y=>{const t=(y-spec.bottom)/(spec.top-spec.bottom);return zs.map((z,i)=>lower[i]+(upper[i]-lower[i])*t);});
  const backRows=ys.map((y,j)=>zs.map((z,i)=>spec.side*Math.max(spec.side*rows[j][i]+spec.thickness,spec.side*groundShoreline(z,y,spec.side)+1.4)));
  // 模板缝的 U 坐标使用墙面累计弧长，在转弯处也保持约 2.4 m 方格。
  const lengths=[0];for(let i=1;i<zs.length;i++)lengths.push(lengths[i-1]+Math.hypot(zs[i]-zs[i-1],upper[i]-upper[i-1]));
  const surface={spec,zs,ys,rows,backRows,lengths};cache.set(spec.id,surface);return surface;
}
function bracket(array,value){let lo=0,hi=array.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(array[m]<=value)lo=m;else hi=m;}return Math.min(lo,array.length-2);}
export function wallFrontX(spec,z,y){
  const s=wallSurface(spec),i=bracket(s.zs,z),j=bracket(s.ys,y);
  const u=Math.max(0,Math.min(1,(z-s.zs[i])/(s.zs[i+1]-s.zs[i]))),v=Math.max(0,Math.min(1,(y-s.ys[j])/(s.ys[j+1]-s.ys[j])));
  const a=s.rows[j][i],b=s.rows[j][i+1],c=s.rows[j+1][i],d=s.rows[j+1][i+1];
  // Same diagonal as the actual front triangles: (a,b,d) and (a,d,c).
  return u>=v?a+(b-a)*u+(d-b)*v:a+(d-c)*u+(c-a)*v;
}
export function activeWaterWalls(level,upstream){
  return retainingWallSpecs().filter(s=>s.bottom<level&&s.top>level&&s.zone===(upstream?'upstream':'downstream'));
}
export function bankEnvelopeX(z,y,side){
  let x=groundShoreline(z,y,side);
  for(const w of retainingWallSpecs())if(w.side===side&&z>=w.z0&&z<=w.z1&&y>=w.bottom&&y<=w.top){
    const wx=wallFrontX(w,z,y);x=side>0?Math.min(x,wx):Math.max(x,wx);
  }
  return x;
}
export function retainingPortalSpecs(){
  const all=[];
  for(const side of [-1,1])for(const [layer,z] of [[1,176],[3,320],[5,456],[7,248],[9,408],[11,304]]){
    const wall=retainingWallSpecs().find(s=>s.id===`${side}-down-${layer}`);
    const radius=1.65,y=wall.bottom+Math.min(5.5,(wall.top-wall.bottom-radius*2)/2);
    all.push({side,wallId:wall.id,shape:'circle',position:[wallFrontX(wall,z,y+radius),y,z],
      width:radius*2,height:radius*2,depth:16,rotation:-side*Math.PI/2,name:'Circular retaining-wall drainage gallery'});
  }
  return all;
}
