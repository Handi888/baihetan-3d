import {spatialTiles} from './spatial-tiles.js';
import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {faceZ} from './math.js';
import {groundData,groundHeight} from './ground-surface.js';
export function waterGeometry(upstream){
  const level=upstream?P.water.upstream:P.water.downstream;
  const data=groundData(),xs=data.xs;
  const rows=upstream?[...data.zs.filter(z=>z<=-220),null]:[null,...data.zs.filter(z=>z>=100)];
  const n=xs.length*rows.length,positions=new Float32Array(n*3),normals=new Float32Array(n*3),depths=new Float32Array(n),indices=new Uint32Array((xs.length-1)*(rows.length-1)*6);
  let k=0;
  // 完整索引网格延伸到岩岸、挡墙和植物下方。岸线由深度测试自然遮挡，
  // 不按水深删三角形，不对岸线做裁切，也不在着色器中 discard。
  // 唯一外边界是坝体实际分水面：两侧保留各自的水位，不能把两水位接成斜坡。
  for(let j=0;j<rows.length;j++)for(let i=0;i<xs.length;i++){
    const x=xs[i],z=rows[j]??faceZ(x,level,upstream?1:-1),a=j*xs.length+i;
    positions.set([x,level,z],a*3);normals[a*3+1]=1;depths[a]=Math.max(0,level-groundHeight(x,z));
    if(i<xs.length-1&&j<rows.length-1){const b=a+1,c=a+xs.length,d=c+1;indices.set([a,c,b,b,c,d],k);k+=6;}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  g.setAttribute('waterDepth',new THREE.BufferAttribute(depths,1));g.setIndex(new THREE.BufferAttribute(indices,1));g.computeBoundingSphere();
  g.userData={columns:xs.length,rows:rows.length,completeTriangles:indices.length/3,removedTriangles:0,shoreClipping:false,level,method:'complete indexed sheet beneath banks; curved dam perimeter; depth occlusion only'};return g;
}
function waterMaterial(upstream){
  const a=P.water.appearance;
  const uniforms={
    uTime:{value:0},uDeep:{value:new THREE.Color(upstream?a.deepColor:a.downstreamColor)},uShallow:{value:new THREE.Color(upstream?a.shallowColor:a.downstreamShallow)},
    uReflection:{value:null},uReflectionMatrix:{value:new THREE.Matrix4()},uHasReflection:{value:0},
    uDynamicReflection:{value:null},uStaticDepth:{value:null},uDynamicDepth:{value:null},uHasDynamic:{value:0},
    uHorizon:{value:new THREE.Color(a.horizonColor)},uZenith:{value:new THREE.Color(a.zenithColor)},
    uBank:{value:new THREE.Color(a.bankColor)},uBrightness:{value:a.brightness},uSkyIntensity:{value:a.skyIntensity},
    uWaveSlope:{value:a.waveSlope},uWaveScale:{value:a.wavelengthScale},uWaveSpeed:{value:a.speed},
    uAbsorptionDepth:{value:a.absorptionDepth},uF0:{value:Math.pow((a.ior-1)/(a.ior+1),2)},
  };
  // Opaque depth tint: the supplied close-up does not establish reservoir clarity.
  // Normal-only ripples preserve the complete sheet and its fixed dam boundary.
  const m=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:a.roughness,metalness:0,ior:a.ior,envMapIntensity:0});
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
      attribute float waterDepth; varying float vWaterDepth; varying vec3 vWP;
    `).replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vWP=(modelMatrix*vec4(transformed,1.)).xyz; vWaterDepth=waterDepth;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWP; varying float vWaterDepth;
      uniform sampler2D uReflection; uniform mat4 uReflectionMatrix; uniform float uHasReflection;
      uniform sampler2D uDynamicReflection,uStaticDepth,uDynamicDepth;uniform float uHasDynamic;
      uniform float uTime, uBrightness, uSkyIntensity, uWaveSlope, uWaveScale, uWaveSpeed, uAbsorptionDepth, uF0;
      uniform vec3 uDeep, uShallow, uHorizon, uZenith, uBank;
      float waterHash(vec2 p){
        vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);
        return fract((p3.x+p3.y)*p3.z);
      }
      // Analytic quintic-noise gradient: irregular ripples with no repeated image tile.
      vec2 rippleGradient(vec2 p){
        vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
        vec2 du=30.*f*f*(f*(f-2.)+1.);
        float a=waterHash(i),b=waterHash(i+vec2(1,0)),c=waterHash(i+vec2(0,1)),d=waterHash(i+vec2(1,1));
        return du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx);
      }
      vec2 rippleBand(vec2 p,mat2 rotation,float frequency,float amplitude,vec2 drift){
        vec2 q=rotation*p*frequency+drift*uTime*uWaveSpeed;
        float footprint=max(length(dFdx(q)),length(dFdy(q)));
        float waveVisibility=1.-smoothstep(.12,.8,footprint);
        return transpose(rotation)*rippleGradient(q)*amplitude*waveVisibility;
      }
      vec3 waterNormal(vec2 worldXZ){
        vec2 p=worldXZ/max(uWaveScale,.05);
        p+=vec2(sin(p.y*.37+p.x*.21),sin(p.x*.29-p.y*.31))*.35;
        vec2 slope=rippleBand(p,mat2(.8,-.6,.6,.8),.85,.68,vec2(.13,.04));
        slope+=rippleBand(p+vec2(17,31),mat2(.36,.933,-.933,.36),1.8,.43,vec2(-.12,.19));
        slope+=rippleBand(p+vec2(7,53),mat2(.94,-.342,.342,.94),3.9,.24,vec2(.15,-.12));
        slope+=rippleBand(p+vec2(41,13),mat2(.63,.777,-.777,.63),8.1,.13,vec2(-.14,-.13));
        return normalize(vec3(-slope.x*uWaveSlope,1.,-slope.y*uWaveSlope));
      }
      // Analytic sky/bank colour reflection, not a reflection of scene geometry.
      vec3 reflectedEnvironment(vec3 ray){
        float az=atan(ray.z,ray.x);
        float bankHorizon=.30+.10*sin(az*3.1)+.055*sin(az*7.3);
        vec3 sky=mix(uHorizon,uZenith,smoothstep(.02,.85,ray.y));
        float cloud=sin(ray.x*5.5+ray.z*3.7+sin(ray.z*8.)*.35);
        sky=mix(sky,uHorizon,smoothstep(.38,.85,cloud)*.34);
        return mix(uBank*.72,sky,smoothstep(bankHorizon-.065,bankHorizon+.065,ray.y))*uSkyIntensity;
      }
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float shallow=exp(-max(vWaterDepth,0.)/max(uAbsorptionDepth,.1));
      float bodyVariation=1.+.024*sin(vWP.x*.047+sin(vWP.z*.025))+.018*sin(vWP.z*.061-vWP.x*.03);
      diffuseColor.rgb*=mix(uDeep,uShallow,shallow)*bodyVariation;
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 worldWaterNormal=waterNormal(vWP.xz);
      normal=normalize(mat3(viewMatrix)*worldWaterNormal);
    `).replace('#include <opaque_fragment>',`
      vec3 waterEye=normalize(cameraPosition-vWP);
      float ndv=clamp(dot(worldWaterNormal,waterEye),0.,1.);
      float fresnel=uF0+(1.-uF0)*pow(1.-ndv,5.);
      vec3 reflection=reflectedEnvironment(reflect(-waterEye,worldWaterNormal));
      vec4 projected=uReflectionMatrix*vec4(vWP,1.);
      vec2 reflectionUV=projected.xy/max(projected.w,.001);
      // Normal distortion fades out at banks; boundary geometry never moves.
      reflectionUV+=worldWaterNormal.xz*.014*smoothstep(0.,5.,vWaterDepth);
      if(uHasReflection>.5&&all(greaterThan(reflectionUV,vec2(.002)))&&all(lessThan(reflectionUV,vec2(.998)))){
        reflection=texture2D(uReflection,reflectionUV).rgb;
        if(uHasDynamic>.5){vec4 moving=texture2D(uDynamicReflection,reflectionUV);
          float inFront=step(texture2D(uDynamicDepth,reflectionUV).r,texture2D(uStaticDepth,reflectionUV).r+.00001);
          reflection=mix(reflection,moving.rgb,moving.a*inFront);
        }
      }
      outgoingLight=mix(outgoingLight*.9,reflection,clamp(fresnel+.015,0.,.92))*uBrightness;
      #include <opaque_fragment>
    `);
  };
  m.customProgramCacheKey=()=>`water-static-dynamic-reflections-v4`;m.userData.uniforms=uniforms;return m;
}
export function createWater(){
  const group=new THREE.Group();group.name='Continuous reservoir and separate downstream water level';
  const surfaces=[];
  for(const up of [true,false]){const geometry=waterGeometry(up),material=waterMaterial(up),tiles=spatialTiles(geometry,material,up?'Reservoir':'Downstream river');group.add(tiles);surfaces.push({geometry,material,tiles});}
  return {group,surfaces,update:t=>surfaces.forEach(m=>m.material.userData.uniforms.uTime.value=t)};
}
