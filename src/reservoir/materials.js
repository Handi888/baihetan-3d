import * as THREE from 'three';

export const noiseGLSL=`
float h3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fb(vec3 p){return n3(p)*.53+n3(p*2.03+17.)*.27+n3(p*4.11+31.)*.13+n3(p*8.19)*.07;}
`;

/** PBR 地形：草被、裸土、岩石是独立的色彩/高度/粗糙度场。
 * 纹理在世界坐标生成，固定几何不会因为距离或画质而改变。
 */
export function landscapeMaterial(){
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,metalness:0});
  m.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld,vTerrainNormal;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.)).xyz;vTerrainNormal=normalize(mat3(modelMatrix)*normal);');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWorld,vTerrainNormal;\n'+noiseGLSL).replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=vWorld;float macro=fb(p*.009),grain=n3(p*1.5),cliff=1.-smoothstep(.45,.78,vTerrainNormal.y);
      float fields=fb(vec3(p.x*.013,p.y*.001,p.z*.013));
      vec3 grass=mix(vec3(.055,.095,.026),vec3(.20,.25,.075),fields);
      vec3 soil=mix(vec3(.19,.14,.082),vec3(.36,.30,.19),macro);
      float joints=pow(abs(sin(p.y*.58+p.x*.023+fb(p*.06)*3.)),24.);
      float fractures=pow(1.-n3(p*.24),7.)+pow(1.-n3(p*.63),9.);
      vec3 rock=mix(vec3(.17,.16,.14),vec3(.39,.35,.27),fb(p*.10));rock*=1.-joints*.22-fractures*1.4;
      float terraces=(1.-smoothstep(.03,.17,fract((p.y+.9)/10.5)))*smoothstep(30.,85.,p.y);
      float cultivated=smoothstep(.40,.64,fields)*(1.-cliff)*smoothstep(20.,90.,p.y);
      vec3 color=mix(grass,soil,cultivated*.77);color=mix(color,rock,cliff*.88);
      color=mix(color,soil,terraces*.38);color*=.80+macro*.42+(grain-.5)*.08;
      float wet=1.-smoothstep(-.3,3.,p.y);color=mix(color,rock*.62,wet*.85);
      // 日照下云影尺度为数百米，保持前景草木与远处山脊的层次。
      color*=.86+.14*smoothstep(.28,.66,fb(vec3(p.x*.0015,2.,p.z*.0015)));
      diffuseColor.rgb*=color;
      float relief=cliff*(fb(p*.5)*.36-joints*.12-fractures*.15)+(1.-cliff)*grain*.035;
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),rx=cross(sy,normal),ry=cross(normal,sx);float determinant=dot(sx,rx);
      normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(relief)*rx+dFdy(relief)*ry));
    `);
  };m.customProgramCacheKey=()=> 'landscape-pbr-01';return m;
}
export function stoneMaterial(){const m=new THREE.MeshStandardMaterial({color:0x858274,roughness:.96});m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rockP;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nrockP=(modelMatrix*vec4(transformed,1.)).xyz;\n#ifdef USE_INSTANCING\nrockP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;\n#endif');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 rockP;\n'+noiseGLSL).replace('#include <color_fragment>',`#include <color_fragment>
  float r=fb(rockP*1.4),cut=pow(abs(sin(rockP.y*4.+rockP.x*.5+n3(rockP*2.)*2.)),24.);diffuseColor.rgb*=.65+r*.65-cut*.23;diffuseColor.rgb*=mix(.48,1.,smoothstep(258.9,261.8,rockP.y));
  `);};m.customProgramCacheKey=()=> 'shore-rock-pbr-01';return m;}

export function makeMaterials(){return {land:landscapeMaterial(),rock:stoneMaterial(),path:new THREE.MeshStandardMaterial({color:0x707d7c,roughness:.97}),curb:new THREE.MeshStandardMaterial({color:0xc7c4b5,roughness:.9}),white:new THREE.MeshStandardMaterial({color:0xf0f0e3,roughness:.72}),wood:new THREE.MeshStandardMaterial({color:0x796448,roughness:.89}),metal:new THREE.MeshStandardMaterial({color:0x53645f,roughness:.45,metalness:.6}),wall:new THREE.MeshStandardMaterial({color:0xd7d6c9,roughness:.9}),roof:new THREE.MeshStandardMaterial({color:0x6e6a61,roughness:.94}),windows:new THREE.MeshStandardMaterial({color:0x374c51,roughness:.35,metalness:.2})};}
