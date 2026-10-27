import * as THREE from 'three';

// 统一米制坐标。水位 Y=0；相机位于南侧滨水公园，朝 -Z 看向库区。
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const mix=(a,b,t)=>a+(b-a)*t;
export function hash(x,z=0){let n=Math.imul(Math.floor(x),374761393)+Math.imul(Math.floor(z),668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
export function noise(x,z){const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);}
export function fbm(x,z){return noise(x,z)*.52+noise(x*2.07+17,z*2.07)*.27+noise(x*4.19,z*4.19+31)*.14+noise(x*8.37,z*8.37)*.07;}
export function rng(seed=51829){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function southShore(x){return 535-225*Math.exp(-(((x+270)/390)**2))+42*Math.sin(x/125)+32*Math.sin(x/350);}
export function northShore(x){return -1950+150*Math.sin(x/510)+190*Math.sin(x/1180)+320*Math.exp(-(((x-1550)/620)**2));}
export function pathZ(x){return southShore(x)+62+19*Math.sin(x/140);}
export const DECK={x:-285,z:southShore(-285)+13,y:5.8,rx:27,rz:22};

/** 连续地形包含前景缓坡、西岸岩岬、对岸山坡和两列远山。
 * 地形范围一次固定创建，不随画质减少三角形，不使用 LOD。
 * 三个地理分带共用同一高程函数和边界顶点，边缘没有台阶接缝。
 */
export function naturalHeight(x,z){
  const ds=z-southShore(x),dn=northShore(x)-z;
  let south=ds<0?Math.max(-65,ds*.32):ds*.095+Math.max(0,ds-220)*.12;
  south+=smooth(30,220,ds)*(fbm(x*.008,z*.008)-.5)*26;
  const western=-1180-.17*(z+200)+110*Math.sin(z/390)-x;
  let west=western<0?Math.max(-65,western*.28):Math.pow(western,.82)*2.8;
  if(west>0)west=1100*(1-Math.exp(-west/1100));
  west*=.82+fbm(x*.002,z*.002)*.44;
  const east=x-(2750+250*Math.sin(z/610));
  let eastH=east<0?Math.max(-65,east*.25):Math.pow(east,.85)*2.3;
  if(eastH>0)eastH=1250*(1-Math.exp(-eastH/1250));
  const nearRidge=520*Math.exp(-(((dn-850)/800)**2))*(.58+fbm(x*.0017,9)*.72);
  const midRidge=1020*Math.exp(-(((dn-2500)/1050)**2))*(.58+fbm(x*.0012,17)*.6);
  const farRidge=1320*Math.exp(-(((dn-4400)/1100)**2))*(.62+fbm(x*.0015,38)*.57);
  let north=dn<0?Math.max(-65,dn*.30):Math.max(nearRidge,midRidge,farRidge)*smooth(0,440,dn);
  north+=smooth(30,300,dn)*(fbm(x*.009,z*.009)-.5)*72;
  // 梯田是高程中的窄平台，着色只强化作物、田埂和裸土的差异。
  const terraceWeight=smooth(25,100,north)*(1-smooth(630,840,north))*(.25+.58*smooth(.3,.65,noise(x*.0018,z*.0018)));
  const rise=10.5,cell=Math.floor(north/rise),f=north/rise-cell;
  north=mix(north,rise*(cell+Math.min(1,f/.60)),terraceWeight);
  let h=Math.max(-65,south,west,eastH,north);
  const shoreRelief=smooth(-2,10,h)*(1-smooth(35,85,h));
  h+=shoreRelief*(noise(x*.11,z*.11)-.5)*2.6;
  if(h>100)h+=(noise(x*.044,z*.044)-.5)*7.5;
  // 公园局部草坪保持低缓起伏，供步道自然贴地。
  return h;
}
// 合并模型时由主地形提供三角面高程，植被、道路和基础均落在同一地面上。
let surfaceSampler=null;
export function installSurfaceSampler(sample){surfaceSampler=sample;}
export function heightAt(x,z){return surfaceSampler?surfaceSampler(x,z):naturalHeight(x,z);}
export function surfaceNormal(x,z){return new THREE.Vector3(heightAt(x-1,z)-heightAt(x+1,z),2,heightAt(x,z-1)-heightAt(x,z+1)).normalize();}

function axis(min,max,nearMin,nearMax){const out=[min];let v=min;while(v<max){let next=v+(v>=nearMin&&v<nearMax?5:32);if(v<nearMin&&next>nearMin)next=nearMin;if(v<nearMax&&next>nearMax)next=nearMax;v=Math.min(next,max);out.push(v);}return out;}
export const XS=axis(-6200,6200,-1100,1100);
export const ZS=[...new Set([...axis(-7600,1700,-1000,1400),-4300,-1700])].sort((a,b)=>a-b);
export function gridGeometry(zmin,zmax,{water=false}={}){
  const zs=ZS.filter(z=>z>=zmin&&z<=zmax),positions=[],normals=[],uvs=[],depths=[],indices=[];
  for(let j=0;j<zs.length;j++)for(let i=0;i<XS.length;i++){
    const x=XS[i],z=zs[j],h=heightAt(x,z);positions.push(x,water?0:h,z);uvs.push(x*.03,z*.03);
    normals.push(...(water?[0,1,0]:surfaceNormal(x,z).toArray()));depths.push(Math.max(0,-h));
    if(j<zs.length-1&&i<XS.length-1){const a=j*XS.length+i,b=a+1,c=a+XS.length,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));g.setIndex(indices);g.computeBoundingSphere();
  g.userData={columns:XS.length,rows:zs.length,completeTriangles:2*(XS.length-1)*(zs.length-1),removedTriangles:0,water};return g;
}
export function createLandscape(material){const root=new THREE.Group();root.name='Three geographic mountain layers';for(const [name,a,b] of [['远景山峦',-7600,-4300],['中景梯田山坡',-4300,-1700],['近岸岩坡与公园',-1700,1700]]){const g=gridGeometry(a,b),m=new THREE.Mesh(g,material);m.name=name;m.receiveShadow=true;m.castShadow=true;root.add(m);}return root;}

export function mesh(g,m,parent,name=''){const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function box(parent,m,size,p,name=''){const o=mesh(new THREE.BoxGeometry(...size),m,parent,name);o.position.set(...p);return o;}
export function rod(parent,m,a,b,r=.12){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);const o=mesh(new THREE.CylinderGeometry(r,r,d.length(),10),m,parent);o.position.copy(va).add(vb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}

// 连续带状实体共用转角坐标，步道不会在每个折角留下三角缺口。
export function ribbon(parent,points,width,material){
  const edges=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);return [[p[0]-dz/l*width/2,p[1],p[2]+dx/l*width/2],[p[0]+dz/l*width/2,p[1],p[2]-dx/l*width/2]];});
  const p=[],uv=[],idx=[];for(let i=0;i<edges.length;i++){for(const v of edges[i])p.push(...v);uv.push(0,i,1,i);if(i<edges.length-1){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return mesh(g,material,parent,'Continuous contour path');
}
