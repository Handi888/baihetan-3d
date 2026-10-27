import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {terrainHeight,riverCentre} from './math.js';
import {bankMandatoryStations} from './bank-layout.js';

// One fixed triangulation is shared by visible terrain, shoreline clipping and placements.
// No LOD or simplification. Far-region spacing only bounds the original terrain domain.
let cached;
function axis(min,max,nearMin,nearMax){
  const a=[min];let x=min;
  while(x<max){let next=x+(x>=nearMin&&x<nearMax?P.terrain.nearStep:P.terrain.farStep);
    if(x<nearMin&&next>nearMin)next=nearMin;if(x<nearMax&&next>nearMax)next=nearMax;
    x=Math.min(next,max);a.push(x);
  }return a;
}
export function groundData(){
  if(cached)return cached;
  const t=P.terrain,xs=axis(-t.halfExtent,t.halfExtent,-1100,1100);
  // 公园和坝址各有一段固定精细网格；同一网格贯穿连接水道，没有重叠地形壳。
  const zs=[...new Set([...axis(-t.upstreamExtent,-3400,-5600,-3400),...axis(-3400,t.downstreamExtent,t.nearZMin,t.nearZMax),-3600,-1800,...bankMandatoryStations()])].sort((a,b)=>a-b);
  const heights=new Float32Array(xs.length*zs.length),positions=new Float32Array(heights.length*3),indices=[];
  for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length;i++){
    const k=j*xs.length+i;heights[k]=terrainHeight(xs[i],zs[j]);positions.set([xs[i],heights[k],zs[j]],k*3);
    if(j<zs.length-1&&i<xs.length-1){const b=k+1,c=k+xs.length,d=c+1;indices.push(k,c,b,b,c,d);}
  }
  cached={xs,zs,heights,positions,indices,nx:xs.length,nz:zs.length};return cached;
}
function interval(a,value){let lo=0,hi=a.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(a[mid]<=value)lo=mid;else hi=mid;}return Math.min(lo,a.length-2);}
export function groundHeight(x,z){
  const d=groundData(),i=interval(d.xs,x),j=interval(d.zs,z),k=j*d.nx+i;
  const u=Math.max(0,Math.min(1,(x-d.xs[i])/(d.xs[i+1]-d.xs[i]))),v=Math.max(0,Math.min(1,(z-d.zs[j])/(d.zs[j+1]-d.zs[j])));
  const a=d.heights[k],b=d.heights[k+1],c=d.heights[k+d.nx],e=d.heights[k+d.nx+1];
  return u+v<=1?a+(b-a)*u+(c-a)*v:e+(c-e)*(1-u)+(b-e)*(1-v);
}
export function groundShoreline(z,level,side){
  const center=riverCentre(z);let lo=0,hi=P.terrain.halfExtent-Math.abs(center);
  for(let i=0;i<32;i++){const x=(lo+hi)/2;if(groundHeight(center+side*x,z)<level)lo=x;else hi=x;}return center+side*(lo+hi)/2;
}
export function groundGeometry(){const d=groundData(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(d.positions,3));g.setIndex(d.indices);g.computeVertexNormals();return g;}
