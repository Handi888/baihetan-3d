import * as THREE from 'three';
import {noiseGLSL} from './materials.js';

/** 云层使用天空方向上的有限步长体积积分，具有厚度、阴影和透光。
 * 不使用排列的白球，也不把实拍天空照片贴成静态背景。
 */
export function createEnvironment(scene,renderer){
  scene.background=new THREE.Color(0xa9c8d8);scene.fog=new THREE.FogExp2(0xa9c7d5,.00019);
  scene.add(new THREE.HemisphereLight(0xd3e7f4,0x6c714e,1.0));
  const sun=new THREE.DirectionalLight(0xfff5dd,2.7);sun.position.set(-900,1700,700);sun.target.position.set(-140,0,400);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-1100,right:1100,top:950,bottom:-950,near:150,far:3500});sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.65;sun.shadow.bias=-.00008;scene.add(sun,sun.target);
  const cloudUniforms={uCloudTime:{value:0},uClouds:{value:1}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(16000,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:cloudUniforms,vertexShader:'varying vec3 vSkyWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vSkyWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:`
  varying vec3 vSkyWorld;uniform float uCloudTime,uClouds;
  ${noiseGLSL}
  float density(vec3 p){float body=fb(p*.0018+vec3(uCloudTime*.0005,0.,0.));float fine=n3(p*.0077);float cap=smoothstep(1560.,1710.,p.y)*(1.-smoothstep(2020.,2350.,p.y));return max(0.,body-.43+fine*.045)*4.0*cap;}
  void main(){
    vec3 dir=normalize(vSkyWorld-cameraPosition),light=normalize(vec3(-.4,.82,.25));
    vec3 sky=mix(vec3(.53,.70,.82),vec3(.055,.27,.60),smoothstep(0.,.85,dir.y));
    float glow=pow(max(0.,dot(dir,light)),64.);sky+=vec3(1.,.85,.61)*glow*.15;
    if(dir.y>.015&&uClouds>.5){
      float start=max(0.,(1550.-cameraPosition.y)/dir.y),stepLength=min(1500.,800./dir.y/12.);vec3 acc=vec3(0.);float trans=1.;
      for(int i=0;i<12;i++){
        vec3 p=cameraPosition+dir*(start+(float(i)+.5)*stepLength);float d=density(p),ahead=density(p+light*135.);
        float shade=clamp(.67+(d-ahead)*.72,.35,1.12);vec3 cloud=mix(vec3(.37,.47,.58),vec3(1.32,1.32,1.24),shade);
        float a=1.-exp(-d*stepLength*.0030);acc+=cloud*a*trans;trans*=1.-a;
      }
      sky=sky*trans+acc;
    }
    gl_FragColor=vec4(sky,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`}));sky.name='Ray-marched cumulus cloud sky';scene.add(sky);
  const width=128,height=64,pixels=new Uint8Array(width*height*4),c=new THREE.Color(),horizon=new THREE.Color(0xd7e3e5),zenith=new THREE.Color(0x78add5),ground=new THREE.Color(0x5b7048);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){const t=j/(height-1);c.copy(t<.5?zenith:ground).lerp(horizon,t<.5?t*2:(1-t)*2);const k=(j*width+i)*4;pixels[k]=c.r*255;pixels[k+1]=c.g*255;pixels[k+2]=c.b*255;pixels[k+3]=255;}
  const texture=new THREE.DataTexture(pixels,width,height);texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
  const gen=new THREE.PMREMGenerator(renderer);scene.environment=gen.fromEquirectangular(texture).texture;scene.environmentIntensity=.6;gen.dispose();texture.dispose();
  return {sun,sky,setClouds:v=>cloudUniforms.uClouds.value=v?1:0,update:t=>cloudUniforms.uCloudTime.value=t};
}
