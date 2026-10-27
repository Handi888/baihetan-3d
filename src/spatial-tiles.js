import * as THREE from 'three';

/** 仅把索引按空间分组，所有顶点属性共享，原三角形一面不删。
 * 视锥可跳过屏幕外的绘制；岸边的跨格三角形仍完整保留。
 */
export function spatialTiles(geometry,material,name,size=320){
  const root=new THREE.Group();root.name=name;
  const p=geometry.attributes.position,idx=geometry.index.array,buckets=new Map();
  const bucketAt=i=>`${Math.floor((p.getX(idx[i])+p.getX(idx[i+1])+p.getX(idx[i+2]))/(3*size))},${Math.floor((p.getZ(idx[i])+p.getZ(idx[i+1])+p.getZ(idx[i+2]))/(3*size))}`;
  for(let i=0;i<idx.length;i+=3){const key=bucketAt(i);if(!buckets.has(key))buckets.set(key,{count:0});buckets.get(key).count+=3;}
  for(const b of buckets.values()){b.indices=new Uint32Array(b.count);b.cursor=0;b.box=new THREE.Box3();}
  const v=new THREE.Vector3();
  for(let i=0;i<idx.length;i+=3){const b=buckets.get(bucketAt(i));for(let k=0;k<3;k++){b.indices[b.cursor++]=idx[i+k];b.box.expandByPoint(v.fromBufferAttribute(p,idx[i+k]));}}
  for(const [key,b] of buckets){const g=new THREE.BufferGeometry();for(const [key,attr] of Object.entries(geometry.attributes))g.setAttribute(key,attr);
    g.setIndex(new THREE.BufferAttribute(b.indices,1));g.boundingBox=b.box;g.boundingSphere=b.box.getBoundingSphere(new THREE.Sphere());
    const mesh=new THREE.Mesh(g,material);mesh.name=`${name} / ${key}`;mesh.receiveShadow=true;mesh.userData.spatialTile=true;root.add(mesh);
  }
  root.userData={...geometry.userData,spatialTiles:buckets.size,originalTriangles:idx.length/3};return root;
}
