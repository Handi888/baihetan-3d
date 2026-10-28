// 用实际几何和动画验证教学模型；不启动浏览器，也不依赖远端资源。
import {build} from 'esbuild';
import {rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'scripts/.powerhouse-audit.mjs');
await build({stdin:{resolveDir:root,contents:`
import assert from 'node:assert/strict';
import {createPowerhouseModel,BANK_CENTRES,UNIT_Z} from './src/powerhouse-model.js';
import {intakeLayout} from './src/intake-layout.js';
import {createDischargeState} from './src/effects.js';
const model=createPowerhouseModel();
for(let bank=0;bank<2;bank++){
  const tubes=model.banks[bank].getObjectsByProperty('name','单洞单机 · 引水上平洞与竖井');
  assert.equal(tubes.length,8);tubes.forEach((tube,i)=>{const inlet=intakeLayout(bank).gates[i];assert.deepEqual(tube.userData.intake,[inlet.x,inlet.y,inlet.z]);assert(inlet.y<259);});
  assert.equal(model.banks[bank].getObjectsByProperty('name','尾水隧洞').length,bank===0?3:2);
  for(const tube of tubes){const p=tube.geometry.attributes.position;for(let i=0;i<p.count;i++)assert(!(Math.abs(p.getX(i))<20&&Math.abs(p.getZ(i))<208&&p.getY(i)>15&&p.getY(i)<75),'Penstock must stay outside generator hall');}
}
const discharge=createDischargeState();discharge.setEnabled(true);
discharge.update(.1,6.8);assert(discharge.value.opening>0&&discharge.value.opening<.03);assert.equal(discharge.value.mist,0);
for(let i=0;i<49;i++)discharge.update(.1,6.8);assert.equal(discharge.value.opening,1);assert.equal(discharge.value.impact,0);
for(let i=0;i<130;i++)discharge.update(.1,6.8);assert(discharge.value.mist>.9);
discharge.setEnabled(false);discharge.update(.1,6.8);assert(discharge.value.opening>.9&&discharge.value.impact>.9,'Airborne water survives gate closing');
for(let i=0;i<140;i++)discharge.update(.1,6.8);assert.equal(discharge.value.opening,0);assert.equal(discharge.value.impact,0);assert(discharge.value.mist>0&&discharge.value.mist<.7);
const frozen=discharge.value;discharge.update(0,6.8);assert.deepEqual(discharge.value,frozen);
for(let i=0;i<600;i++)discharge.update(.1,6.8);assert.equal(discharge.value.mist,0);
assert.equal(model.audit().totalUnits,16);assert.equal(model.halls.length,2);
for(const hall of model.halls){assert.equal(hall.getObjectsByProperty('name','带机坑的发电机层楼板').length,8);assert(hall.getObjectByName('完整拱顶衬砌'));}
let triangles=0,geometries=0;const seen=new Set();
model.root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(seen.has(g))return;seen.add(g);geometries++;
for(const attr of Object.values(g.attributes))for(const n of attr.array)assert(Number.isFinite(n),'All geometry attributes must be finite: '+o.name);
if(g.index)for(const index of g.index.array)assert(index<g.attributes.position.count,'Index within position buffer');
g.computeBoundingSphere();assert(Number.isFinite(g.boundingSphere.radius));});
model.update(1);const moving=model.audit();assert(moving.rotorAngle>0);assert.equal(moving.rotorAngle,moving.runnerAngle);assert.equal(moving.rotorAngle,moving.shaftAngle);assert.equal(moving.statorAngle,0);
model.update(1,false);assert.equal(model.audit().rotorAngle,moving.rotorAngle,'Pause freezes motion');
model.configure({gate:0});model.update(1);assert.equal(model.audit().rotorAngle,moving.rotorAngle,'Closed gates stop demonstration');
model.configure({gate:.25});model.update(1);const a=model.audit().rotorAngle;model.configure({gate:1});model.update(1);assert(Math.abs((a-moving.rotorAngle)-(model.audit().rotorAngle-a))<1e-9,'Synchronous generator speed is not a load control');
for(let bank=0;bank<2;bank++)for(let unit=0;unit<8;unit++){model.select(bank,unit);assert.equal(model.audit().selectedUnit,bank*8+unit+1);assert.equal(model.origin.x,BANK_CENTRES[bank][0]);assert.equal(model.origin.z,UNIT_Z[unit]);}
model.setMode('hall');assert(model.banks.every(b=>b.visible)&&!model.detailed.visible);
model.setMode('system');assert(model.banks.every(b=>b.visible));model.setMode('unit');assert(model.detailed.visible&&model.banks.every(b=>b.visible));
assert.equal(model.detailed.parent.name,'16 号机组','Detailed machinery belongs to selected physical assembly');assert(model.halls.every(h=>h.visible),'Unit section retains the surrounding halls');
model.configure({cut:true,explosion:1});assert(!model.detailed.getObjectByName('水流方向粒子').visible);assert(!model.detailed.getObjectByName('可移开的上半蜗壳').visible);
const up=model.anchor('stator').y;model.configure({cut:false,explosion:0});assert.equal(up-model.anchor('stator').y,15);assert(model.detailed.getObjectByName('可移开的上半蜗壳').visible);
assert(model.anchor('draft').y<model.anchor('runner').y&&model.anchor('runner').y<model.anchor('stator').y,'Water exits below runner, never through electrical generator');
export default {passed:true,units:16,geometries,triangles,checks:['finite geometry and indices','16 selectable units in two halls','runner/shaft/rotor share speed; stator stays fixed','pause and closed-gate stop','load does not change synchronous speed','mode visibility restoration','exploded flow disabled','water/electrical path separation']};
`},bundle:true,format:'esm',platform:'node',alias:{three:path.join(root,'vendor/three.module.js')},outfile:out});
try{const {default:report}=await import(pathToFileURL(out));await mkdir(path.join(root,'docs/qa'),{recursive:true});await writeFile(path.join(root,'docs/qa/POWERHOUSE_AUDIT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}finally{await rm(out,{force:true});}
