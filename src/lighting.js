import * as THREE from 'three';
export function createLighting(scene,renderer){
  scene.background=new THREE.Color(0xbacbd4);scene.fog=new THREE.FogExp2(0xbacbd4,.00012);
  const hemi=new THREE.HemisphereLight(0xd8e3e8,0x626256,.8);scene.add(hemi);
  // 顺着下游观察方向的高角度日光，使浅灰混凝土与深色破碎岩层可辨。
  const sun=new THREE.DirectionalLight(0xfff8ef,2.8);sun.position.set(-550,1900,1050);sun.target.position.set(0,100,-50);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-820;sun.shadow.camera.right=820;sun.shadow.camera.top=780;sun.shadow.camera.bottom=-690;sun.shadow.camera.near=100;sun.shadow.camera.far=3200;sun.shadow.normalBias=1.2;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0xb8deeb,.25);fill.position.set(700,600,-900);scene.add(fill);
  // Local sky radiance for metal members and rough PBR reflections, generated once.
  if(renderer){
    const w=128,h=64,pixels=new Uint8Array(w*h*4),skyColor=new THREE.Color(),top=new THREE.Color(0x8bb9d3),horizon=new THREE.Color(0xdde3d4),ground=new THREE.Color(0x6e7864);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const t=y/(h-1);skyColor.copy(t<.5?top:ground).lerp(horizon,t<.5?t*2:(1-t)*2);const k=(y*w+x)*4;pixels[k]=skyColor.r*255;pixels[k+1]=skyColor.g*255;pixels[k+2]=skyColor.b*255;pixels[k+3]=255;}
    const texture=new THREE.DataTexture(pixels,w,h,THREE.RGBAFormat);texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
    const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(texture).texture;scene.environmentIntensity=.45;texture.dispose();pmrem.dispose();
  }
  const sky=new THREE.Mesh(new THREE.SphereGeometry(6500,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 c=mix(vec3(.79,.85,.84),vec3(.28,.51,.65),smoothstep(-.04,.85,h)); gl_FragColor=vec4(c,1.); }'}));scene.add(sky);
  return {sun,sky};
}
