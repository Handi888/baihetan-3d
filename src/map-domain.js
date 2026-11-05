import {PARAMS as P} from './config.js';
import {terrainHeight} from './math.js';

// 地图是沿真实水道展开的连续带状区域，不再生成整张矩形山地。
// 在水岸外保留 0.5–0.8 km 的自然山脊；坝址另保留地下厂房的覆盖岩体。
// 这里只确定地图外圈，绝不以水深裁剪岸线三角形。
const STEP=32;
let rows;
function footprint(){
  if(rows)return rows;
  const wet=[];
  for(let z=-P.terrain.upstreamExtent;z<=P.terrain.downstreamExtent;z+=STEP){
    let min=Infinity,max=-Infinity;
    const level=z<-200?P.water.upstream:P.water.downstream;
    for(let x=-P.terrain.halfExtent;x<=P.terrain.halfExtent;x+=24){
      if(terrainHeight(x,z)<level+2){min=Math.min(min,x);max=Math.max(max,x);}
    }
    wet.push({z,min,max});
  }
  rows=wet.map(({z})=>{
    let min=Infinity,max=-Infinity;
    const radius=z<-3600?640:400;
    for(const w of wet){const dz=Math.abs(w.z-z);if(dz>radius||!Number.isFinite(w.min))continue;
      const margin=Math.sqrt(radius*radius-dz*dz)+100;
      min=Math.min(min,w.min-margin);max=Math.max(max,w.max+margin);
    }
    // 主厂房、进水建筑、高边坡、盘山公路和下游出口均在这段岩体中。
    const engineering=Math.max(0,1-Math.max(0,Math.abs(z-100)-1150)/300);
    if(engineering>0){min=Math.min(min,-1120*engineering);max=Math.max(max,1120*engineering);}
    // 完整保留公园步道（包括回转小径），不把树林、廊架截在地图边缘。
    if(z>=-4930&&z<=-3800){min=Math.min(min,-1240);max=Math.max(max,850);}
    return {z,min:Math.max(-P.terrain.halfExtent,min),max:Math.min(P.terrain.halfExtent,max)};
  });
  return rows;
}
export function mapLimits(z,inset=0){
  const a=footprint();
  if(z<a[0].z||z>P.terrain.downstreamExtent)return null;
  const i=Math.min(a.length-2,Math.max(0,Math.floor((z-a[0].z)/STEP))),t=Math.min(1,(z-a[i].z)/STEP);
  if(!Number.isFinite(a[i].min)||!Number.isFinite(a[i+1].min))return null;
  const min=a[i].min+(a[i+1].min-a[i].min)*t+inset,max=a[i].max+(a[i+1].max-a[i].max)*t-inset;
  return min<max?{min,max}:null;
}
export function withinMap(x,z,inset=48){const b=mapLimits(z,inset);return !!b&&x>=b.min&&x<=b.max&&z>=-P.terrain.upstreamExtent+inset&&z<=P.terrain.downstreamExtent-inset;}

// 两行的 X 样本数允许不同。双指针连接完整的条带，没有删去岸边的面，
// 也没有为了凑列数压扁顶点。相同 X 列处保持原来的两三角划分。
export function connectRows(a,b,xAt,indices){
  let i=0,j=0;
  while(i<a.length-1||j<b.length-1){
    if(j===b.length-1||(i<a.length-1&&xAt(a[i+1])<=xAt(b[j+1]))){indices.push(a[i],b[j],a[i+1]);i++;}
    else{indices.push(a[i],b[j],b[j+1]);j++;}
  }
}
