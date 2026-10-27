// 直接构建浏览器所用模型，验证真实几何和两部分的空间连接。
import {build} from 'esbuild';
import {writeFile,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
await mkdir(path.join(root,'docs/qa'),{recursive:true});
const source=String.raw`
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeMaterials} from './src/materials.js';
import {createTerrain} from './src/terrain.js';
import {createDam} from './src/dam.js';
import {createBuildings} from './src/buildings.js';
import {createWater} from './src/water.js';
import {createReservoirDistrict} from './src/reservoir-district.js';
import {groundHeight,groundData} from './src/ground-surface.js';
import {originalTerrainHeight,terrainHeight,reservoirChannelX,makeOpenings,damPoint} from './src/math.js';
import {retainingWallSpecs} from './src/bank-layout.js';
import {PARAMS as P,PRESETS} from './src/config.js';
import {writeFileSync} from 'node:fs';
const report={passed:false,scenes:1,meshes:0,instances:0,renderTriangles:0,nonFinite:0,badNormals:0,degenerateTriangles:0,lod:0,water:[],channel:[],checks:[]};
console.time('Build');const m=makeMaterials(),terrain=createTerrain(m),dam=createDam(m),buildings=createBuildings(m),water=createWater(),district=createReservoirDistrict(),scene=new THREE.Scene();
scene.add(terrain,dam,buildings,water.group,district.group);scene.updateMatrixWorld(true);console.timeEnd('Build');
const seen=new Set(),seenAttributes=new Set(),seenNormals=new Set();scene.traverse(o=>{
  if(o.isLOD)report.lod++;
  if(!o.isMesh)return;report.meshes++;
  const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,idx=g.index;
  report.instances+=o.isInstancedMesh?o.count:0;
  report.renderTriangles+=(idx?idx.count:p.count)/3*(o.isInstancedMesh?o.count:1);
  if(seen.has(g))return;seen.add(g);
  for(const attr of Object.values(g.attributes)){if(seenAttributes.has(attr))continue;seenAttributes.add(attr);for(const v of attr.array)if(!Number.isFinite(v))report.nonFinite++;}
  if(n&&!seenNormals.has(n)){seenNormals.add(n);for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.75)report.badNormals++;}
  const count=idx?idx.count:p.count;
  for(let i=0;i<count;i+=3){
    const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;
    assert(Math.max(a,b,c)<p.count);
    const u=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)],v=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];
    if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-10){report.degenerateTriangles++;console.log('Collapsed',o.name,i);}
  }
});
assert.equal(report.nonFinite,0);assert.equal(report.badNormals,0);assert.equal(report.degenerateTriangles,0);assert.equal(report.lod,0);
report.checks.push('Finite geometry, valid indices and normals, no collapsed triangles or LOD');
for(const group of [dam,buildings])group.traverse(o=>assert(!o.isInstancedMesh,'Civil members stay independent'));
assert.equal(retainingWallSpecs().length,40);report.retaining=terrain.userData.retaining;
assert.equal(terrain.userData.realPortalCuts,26);
for(let z=-850;z<=1050;z+=31)for(let x=-580;x<=580;x+=37)assert.equal(terrainHeight(x,z),originalTerrainHeight(x,z));
report.checks.push('Original dam, 40 retaining courses and 26 bank openings preserved; engineered terrain unchanged');
for(const mesh of water.surfaces){const g=mesh.geometry,d=g.userData;assert.equal(g.index.count/3,2*(d.columns-1)*(d.rows-1));assert.equal(d.removedTriangles,0);assert.equal(d.shoreClipping,false);const actual=mesh.tiles.children.flatMap(t=>Array.from(t.geometry.index.array));
assert.equal(actual.length,g.index.count,'All water indices survive tiling');
// Compare complete ordered triples including duplicates; no missing or invented edge faces.
const triples=indices=>{const a=[];for(let i=0;i<indices.length;i+=3)a.push(indices[i]+','+indices[i+1]+','+indices[i+2]);return a.sort();};
assert.deepEqual(triples(actual),triples(g.index.array));
report.water.push({...d,tiles:mesh.tiles.children.length,vertices:g.attributes.position.count});}
assert.equal(water.group.children.length,2);assert.equal(district.group.getObjectsByProperty('name','Reservoir').length,0);
report.checks.push('Exactly one upstream sheet and one downstream sheet; no extra water at the district; no shoreline triangle deletion');
for(let z=-1800;z>=-5050;z-=25){const x=reservoirChannelX(z),y=groundHeight(x,z);assert(y<P.water.upstream-15,'The connecting channel must stay submerged');report.channel.push({x,z,depth:P.water.upstream-y});}
assert.equal(district.group.position.y,P.water.upstream);assert.equal(district.group.position.z,-5000);
report.checks.push('Continuous submerged connection from canyon to lake; district uses upstream water datum');
const shell=dam.getObjectByName('Layered arch shell'),ray=new THREE.Raycaster();
for(const o of makeOpenings().filter(o=>o.kind!=='sealed')){const y=(o.y0+o.y1)/2,a=new THREE.Vector3(...damPoint(o.u,y,1,12)),b=new THREE.Vector3(...damPoint(o.u,y,-1,-12));ray.set(a,b.clone().sub(a).normalize());ray.far=a.distanceTo(b);assert.equal(ray.intersectObject(shell).length,0);}
report.checks.push('Six surface outlets and seven deep outlets remain open through the dam shell');
for(const name of ['unified','reservoir','park','rockshore']){const [x,y,z]=PRESETS[name].eye;assert(y>groundHeight(x,z),'Preset must stay above ground: '+name);}
report.vegetation=district.vegetation.group.userData;report.features=district.features.userData;report.channelSamples=report.channel.length;report.channelMinDepth=Math.min(...report.channel.map(p=>p.depth));delete report.channel;
report.passed=true;writeFileSync('docs/qa/UNIFIED_MODEL_AUDIT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
`;
const result=await build({stdin:{contents:source,resolveDir:root,sourcefile:'unified-audit-entry.js'},bundle:true,write:false,format:'esm',platform:'node',alias:{three:path.join(root,'vendor/three.module.js')}});
const out=path.join(root,'scripts/.unified-audit-generated.mjs');await writeFile(out,result.outputFiles[0].text);try{await import(pathToFileURL(out).href+'?v='+Date.now());}finally{await rm(out,{force:true});}
