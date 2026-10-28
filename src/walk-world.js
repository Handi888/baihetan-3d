import * as THREE from 'three';

// 只为可行走构筑物建立空间索引；天然地形直接复用原三角地形取样。
// 不在每帧遍历山体、水面或植被的数百万个三角形。
export function createWalkWorld(roots,heightAt,bounds=null){
  const cells=new Map(),size=32,a=new THREE.Vector3(),b=a.clone(),c=a.clone();
  const key=(x,z)=>`${Math.floor(x/size)},${Math.floor(z/size)}`;
  for(const root of roots)root.traverse(o=>{
    // 绘制时被远山遮住的墙仍须参与碰撞，不能把渲染 visible 当成物理开关。
    if(!o.isMesh||!/wall|berm|slab|road|platform|deck|building|tower|pier|abutment|crest|stair|arch shell|walk|path/i.test(o.name))return;
    for(let parent=o.parent;parent;parent=parent.parent)if(/Lattice transmission/.test(parent.name)&&!parent.visible)return;
    if(o.isInstancedMesh&&!/stair tread|road concrete barrier|guardrail post|handrail post/i.test(o.name))return;
    const g=o.geometry,p=g.attributes.position,idx=g.index;
    const matrix=new THREE.Matrix4(),local=new THREE.Matrix4();
    for(let instance=0;instance<(o.isInstancedMesh?o.count:1);instance++){
    if(o.isInstancedMesh){o.getMatrixAt(instance,local);matrix.multiplyMatrices(o.matrixWorld,local);}else matrix.copy(o.matrixWorld);
    for(let j=0;j<(idx?.count??p.count);j+=3){
      const read=(v,k)=>v.fromBufferAttribute(p,idx?idx.getX(j+k):j+k).applyMatrix4(matrix);
      read(a,0);read(b,1);read(c,2);
      const tri=new THREE.Triangle(a.clone(),b.clone(),c.clone()),normal=tri.getNormal(new THREE.Vector3());
      const t={tri,normal,minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y)};
      const minX=Math.floor(Math.min(a.x,b.x,c.x)/size),maxX=Math.floor(Math.max(a.x,b.x,c.x)/size),minZ=Math.floor(Math.min(a.z,b.z,c.z)/size),maxZ=Math.floor(Math.max(a.z,b.z,c.z)/size);
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const k=`${x},${z}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(t);}
    }
    }
  });
  const ray=new THREE.Ray(),hit=new THREE.Vector3(),point=new THREE.Vector3(),closest=new THREE.Vector3();
  // groundHeight 对网格外的采样会夹到边缘，不能把这个值当成虚空中的地板。
  // 未传 bounds 的调用保持旧行为，便于使用独立构件和碰撞测试场景。
  function contains(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&(!bounds||x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ);}
  function floor(x,z,ceiling=Infinity){
    if(!contains(x,z))return -Infinity;
    let y=heightAt(x,z);if(y>ceiling)y=-Infinity;
    ray.origin.set(x,Number.isFinite(ceiling)?ceiling:4000,z);ray.direction.set(0,-1,0);
    for(const t of cells.get(key(x,z))||[]){if(t.normal.y<.35||t.minY>ceiling||t.maxY<y)continue;
      if(ray.intersectTriangle(t.tri.a,t.tri.b,t.tri.c,false,hit)&&hit.y<=ceiling&&hit.y>y)y=hit.y;
    }return y;
  }
  function blocked(x,z,feet){
    if(!contains(x,z))return true;
    if(heightAt(x,z)>feet+.48)return true;
    const candidates=new Set();for(const dx of [-.36,.36])for(const dz of [-.36,.36])for(const t of cells.get(key(x+dx,z+dz))||[])candidates.add(t);
    for(const t of candidates){if(Math.abs(t.normal.y)>.8||t.maxY<feet+.48||t.minY>feet+1.75)continue;
      for(const h of [.55,1.05,1.55]){point.set(x,feet+h,z);t.tri.closestPointToPoint(point,closest);if(point.distanceToSquared(closest)<.36**2)return true;}
    }return false;
  }
  return {floor,blocked,contains,cellCount:cells.size};
}
