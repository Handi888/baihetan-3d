import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {groundHeight} from './ground-surface.js';
import {installSurfaceSampler} from './reservoir/landscape.js';
import {makeMaterials} from './reservoir/materials.js';
import {createVegetation} from './reservoir/vegetation.js';
import {createShoreFeatures} from './reservoir/shore-features.js';

export const RESERVOIR_ORIGIN=new THREE.Vector3(0,P.water.upstream,-5000);
/** 库区只是主 Scene 的一个构件组：没有第二画布、第二场景或另一套水面。
 * 局部草木、道路、村落的基础取样主模型的实际三角地形。
 */
export function createReservoirDistrict(){
  installSurfaceSampler((x,z)=>groundHeight(x,z+RESERVOIR_ORIGIN.z)-RESERVOIR_ORIGIN.y);
  const group=new THREE.Group();group.name='Upstream reservoir landscape district';group.position.copy(RESERVOIR_ORIGIN);
  const vegetation=createVegetation(),features=createShoreFeatures(makeMaterials());group.add(vegetation.group,features);
  group.userData={origin:RESERVOIR_ORIGIN.toArray(),waterOwner:'main reservoir mesh',terrainOwner:'shared groundData',vegetation:vegetation.group.userData,features:features.userData};
  return {group,vegetation,features,update:vegetation.update};
}
