import * as THREE from 'three';

/** 山体/建筑倒影只在相机或场景变化时刷新；活动个体用单独小画面更新。
 * 两张图保留各自深度，合成时岸坡仍可遮住活动物体。主水面几何不变。
 */
export function createWaterReflections(water,size=768,dynamicRoot=null){
  const normal=new THREE.Vector3(0,1,0),direction=new THREE.Vector3(),target=new THREE.Vector3();
  const clipPlane=new THREE.Plane(),clip=new THREE.Vector4(),q=new THREE.Vector4();
  const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  const lastWorld=new THREE.Matrix4(),lastProjection=new THREE.Matrix4();
  let dirty=true,lastUpdate=-Infinity,lastDynamic=-Infinity,occlusion=null;
  function buffer(){const rt=new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,generateMipmaps:false});rt.depthTexture=new THREE.DepthTexture(size,size,THREE.UnsignedIntType);return rt;}
  const passes=water.surfaces.map(mesh=>{
    const base=buffer(),moving=buffer(),uniforms=mesh.material.userData.uniforms,mirror=new THREE.PerspectiveCamera();
    uniforms.uReflection.value=base.texture;uniforms.uStaticDepth.value=base.depthTexture;uniforms.uDynamicReflection.value=moving.texture;uniforms.uDynamicDepth.value=moving.depthTexture;
    return {base,moving,uniforms,mirror,level:mesh.geometry.attributes.position.getY(0)};
  });
  function mirrorCamera(pass,camera){
    const {mirror,level,uniforms}=pass;mirror.copy(camera,false);mirror.position.copy(camera.position);mirror.position.y=2*level-camera.position.y;
    camera.getWorldDirection(direction);direction.reflect(normal);target.copy(mirror.position).add(direction);mirror.up.set(0,1,0).transformDirection(camera.matrixWorld).reflect(normal);mirror.lookAt(target);mirror.updateMatrixWorld();mirror.matrixWorldInverse.copy(mirror.matrixWorld).invert();
    uniforms.uReflectionMatrix.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    clipPlane.set(normal,-level).applyMatrix4(mirror.matrixWorldInverse);clip.set(clipPlane.normal.x,clipPlane.normal.y,clipPlane.normal.z,clipPlane.constant);
    const e=mirror.projectionMatrix.elements;q.set((Math.sign(clip.x)+e[8])/e[0],(Math.sign(clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);clip.multiplyScalar(2/clip.dot(q));e[2]=clip.x;e[6]=clip.y;e[10]=clip.z+1-.0001;e[14]=clip.w;mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
  }
  return {setOcclusion(value){occlusion=value;},invalidate(){dirty=true;},update(renderer,scene,camera,now=performance.now(),force=false){
    if(scene.overrideMaterial)return;camera.updateMatrixWorld();
    const moved=!lastWorld.equals(camera.matrixWorld)||!lastProjection.equals(camera.projectionMatrix);
    const refreshBase=force||((dirty||moved)&&now-lastUpdate>240),refreshDynamic=force||now-lastDynamic>120;
    if(!refreshBase&&!refreshDynamic)return;
    const previousTarget=renderer.getRenderTarget(),previousShadowUpdate=renderer.shadowMap.autoUpdate,waterVisible=water.group.visible,background=scene.background;
    const previousColor=renderer.getClearColor(new THREE.Color()),previousAlpha=renderer.getClearAlpha();
    water.group.visible=false;renderer.shadowMap.autoUpdate=false;
    try{
      for(const pass of passes){
        if(camera.position.y<=pass.level+.1){pass.uniforms.uHasReflection.value=0;continue;}
        if(refreshBase){
          mirrorCamera(pass,camera);pass.mirror.layers.set(0);scene.background=background;
          if(dynamicRoot)dynamicRoot.visible=false;
          occlusion?.update(pass.mirror);renderer.setClearColor(previousColor,previousAlpha);renderer.setRenderTarget(pass.base);renderer.clear();renderer.render(scene,pass.mirror);pass.uniforms.uHasReflection.value=1;
          if(dynamicRoot)dynamicRoot.visible=true;
        }
        if(refreshDynamic||refreshBase){
          // Layer 1 只有共享实例模型、水花及灯光，避免重复绘制整座山谷。
          pass.mirror.layers.set(1);scene.background=null;renderer.setClearColor(0x000000,0);renderer.setRenderTarget(pass.moving);renderer.clear();renderer.render(scene,pass.mirror);pass.uniforms.uHasDynamic.value=1;
        }
      }
    }finally{water.group.visible=waterVisible;if(dynamicRoot)dynamicRoot.visible=true;scene.background=background;renderer.setClearColor(previousColor,previousAlpha);renderer.shadowMap.autoUpdate=previousShadowUpdate;renderer.setRenderTarget(previousTarget);}
    if(refreshBase){lastWorld.copy(camera.matrixWorld);lastProjection.copy(camera.projectionMatrix);lastUpdate=now;dirty=false;}lastDynamic=now;
  },dispose(){passes.forEach(p=>{p.base.dispose();p.moving.dispose();});}};
}
