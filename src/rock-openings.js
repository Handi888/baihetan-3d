import * as THREE from 'three';
import {groundData} from './ground-surface.js';
import {portalSpecs,portalProfile,subtractPortal} from './portals.js';

/** Cut only the local exposed rock shell. Original grid vertices and indices
 * are preserved everywhere else; this is a surface construction, not a merge
 * of the independent tunnel, anchor, stair or railing meshes.
 */
export function excavatedGroundGeometry(){
  const d=groundData(),positions=Array.from(d.positions),indices=[],specs=portalSpecs().map(s=>({...s,profile:portalProfile(s)}));
  const portalZMin=Math.min(...specs.map(s=>s.position[2]-s.width/2)),portalZMax=Math.max(...specs.map(s=>s.position[2]+s.width/2));
  let cutTriangles=0;
  for(let i=0;i<d.indices.length;i+=3){
    // 远处库区不可能与坝址洞口相交。直接保留原索引，避免为每个远山
    // 三角形创建临时多边形；这是构建加速，不改变任何顶点或面。
    const ia=d.indices[i],ib=d.indices[i+1],ic=d.indices[i+2];
    const za=d.positions[ia*3+2],zb=d.positions[ib*3+2],zc=d.positions[ic*3+2];
    if(Math.max(za,zb,zc)<portalZMin||Math.min(za,zb,zc)>portalZMax){indices.push(ia,ib,ic);continue;}
    const ids=d.indices.slice(i,i+3),tri=ids.map(k=>Array.from(d.positions.subarray(k*3,k*3+3)));
    const zmin=Math.min(...tri.map(p=>p[2])),zmax=Math.max(...tri.map(p=>p[2])),ymin=Math.min(...tri.map(p=>p[1])),ymax=Math.max(...tri.map(p=>p[1]));
    const candidates=specs.filter(s=>zmax>s.position[2]-s.width/2&&zmin<s.position[2]+s.width/2&&ymax>s.position[1]&&ymin<s.position[1]+s.height&&tri.some(p=>Math.abs(p[0]-s.position[0])<s.depth+8));
    if(!candidates.length){indices.push(...ids);continue;}
    let fragments=[tri];
    for(const s of candidates)fragments=fragments.flatMap(p=>subtractPortal(p,s.profile));
    cutTriangles++;
    for(const polygon of fragments)for(let k=1;k<polygon.length-1;k++){
      const points=[polygon[0],polygon[k],polygon[k+1]].map(p=>p.map(Math.fround));
      const a=new THREE.Vector3(...points[0]),b=new THREE.Vector3(...points[1]),c=new THREE.Vector3(...points[2]);
      if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-12)continue;
      const start=positions.length/3;positions.push(...points[0],...points[1],...points[2]);indices.push(start,start+1,start+2);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Vertices entirely inside a cut have no incident face, hence no computed
  // normal. Give these unused vertices a finite normal without changing faces.
  const n=geometry.attributes.normal;for(let i=0;i<n.count;i++)if(n.getX(i)===0&&n.getY(i)===0&&n.getZ(i)===0)n.setXYZ(i,0,1,0);
  geometry.userData={realPortalCuts:specs.length,cutTriangles};return geometry;
}
