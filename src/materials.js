import * as THREE from 'three';
import {rockTextures} from './surface-textures.js';
// PBR base colour, roughness and world-space texture relief. No remote assets.
export function proceduralMaterial(color,{rock=false,retaining=false,roughness=.87}={}){
  const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0,side:THREE.DoubleSide});
  m.onBeforeCompile=s=>{
    if(rock){const t=rockTextures();s.uniforms.rockAlbedo={value:t.color};s.uniforms.rockRelief={value:t.height};}
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorldPos; varying vec3 vWorldNormal; varying vec2 vFormUV;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorldPos=(modelMatrix*vec4(transformed,1.)).xyz;vWorldNormal=normalize(mat3(modelMatrix)*normal);vFormUV=uv;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWorldPos; varying vec3 vWorldNormal; varying vec2 vFormUV;
      ${rock?'uniform sampler2D rockAlbedo,rockRelief;':''}
      float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
    `).replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=vWorldPos;float relief=0.;
      ${rock?`
        vec3 w=pow(abs(normalize(vWorldNormal)),vec3(5.));w/=max(w.x+w.y+w.z,.001);
        vec3 tex=texture2D(rockAlbedo,p.zy*.085).rgb*w.x+texture2D(rockAlbedo,p.xz*.085).rgb*w.y+texture2D(rockAlbedo,p.xy*.085).rgb*w.z;
        relief=texture2D(rockRelief,p.zy*.085).r*w.x+texture2D(rockRelief,p.xz*.085).r*w.y+texture2D(rockRelief,p.xy*.085).r*w.z;
        float macro=noise3(p*.017),streak=noise3(vec3(p.x*.36,p.y*.008,p.z*.31));
        float engineered=(1.-smoothstep(500.,920.,abs(p.z)))*(1.-smoothstep(400.,470.,p.y));
        float growth=smoothstep(.23,.65,noise3(p*.012)*.55+noise3(p*.047)*.3+noise3(p*.16)*.15)*(1.-engineered*.98);
        // The reference banks have different exposed strata and mineral wash.
        // The colour transition follows the rock, never distorts the fixed geometry.
        vec3 cutRock=mix(vec3(.56,.51,.46),vec3(.48,.51,.53),smoothstep(-160.,160.,p.x));
        vec3 mineral=mix(vec3(.51,.46,.40),cutRock,engineered);
        mineral=mix(mineral,vec3(.065,.16,.09),growth*.72);
        float joints=pow(abs(sin(p.y*.16+p.z*.028+noise3(p*.022)*1.9)),36.);
        // Multiscale near-vertical seepage follows the excavation face. Pale
        // mineral wash and dark wet tracks are both visible in all four photos.
        float seepage=pow(noise3(vec3(p.x*.58,p.y*.006,p.z*.61)),2.5);
        float wash=pow(noise3(vec3(p.x*.22,p.y*.014,p.z*.27)),4.);
        float bore=pow(abs(sin((p.x+p.z)*2.1+noise3(p*.06)*2.)),24.);
        vec3 weathered=mineral*(.48+tex*1.1)*(1.+(macro-.5)*.48-(1.-streak)*engineered*.12-joints*.12-seepage*engineered*.45+wash*engineered*.3-bore*engineered*.05);
        float waterline=mix(259.,24.,smoothstep(-180.,10.,p.z));
        float rockBeach=exp(-abs(p.y-waterline-1.8)/3.8);
        weathered=mix(weathered,vec3(.36,.25,.18)*(tex+.55),rockBeach*.68);
        // 上游由工程裸岩平滑过渡到植被、梯田与岩岸；仍用同一地形壳。
        float district=smoothstep(1800.,3600.,-p.z),localY=p.y-259.;
        float fields=noise3(vec3(p.x*.013,localY*.001,p.z*.013))*.65+noise3(p*.031)*.35;
        float cliff=1.-smoothstep(.45,.78,vWorldNormal.y);
        vec3 grass=mix(vec3(.085,.15,.035),vec3(.28,.35,.105),fields);
        vec3 soil=mix(vec3(.24,.18,.10),vec3(.46,.38,.24),macro);
        vec3 terrainColor=mix(grass,soil,smoothstep(.42,.65,fields)*(1.-cliff)*.77);
        terrainColor=mix(terrainColor,weathered,cliff*.9);
        float terrace=(1.-smoothstep(.03,.17,fract((localY+.9)/10.5)))*smoothstep(30.,85.,localY);
        terrainColor=mix(terrainColor,soil,terrace*.38);
        terrainColor=mix(terrainColor,weathered*.68,(1.-smoothstep(-.3,3.,localY))*.85);
        diffuseColor.rgb*=mix(weathered,terrainColor,district);
        relief=relief*.34+noise3(p*.8)*.055;
      `:retaining?`
        // 2.4 m square formwork panels measured along the wall, not screen pixels.
        // Derivative filtering preserves thin joints without distant moire.
        vec2 cell=vFormUV/2.4,edge=min(fract(cell),1.-fract(cell));
        vec2 aa=max(fwidth(cell),vec2(.00001));
        vec2 seams=1.-smoothstep(vec2(.008),vec2(.008)+aa*1.1,edge);
        float joint=max(seams.x,seams.y);
        float panel=hash31(vec3(floor(cell),3.7));
        float rain=pow(noise3(vec3(p.x*.3,p.y*.009,p.z*.35)),3.);
        float fineRain=pow(noise3(vec3(p.x*.85,p.y*.018,p.z*.84)),5.);
        float grain=noise3(p*2.2);
        float mottling=noise3(p*.065);
        diffuseColor.rgb*=1.02+(panel-.5)*.065+(mottling-.5)*.12+(grain-.5)*.035-joint*.13-rain*.38-fineRain*.16;
        relief=grain*.012-joint*.012+rain*.015;
      `:`
        float grain=noise3(p*1.8),form=noise3(vec3(p.x*.52,p.y*.009,p.z*.52));
        float wet=smoothstep(.48,.83,form)*(1.-smoothstep(270.,291.,p.y));
        float lift=pow(abs(sin(p.y*3.14159265/3.2)),42.);
        float streak=pow(noise3(vec3(p.x*.84,p.y*.012,p.z*.84)),4.);
        float panel=noise3(vec3(floor(p.x/13.),floor(p.y/3.2),floor(p.z/13.)));
        diffuseColor.rgb*=.96+(grain-.5)*.045+(panel-.5)*.045-wet*.11-streak*.13-lift*.035;
        relief=(grain*.022+form*.018);
      `}
    `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+relief*.18,.55,.99);
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
      vec3 rx=cross(sy,normal),ry=cross(normal,sx);float determinant=dot(sx,rx);
      normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(relief)*rx+dFdy(relief)*ry));
    `);
  };
  m.customProgramCacheKey=()=>rock?'fractured-bank-rock-v7':retaining?'square-formwork-wall-v2':'cast-concrete-weather-v4';return m;
}
export function makeMaterials(){return {
  concrete:proceduralMaterial(0xc4c7c5),darkConcrete:proceduralMaterial(0x8b9294),rock:proceduralMaterial(0xb1b5b6,{rock:true}),
  retaining:proceduralMaterial(0xc7c6bd,{retaining:true,roughness:.9}),
  asphalt:new THREE.MeshStandardMaterial({color:0x878f89,roughness:.94}),rail:new THREE.MeshStandardMaterial({color:0x9ca9a7,roughness:.48,metalness:.68}),
  gate:new THREE.MeshStandardMaterial({color:0x34464a,roughness:.68,metalness:.5,side:THREE.DoubleSide}),sealed:proceduralMaterial(0xa6afa4),
  red:new THREE.MeshStandardMaterial({color:0xbd251d,roughness:.48,metalness:.35}),glass:new THREE.MeshStandardMaterial({color:0x305060,roughness:.18,metalness:.35}),
  white:new THREE.MeshStandardMaterial({color:0xdedfcf,roughness:.8}),joint:new THREE.MeshStandardMaterial({color:0x7e8680,roughness:1,side:THREE.DoubleSide}),
  recess:new THREE.MeshStandardMaterial({color:0x111e22,roughness:1,side:THREE.DoubleSide}),cable:new THREE.MeshStandardMaterial({color:0x687573,roughness:.57,metalness:.7}),
  rusty:new THREE.MeshStandardMaterial({color:0x785046,roughness:.88}),insulator:new THREE.MeshStandardMaterial({color:0x506f68,roughness:.23}),
  bluePaint:new THREE.MeshStandardMaterial({color:0x809fa4,roughness:.95}),yellow:new THREE.MeshStandardMaterial({color:0xc8a140,roughness:.7}),
};}
