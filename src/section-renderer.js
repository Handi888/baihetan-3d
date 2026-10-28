import * as THREE from 'three';

/** 山体透视不能让原本藏在山下的整片水面显露出来。
 * 先用原地形写入深度，再绘制完整水网格；随后清深度、绘制地下设备与透明岩体。
 * 全程使用同一 Scene、同一相机、同一地形，水面没有删三角形、裁切或 shader discard。
 */
export function createSectionRenderer({scene,renderer,terrain,water,sky}){
  const depthOnly=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,side:THREE.DoubleSide});
  const clearColor=new THREE.Color();
  const reflections=new Set();water.traverse(o=>{const u=o.material?.userData?.uniforms?.uHasReflection;if(u)reflections.add(u);});
  return {render(camera){
    const states=scene.children.map(o=>[o,o.visible]),background=scene.background,override=scene.overrideMaterial,auto=renderer.autoClear,shadows=renderer.shadowMap.enabled;
    renderer.getClearColor(clearColor);const alpha=renderer.getClearAlpha();
    const reflectionState=[...reflections].map(u=>[u,u.value]);
    function only(root){for(const [o,v] of states)o.visible=o.isLight?v:o===root;}
    try{
      renderer.autoClear=false;renderer.shadowMap.enabled=false;scene.background=null;scene.overrideMaterial=null;
      renderer.setClearColor(background?.isColor?background:0x9cb9c5,1);renderer.clear();
      only(sky);renderer.render(scene,camera);
      only(terrain);scene.overrideMaterial=depthOnly;renderer.render(scene,camera);
      only(water);scene.overrideMaterial=null;for(const [u] of reflectionState)u.value=0;renderer.render(scene,camera);
      // 岩体原位透视；仅对地下教学层重置深度，避免再次遮住机组。
      renderer.clearDepth();for(const [o,v] of states)o.visible=v&&o!==water&&o!==sky;
      renderer.render(scene,camera);
    }finally{
      for(const [o,v] of states)o.visible=v;scene.background=background;scene.overrideMaterial=override;
      for(const [u,v] of reflectionState)u.value=v;
      renderer.autoClear=auto;renderer.shadowMap.enabled=shadows;renderer.setClearColor(clearColor,alpha);
    }
  }};
}
