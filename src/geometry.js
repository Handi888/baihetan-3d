import * as THREE from 'three';
export class MeshBuilder {
  constructor(){this.positions=[];this.uvs=[];this.indices=[];}
  quad(a,b,c,d,flip=false,uv=[[0,0],[1,0],[1,1],[0,1]]){
    const n=this.positions.length/3;for(const p of [a,b,c,d])this.positions.push(...p);for(const v of uv)this.uvs.push(...v);
    this.indices.push(...(flip?[n,n+2,n+1,n,n+3,n+2]:[n,n+1,n+2,n,n+2,n+3]));
  }
  geometry(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uvs,2));g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingSphere();return g;}
}
export function mesh(geometry,material,parent){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;if(parent)parent.add(m);return m;}
export function box(parent,material,size,position,rotationY=0){const m=mesh(new THREE.BoxGeometry(...size),material,parent);m.position.set(...position);m.rotation.y=rotationY;return m;}
export function line(parent,points,color=0x8c9189,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));parent.add(l);return l;}
/** Shared corner frames keep consecutive road / deck segments watertight.
 * The previous segment-by-segment offsets left triangular gaps on bends.
 * Only the continuous civil surface is built here; separate steel parts stay separate Meshes.
 */
export function ribbonEdges(points,width){
  const directions=points.slice(1).map((p,i)=>{
    const dx=p[0]-points[i][0],dz=p[2]-points[i][2],length=Math.hypot(dx,dz);
    if(length<1e-8)throw new Error('Road centreline contains a duplicate XZ station');
    return [dx/length,dz/length];
  });
  return points.map((p,i)=>{
    const a=directions[Math.max(0,i-1)],b=directions[Math.min(i,directions.length-1)];
    let nx=-a[1]-b[1],nz=a[0]+b[0],length=Math.hypot(nx,nz);
    if(length<1e-6){nx=-b[1];nz=b[0];length=1;}
    nx/=length;nz/=length;
    // Bound the miter at very acute corners to avoid a long, twisted triangle.
    const scale=Math.min(width, width/(2*Math.max(.5,nx*-b[1]+nz*b[0])));
    return [[p[0]+nx*scale,p[1],p[2]+nz*scale],[p[0]-nx*scale,p[1],p[2]-nz*scale]];
  });
}
export function ribbon(parent,points,width,material){
  const edges=ribbonEdges(points,width),b=new MeshBuilder();
  for(let i=0;i<edges.length-1;i++)b.quad(edges[i][0],edges[i+1][0],edges[i+1][1],edges[i][1]);
  const result=mesh(b.geometry(),material,parent);result.userData.edgeStations=edges;return result;
}
