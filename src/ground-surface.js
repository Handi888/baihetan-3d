import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {terrainHeight,riverCentre} from './math.js';
import {bankMandatoryStations} from './bank-layout.js';
import {mapLimits,connectRows} from './map-domain.js';

// One fixed triangulation is shared by visible terrain, shoreline clipping and placements.
// No LOD or simplification. Far-region spacing only bounds the original terrain domain.
let cached,sampler;
function axis(min,max,nearMin,nearMax){
  const a=[min];let x=min;
  while(x<max){let next=x+(x>=nearMin&&x<nearMax?P.terrain.nearStep:P.terrain.farStep);
    if(x<nearMin&&next>nearMin)next=nearMin;if(x<nearMax&&next>nearMax)next=nearMax;
    x=Math.min(next,max);a.push(x);
  }return a;
}
export function groundData(){
  if(cached)return cached;const steps=groundDataSteps();let next;do{next=steps.next();}while(!next.done);return next.value;
}
export function* groundDataSteps(){
  if(cached)return cached;
  const t=P.terrain,xs=axis(-t.halfExtent,t.halfExtent,-1100,1100);
  // 公园和坝址各有一段固定精细网格；同一网格贯穿连接水道，没有重叠地形壳。
  const zs=[...new Set([...axis(-t.upstreamExtent,-3400,-5600,-3400),...axis(-3400,t.downstreamExtent,t.nearZMin,t.nearZMax),-3600,-1800,...bankMandatoryStations()])].sort((a,b)=>a-b);
  const heights=new Float32Array(xs.length*zs.length),positions=new Float32Array(heights.length*3),indices=[],rows=[];
  const limits=zs.map(z=>mapLimits(z)),firstZ=zs[limits.findIndex(Boolean)];
  for(let j=0;j<zs.length;j++){for(let i=0;i<xs.length;i++){
    const k=j*xs.length+i,b=limits[j];let h=terrainHeight(xs[i],zs[j]);
    // 保留山脊内侧原形，只把外缘 280 m 变为背坡，避免截成直立高墙。
    // 工程区、实际岸线及公园内部均在这个过渡带以内。
    if(b&&xs[i]>=b.min&&xs[i]<=b.max){const edge=Math.min(xs[i]-b.min,b.max-xs[i],zs[j]-firstZ);const t=Math.max(0,Math.min(1,edge/280));h=-88+(h+88)*t*t*(3-2*t);}
    heights[k]=h;positions.set([xs[i],heights[k],zs[j]],k*3);
  }if(j%8===0)yield j/zs.length;}
  // 取样缓存仍供工程构件快速查询；送入 GPU 的地形只包含走廊内的顶点。
  // 内圈三角形与原网格完全相同，外圈不同长度的行连接为无洞条带。
  for(let j=0;j<zs.length;j++){
    const bounds=limits[j];if(!bounds)continue;
    const row=[];for(let i=0;i<xs.length;i++)if(xs[i]>=bounds.min&&xs[i]<=bounds.max)row.push(j*xs.length+i);
    if(row.length>1){if(rows.length)connectRows(rows.at(-1),row,k=>positions[k*3],indices);rows.push(row);}
  }
  const boundary=[...rows[0],...rows.slice(1).map(r=>r.at(-1)),...rows.at(-1).slice(0,-1).reverse(),...rows.slice(1,-1).reverse().map(r=>r[0])];
  const area=indices.reduce((sum,_,i)=>{if(i%3)return sum;const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;return sum+Math.abs((positions[b]-positions[a])*(positions[c+2]-positions[a+2])-(positions[c]-positions[a])*(positions[b+2]-positions[a+2]))/2;},0);
  cached={xs,zs,heights,positions,indices:new Uint32Array(indices),rows,boundary,area,nx:xs.length,nz:zs.length};
  sampler={xs,zs,heights,nx:xs.length,nz:zs.length};return cached;
}
// 后续漫游、植被和岸线只需要高度缓存。渲染网格已经拥有自己的紧凑缓冲。
// 如开发工具再次请求完整 groundData，仍可用相同参数重建。
export function releaseGroundConstructionData(){cached=null;}
function interval(a,value){let lo=0,hi=a.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(a[mid]<=value)lo=mid;else hi=mid;}return Math.min(lo,a.length-2);}
export function groundHeight(x,z){
  const d=sampler||groundData(),i=interval(d.xs,x),j=interval(d.zs,z),k=j*d.nx+i;
  const u=Math.max(0,Math.min(1,(x-d.xs[i])/(d.xs[i+1]-d.xs[i]))),v=Math.max(0,Math.min(1,(z-d.zs[j])/(d.zs[j+1]-d.zs[j])));
  const a=d.heights[k],b=d.heights[k+1],c=d.heights[k+d.nx],e=d.heights[k+d.nx+1];
  return u+v<=1?a+(b-a)*u+(c-a)*v:e+(c-e)*(1-u)+(b-e)*(1-v);
}
export function groundShoreline(z,level,side,center=riverCentre(z)){
  const limit=mapLimits(z,280),extent=limit?(side>0?limit.max-center:center-limit.min):P.terrain.halfExtent-Math.abs(center);
  // 自河道向山脊寻找第一次交点，避免把背坡的第二次交点当成岸线。
  let lo=0,hi=Math.min(24,extent);while(hi<extent&&groundHeight(center+side*hi,z)<level){lo=hi;hi=Math.min(extent,hi+24);}
  for(let i=0;i<32;i++){const x=(lo+hi)/2;if(groundHeight(center+side*x,z)<level)lo=x;else hi=x;}return center+side*(lo+hi)/2;
}
export function groundGeometry(){const d=groundData(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(d.positions,3));g.setIndex(new THREE.BufferAttribute(d.indices,1));g.computeVertexNormals();return g;}
