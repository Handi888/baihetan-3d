import * as THREE from 'three';

/** 厂房地坪倒影。仅在大厅模式和相机改变时刷新一张小纹理；
 * 使用同一 Scene 的原位构件，不复制模型，也不绘制整个山谷。 */
export function createHallReflection(model,lighting){
  const rt=new THREE.WebGLRenderTarget(768,512,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false});
  const u=model.floorReflection,mirror=new THREE.PerspectiveCamera(),normal=new THREE.Vector3(0,1,0);
  const direction=new THREE.Vector3(),target=new THREE.Vector3(),plane=new THREE.Plane(),clip=new THREE.Vector4(),q=new THREE.Vector4();
  const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  const lastEye=new THREE.Vector3(Infinity,Infinity,Infinity),lastRotation=new THREE.Quaternion(),lastProjection=new THREE.Matrix4();
  const floors=[];model.root.traverse(o=>{if(/带机坑的发电机层楼板|厂房端部安装场地坪/.test(o.name))floors.push(o);});
  let dirty=true,lastBank=-1,lastUpdate=-Infinity;
  u.uHallReflection.value=rt.texture;
  return {disable(){u.uHallReflectionReady.value=0;dirty=true;},update(renderer,scene,camera,bank){
    const now=performance.now(),level=93;
    if(camera.position.y<=level+.2){u.uHallReflectionReady.value=0;dirty=true;return;}
    const moved=lastEye.distanceToSquared(camera.position)>.0025||lastRotation.angleTo(camera.quaternion)>.0001||!lastProjection.equals(camera.projectionMatrix);
    if(bank===lastBank&&!dirty&&(!moved||now-lastUpdate<180))return;
    mirror.copy(camera,false);mirror.position.copy(camera.position);mirror.position.y=2*level-camera.position.y;
    camera.getWorldDirection(direction);direction.reflect(normal);target.copy(mirror.position).add(direction);
    mirror.up.set(0,1,0).transformDirection(camera.matrixWorld).reflect(normal);mirror.lookAt(target);mirror.updateMatrixWorld();mirror.matrixWorldInverse.copy(mirror.matrixWorld).invert();
    u.uHallReflectionMatrix.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // 斜近裁面仅用于离屏倒影；不触碰库区水体或岸线三角形。
    plane.set(normal,-level).applyMatrix4(mirror.matrixWorldInverse);clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const e=mirror.projectionMatrix.elements;q.set((Math.sign(clip.x)+e[8])/e[0],(Math.sign(clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);clip.multiplyScalar(2/clip.dot(q));e[2]=clip.x;e[6]=clip.y;e[10]=clip.z+1-.0001;e[14]=clip.w;mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    const states=scene.children.map(o=>[o,o.visible]),floorStates=floors.map(o=>[o,o.visible]);
    const previousTarget=renderer.getRenderTarget(),shadows=renderer.shadowMap.enabled,background=scene.background,fog=scene.fog,auto=renderer.autoClear;
    const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
    try{
      for(const [o] of states)o.visible=o===model.root||o===lighting;
      for(const [o] of floorStates)o.visible=false;
      scene.background=null;scene.fog=null;renderer.shadowMap.enabled=false;renderer.autoClear=true;
      renderer.setClearColor(0x182732,1);renderer.setRenderTarget(rt);renderer.clear();renderer.render(scene,mirror);
      u.uHallReflectionReady.value=1;
    }finally{
      for(const [o,v] of states)o.visible=v;for(const [o,v] of floorStates)o.visible=v;
      scene.background=background;scene.fog=fog;renderer.shadowMap.enabled=shadows;renderer.autoClear=auto;renderer.setClearColor(clear,alpha);renderer.setRenderTarget(previousTarget);
    }
    lastEye.copy(camera.position);lastRotation.copy(camera.quaternion);lastProjection.copy(camera.projectionMatrix);lastBank=bank;lastUpdate=now;dirty=false;
  },dispose(){rt.dispose();}};
}
