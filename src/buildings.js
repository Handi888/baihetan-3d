import * as THREE from 'three';
import {createCrest} from './crest.js';
import {createHydraulics} from './hydraulics.js';
import {createPowerlines} from './powerlines.js';
// Component groups preserve all independent member meshes; no BufferGeometry merge or LOD.
export function createBuildings(materials){
  const root=new THREE.Group();root.name='Photo-referenced civil and mechanical structures';
  root.add(createCrest(materials),createHydraulics(materials),createPowerlines(materials));return root;
}
