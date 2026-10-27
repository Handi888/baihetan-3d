import * as THREE from 'three';

export function decodeCreatureMesh(buffer){
  const h=new Uint32Array(buffer,0,4);if(h[0]!==0x43525452||h[1]!==1)throw new Error('Invalid local mesh');
  const vertices=h[2],indices=h[3];let offset=16;
  const take=(Type,n)=>{const a=new Type(buffer,offset,n);offset+=n*Type.BYTES_PER_ELEMENT;return a;};
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(take(Float32Array,vertices*3),3));geometry.setAttribute('normal',new THREE.BufferAttribute(take(Float32Array,vertices*3),3));geometry.setAttribute('uv',new THREE.BufferAttribute(take(Float32Array,vertices*2),2));geometry.setIndex(new THREE.BufferAttribute(take(Uint32Array,indices),1));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export async function loadCreatureAsset(){
  const meshURL='assets/creature/runtime/creature.mesh';
  const response=await fetch(meshURL);if(!response.ok)throw new Error('Creature mesh unavailable');
  const geometry=decodeCreatureMesh(await response.arrayBuffer()),loader=new THREE.TextureLoader();
  const [map,roughnessMap,metalnessMap]=await Promise.all(['color.jpg','roughness.jpg','metallic.jpg'].map(file=>loader.loadAsync('assets/creature/runtime/'+file)));
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const material=new THREE.MeshStandardMaterial({map,roughnessMap,metalnessMap,color:0xffffff,roughness:.72,metalness:.18,envMapIntensity:.65});
  return {geometry,material};
}
