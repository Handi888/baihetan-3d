import * as THREE from 'three';

// 仅在短按选点时射线求交，鼠标移动和每帧不遍历复杂地形。
export function createWalkSelection({canvas,camera,roots,water,walker,hud,dot,message,confirm,cancel}){
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),projected=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3(),matrix=new THREE.Matrix4();
  const surfaces=[];let down=null,wasSelecting=false;
  for(const root of [...roots,water])root.traverse(o=>{
    if(!o.isMesh)return;
    for(let p=o;p;p=p.parent)if(/Lattice transmission/.test(p.name))return;
    // 水面、裸岩、步道和结构表面可选；排除装饰线条、锚头与植物。
    if(root===water||/terrain surface|wall|berm|slab|road|platform|deck|building|tower|pier|abutment|crest|stair|arch shell|walk|path/i.test(o.name))surfaces.push(o);
  });
  canvas.addEventListener('pointerdown',e=>{if(walker.selecting&&e.button===0)down={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointercancel',()=>down=null);
  canvas.addEventListener('pointerup',e=>{
    const start=down;down=null;
    if(!walker.selecting||e.button!==0||!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;
    const rect=canvas.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
    camera.updateMatrixWorld();ray.setFromCamera(ndc,camera);
    const hit=ray.intersectObjects(surfaces,false)[0];
    if(hit){
      matrix.copy(hit.object.matrixWorld);
      if(hit.object.isInstancedMesh){const instance=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,instance);matrix.multiply(instance);}
      normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(matrix));
      let isWater=false;for(let p=hit.object;p;p=p.parent)if(p===water)isWater=true;
      if(normal.y>.4&&walker.pick(hit.point,isWater)){
        message.textContent=isWater?'光点已选定 · 确认后从这里入水漫游':'光点已选定 · 可重新点选，或确认从这里出发';
        confirm.disabled=false;return;
      }
    }
    message.textContent=walker.selected?'此处太陡或空间不足 · 保留原光点，请重新选择':'请选择平缓地面、步道、坝顶或水面';
  });
  confirm.onclick=()=>walker.confirm();cancel.onclick=()=>walker.stop();
  return {update(){
    const selecting=walker.selecting;hud.hidden=!selecting;
    if(selecting&&!wasSelecting){message.textContent='点击选择起点 · 拖动调整观察方向，滚轮缩放';confirm.disabled=true;}
    wasSelecting=selecting;dot.hidden=true;
    if(!selecting||!walker.selected)return;
    projected.copy(walker.selected);projected.y+=.14;projected.project(camera);
    if(projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)return;
    const r=canvas.getBoundingClientRect();dot.style.left=`${r.left+(projected.x+1)*r.width/2}px`;dot.style.top=`${r.top+(1-projected.y)*r.height/2}px`;dot.hidden=false;
  }};
}
