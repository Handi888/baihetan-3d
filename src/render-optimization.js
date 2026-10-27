import * as THREE from 'three';

/** 只实例化重复的小型锚具、踏步和栏杆柱。挡墙、压顶、马道板及接缝保持独立 Mesh。 */
export function instanceRepeatedDetails(root){
  const cells=new Map();
  for(const o of root.children){
    if(o.userData.spatialTile||!o.isMesh||o.isInstancedMesh||!/anchor|tendon|stair tread|guardrail post|handrail post|Road concrete barrier/i.test(o.name))continue;
    if(!['BoxGeometry','CylinderGeometry'].includes(o.geometry.type))continue;
    const key=[o.name,o.material.uuid,o.geometry.type,JSON.stringify(o.geometry.parameters),Math.floor(o.position.x/160),Math.floor(o.position.z/160)].join('|');
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(o);
  }
  let members=0,batches=0;
  for(const list of cells.values()){
    if(list.length<4)continue;
    const first=list[0],batch=new THREE.InstancedMesh(first.geometry,first.material,list.length);batch.name=first.name+' instances';batch.castShadow=batch.receiveShadow=true;
    list.forEach((o,i)=>{o.updateMatrix();batch.setMatrixAt(i,o.matrix);root.remove(o);});
    batch.computeBoundingSphere();root.add(batch);members+=list.length;batches++;
  }
  root.userData.detailInstancing={members,batches};return {members,batches};
}

/** 保守地形遮挡检测：只跳过完全藏在地形后方的远处小构件。
 * 不删面、不改 LOD，也不隐藏可见墙体；倒影相机单独计算其可见性。
 */
export function createTerrainOcclusion(roots,heightAt){
  const cells=new Map(),box=new THREE.Box3(),center=new THREE.Vector3();
  for(const root of roots)root.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);box.getCenter(center);
    if(box.getSize(new THREE.Vector3()).length()>400)return;
    const key=Math.floor(center.x/160)+','+Math.floor(center.z/160);
    if(!cells.has(key))cells.set(key,{bounds:new THREE.Box3(),objects:[]});const cell=cells.get(key);cell.bounds.union(box);cell.objects.push(o);
  });
  const groups=[...cells.values()].map(c=>({...c,sphere:c.bounds.getBoundingSphere(new THREE.Sphere())}));
  const lastEye=new THREE.Vector3(Infinity,Infinity,Infinity);
  return {update(camera){
    const eye=camera.position;
    if(lastEye.equals(eye))return;lastEye.copy(eye);
    for(const cell of groups){
      const p=cell.sphere.center,r=cell.sphere.radius,dx=p.x-eye.x,dz=p.z-eye.z,distance=Math.hypot(dx,dz);let hidden=false;
      if(distance>1100){
        for(let t=.08;t<.94;t+=.07){
          const x=eye.x+dx*t,z=eye.z+dz*t,top=eye.y+(p.y+r-eye.y)*t,spread=r*t;
          const low=Math.min(heightAt(x,z),heightAt(x-spread,z),heightAt(x+spread,z),heightAt(x,z-spread),heightAt(x,z+spread));
          if(low>top+18){hidden=true;break;}
        }
      }
      for(const o of cell.objects)o.visible=!hidden;
    }
  },cells:groups.length};
}
