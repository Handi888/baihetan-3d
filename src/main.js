import * as THREE from 'three';
import {PARAMS as P,PRESETS} from './config.js';
import {makeMaterials} from './materials.js';
import {createDam} from './dam.js';
import {createTerrain} from './terrain.js';
import {createWater} from './water.js';
import {createWaterReflections} from './water-reflections.js';
import {createEnvironment} from './reservoir/environment.js';
import {createReservoirDistrict} from './reservoir-district.js';
import {createCamera} from './camera.js';
import {crestLength,damPoint} from './math.js';
import {createBuildings} from './buildings.js';
import {createEffects} from './effects.js';
import {installInteractions} from './interaction.js';
import {groundHeight} from './ground-surface.js';
import {createCreatures} from './creatures.js';
import {createTerrainOcclusion} from './render-optimization.js';
import {createFirstPerson} from './first-person.js';
import {createWalkSelection} from './walk-selection.js';
import {installTouchWalking} from './touch-walking.js';

const $=s=>document.querySelector(s),canvas=$('#scene');
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
// 设备性能分级：移动端 / 低内存设备自动降负载，几何内容不做任何删减。
function detectTier(){
  const mem=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4;
  const coarse=matchMedia('(pointer:coarse)').matches,small=innerWidth<650;
  if(mem<=2||(coarse&&mem<=3&&cores<=4))return 'low';
  if(small||coarse||mem<=4)return 'medium';
  return 'high';
}
const tier=detectTier();
const reflectionSize=tier==='high'?768:512;
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}
catch(e){$('#loading').innerHTML='<strong>无法初始化 WebGL</strong><small>微信/QQ 内核过旧或未开启硬件加速，请点右上角“···”用系统浏览器打开，或升级 App</small>';throw e;}
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.debug.onShaderError=(gl,program,vs,fs)=>{const message=gl.getShaderInfoLog(fs)||gl.getProgramInfoLog(program);errors.push(message);console.error('Unified scene shader error:',message);};
// WebGL 上下文丢失（多为内存不足）：给出可恢复的提示，而不是黑屏卡死。
canvas.addEventListener('webglcontextlost',e=>{
  e.preventDefault();
  $('#restart-title').textContent='3D 渲染已中断';
  $('#restart-sub').textContent='通常是设备内存不足或切后台导致，点击按钮即可恢复。';
  $('#restart-overlay').classList.add('show');
});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){try{resize();reflections.invalidate();}catch{}}
});
const scene=new THREE.Scene(),materials=makeMaterials(),lighting=createEnvironment(scene,renderer),rig=createCamera(canvas);
scene.fog.density=.000065;
const terrain=createTerrain(materials),dam=createDam(materials),water=createWater();scene.add(terrain,dam,water.group);
const district=createReservoirDistrict();scene.add(district.group);
const buildings=createBuildings(materials);scene.add(buildings);
// 本轮两张照片的总览没有前景输电束遮挡；保留旧版全部构件，按需显示。
const powerlines=buildings.getObjectByName('Lattice transmission towers and sagging conductors');powerlines.visible=false;
const creatures=createCreatures(groundHeight);scene.add(creatures.group);
scene.traverse(o=>{if(o.isLight)o.layers.enable(1);});
const reflections=createWaterReflections(water,reflectionSize,creatures.group);
let creatureEpoch=null,walker=null;
creatures.ready.then(count=>{canvas.dataset.actorCount=count;reflections.invalidate();}).catch(e=>{errors.push(e.message);console.error('Local model load failed:',e);});
const grayMaterial=new THREE.MeshStandardMaterial({color:0xb5bdb9,roughness:.9});
let currentView='downstream',quality='high',paused=false,waterMoving=false,showLabels=false,gray=false,time=0,film=false,filmPreparing=false,filmSession=0,recorder=null,recordChunks=[],recording=false;
let effects=createEffects();scene.add(effects.group);
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function setView(name,immediate=false){walker?.stop();currentView=name;rig.preset(name,immediate);$('#view-title').textContent=PRESETS[name].title;$('#view-subtitle').textContent=PRESETS[name].subtitle;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('#toggle-orbit').checked=false;
  const p=PRESETS[name].target;lighting.sun.target.position.set(...p);lighting.sun.position.set(p[0]-550,p[1]+1900,p[2]+1050);lighting.sun.target.updateMatrixWorld();lighting.sun.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;reflections.invalidate();}
function resize(){
  let w=innerWidth,h=innerHeight;
  if(film){w=Math.min(w,h*16/9);h=w*9/16;$('#viewport').style.width=w+'px';$('#viewport').style.height=h+'px';}
  else{$('#viewport').style.width='';$('#viewport').style.height='';}
  renderer.setPixelRatio(recording?1:Math.min(devicePixelRatio,P.quality[quality].dpr));renderer.setSize(recording?1920:w,recording?1080:h,false);rig.camera.aspect=w/h;rig.camera.zoom=Math.min(1,(w/h)/.8);rig.camera.updateProjectionMatrix();
}
function setQuality(q){quality=q;$('#quality').value=q;const size=P.quality[q].shadow;renderer.shadowMap.enabled=!!size;lighting.sun.castShadow=!!size;
  if(size){lighting.sun.shadow.mapSize.set(size,size);if(lighting.sun.shadow.map){lighting.sun.shadow.map.dispose();lighting.sun.shadow.map=null;}}
  renderer.shadowMap.needsUpdate=true;
  // Thousands of independent members share a small material palette. Update each once.
  const changed=new Set();scene.traverse(o=>{if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])changed.add(mat);});
  for(const mat of changed)mat.needsUpdate=true;resize();
}
const labelDefs=[
  {text:'坝顶弧长',small:'709 m',p:damPoint(-.52,306)},
  {text:'双曲拱坝',small:'H ≈ 289 m',p:damPoint(.38,153,-1,-6)},
  {text:'上游水库',small:'高水位',p:[-95,P.water.upstream+10,-510]},
  {text:'下游河道',small:'低水位',p:[12,P.water.downstream+10,480]},
  {text:'深孔出口',small:'7 孔',p:damPoint(.06,218,-1,-8)},
];
const labels=labelDefs.map(d=>{const el=document.createElement('div');el.className='label';el.innerHTML=d.text+'<small>'+d.small+'</small>';$('#labels').append(el);return {...d,el,v:new THREE.Vector3(...d.p)};});
const raycaster=new THREE.Raycaster();
function updateLabels(){
  $('#labels').style.display=showLabels&&!film?'block':'none';if(!showLabels||film)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const occupied=[];
  for(const l of labels){const projected=l.v.clone().project(rig.camera),dist=rig.camera.position.distanceTo(l.v);raycaster.set(rig.camera.position,l.v.clone().sub(rig.camera.position).normalize());raycaster.far=dist-12;
    const hidden=projected.z>1||projected.z<-1||Math.abs(projected.x)>.95||Math.abs(projected.y)>.9||raycaster.intersectObjects([dam,terrain],true).length>0;
    l.el.style.display=hidden?'none':'block';l.el.style.left=((projected.x*.5+.5)*w+10)+'px';l.el.style.top=((-projected.y*.5+.5)*h-12)+'px';
    if(!hidden){const r=l.el.getBoundingClientRect();if(occupied.some(o=>r.left<o.right+8&&r.right>o.left-8&&r.top<o.bottom+6&&r.bottom>o.top-6))l.el.style.display='none';else occupied.push(r);}
  }
}
function setGray(value){gray=value;$('#toggle-gray').checked=value;scene.overrideMaterial=value?grayMaterial:null;lighting.sky.visible=!value;scene.traverse(o=>{if(o.isLine)o.visible=!value;});water.group.visible=true;reflections.invalidate();}
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
function snapshot(){renderer.render(scene,rig.camera);download(canvas.toDataURL('image/png'),`白鹤滩-${currentView}.png`);toast('已保存当前三维画面（不含操作界面）');}
function stopFilm(){
  filmSession++;filmPreparing=false;if(recorder&&recorder.state!=='inactive')recorder.stop();film=false;recording=false;rig.stopFilm();document.body.classList.remove('film');resize();
  $('#view-title').textContent='自由观察';$('#view-subtitle').textContent='巡游已退出 · 拖动继续查看';document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
}
async function startFilm(record=false){
  walker?.stop();
  if(film)return;
  if(record&&(!canvas.captureStream||!window.MediaRecorder)){toast('此浏览器不支持 WebM 录制，可使用系统录屏');return;}
  film=true;filmPreparing=true;const session=++filmSession;paused=false;$('#pause-button').textContent='Ⅱ 暂停';recording=record;document.body.classList.add('film');rig.startFilm();resize();rig.sampleFilm(0);
  await renderer.compileAsync(scene,rig.camera);if(!film||session!==filmSession)return;
  renderer.render(scene,rig.camera);await new Promise(requestAnimationFrame);if(!film||session!==filmSession)return;
  if(record){
    try{
      const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
      if(!mime)throw new Error('No WebM encoder');
      const stream=canvas.captureStream(30);recordChunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000});
      recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
      recorder.onstop=()=>{const blob=new Blob(recordChunks,{type:mime});const url=URL.createObjectURL(blob);download(url,'白鹤滩-26秒镜头.webm');setTimeout(()=>URL.revokeObjectURL(url),60000);stream.getTracks().forEach(t=>t.stop());toast('WebM 已生成并下载');recorder=null;};
      recorder.onerror=e=>{toast('视频编码失败：'+(e.error?.message||'浏览器编码器错误'));stopFilm();};
      recorder.start(1000);renderer.render(scene,rig.camera);
    }catch(e){stopFilm();toast('录制启动失败：'+e.message);return;}
  }
  if(!film||session!==filmSession)return;last=performance.now();filmPreparing=false;pointerActive();
}
function togglePause(){paused=!paused;$('#pause-button').textContent=paused?'▶ 继续':'Ⅱ 暂停';if(recorder&&recorder.state==='recording'&&paused)recorder.pause();else if(recorder&&recorder.state==='paused'&&!paused)recorder.resume();}
function pointerActive(){document.body.classList.add('pointer-active');clearTimeout(pointerActive.timer);pointerActive.timer=setTimeout(()=>document.body.classList.remove('pointer-active'),1700);}
window.addEventListener('resize',resize);
installInteractions({rig,setView,setGray,setQuality,snapshot,startFilm,stopFilm,togglePause,pointerActive,
  setLabels:value=>showLabels=value,getLabels:()=>showLabels,setWaterMoving:value=>waterMoving=value,isFilming:()=>film,
  setWaterWire:value=>{for(const w of water.surfaces)w.material.wireframe=value;},
  setPowerlines:value=>{powerlines.visible=value;renderer.shadowMap.needsUpdate=true;reflections.invalidate();},
  setPlants:value=>{district.vegetation.group.visible=value;renderer.shadowMap.needsUpdate=true;reflections.invalidate();},
  setFlow:value=>{effects.group.visible=value;if(value)toast('泄洪为视觉示意，不是水动力仿真');},
});
const detailCaptions=[
  {title:'层叠挡墙近景',text:'厚墙沿等高线弯折，逐级退台；上部保留锚固裸岩，墙面有模板缝和洞口，墙脚接岩滩与蓝绿色水面。',file:'bank-detail-20261015.jpg',view:'bank'},
  {title:'下游峡谷全景',text:'内凹双曲拱坝、坝顶红色门机、分层孔口；两侧支护逐级下降至狭长水垫塘与河道。',file:'canyon-20261015.jpg',view:'downstream'},
  {title:'库区滨水公园',text:'白色廊架、观景平台、弯曲步道与乔灌草，接入同一模型的上游岸线。',file:'park.jpg',view:'park'},
  {title:'库区岩质岸坡',text:'植被和裸岩交错，完整水面伸入岩石与植物下方。',file:'rock-bank.jpg',view:'rockshore'},
  {title:'开阔库区与远山',text:'连绵山峦、梯田与散落村落；照片没有提供相对坝址的测绘位置，连接段按景观逻辑构建。',file:'panorama.jpg',view:'reservoir'}
];
$('#photo-grid').innerHTML=detailCaptions.map((c,i)=>{const src=window.BAIHETAN_REFERENCE_ASSETS?.[i]||`references/${c.file}`;return `<figure class="photo-card"><a href="${src}" target="_blank" rel="noopener"><img src="${src}" loading="lazy" alt="本轮实拍参考 ${i+1}：${c.title}"></a><figcaption><strong>参考 ${i+1} / ${c.title}</strong><p>${c.text}</p><button class="photo-view" data-reference-view="${c.view}">切换到相近视角 <span>↗</span></button></figcaption></figure>`;}).join('');
document.querySelectorAll('[data-reference-view]').forEach(button=>button.onclick=()=>{$('#reference-dialog').close();setView(button.dataset.referenceView);});
const arc=crestLength(),chord=2*damPoint(1,P.dam.height)[0];$('#geometry-report').textContent=`模型校核：坝顶中心线数值弧长 ${arc.toFixed(3)} m；两端弦长 ${chord.toFixed(3)} m；模型相对上下游水位 ${P.water.upstream} / ${P.water.downstream} m（非海拔）。`;
// Visible, reproducible inventory counts the actual solid Mesh objects. Rendering
// quality affects pixel ratio and shadows only; these values must stay constant.
const inventory={meshes:0,triangles:0};
for(const root of [terrain,dam,buildings,water.group,district.group])root.traverse(o=>{
  if(!o.isMesh)return;inventory.meshes++;inventory.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);
});
$('#geometry-report').textContent+=` 当前固定几何：${inventory.meshes.toLocaleString()} 个网格对象，${inventory.triangles.toLocaleString()} 个渲染三角形；6 表孔、7 深孔、105 个坝面排水孔、5 座红色门机、6 个圆筒、4 座输电塔。`;
$('#geometry-report').dataset.meshCount=inventory.meshes;
$('#geometry-report').dataset.triangleCount=inventory.triangles;
$('#geometry-report').textContent+=` 库区已合并到同一 Scene；上游水面从坝前延伸至湖湾，${water.surfaces[0].geometry.userData.completeTriangles.toLocaleString()} 个完整三角形，岸线删除 0 个；${district.vegetation.group.userData.trees} 株乔木、${district.vegetation.group.userData.shrubs} 丛灌木。支护构件仍各自独立，植被采用实例化。`;
setQuality(tier==='low'?'low':'medium');resize();
const query=new URLSearchParams(location.search);if(query.has('gray'))setGray(true);setView(PRESETS[query.get('view')]?query.get('view'):'unified',true);
// 仅供可复现的本地画面校验：指定相机与动作时间，不增加页面文字或按钮。
const inspection=query.get('qa')==='1';
let inspectionCamera=null;
if(inspection){
  const vector=key=>(query.get(key)||'').split(',').map(Number);
  const eye=vector('eye'),target=vector('target');
  if(eye.length===3&&target.length===3&&[...eye,...target].every(Number.isFinite)){inspectionCamera={eye,target};rig.camera.position.set(...eye);rig.controls.target.set(...target);rig.controls.update();rig.controls.enabled=false;}
  document.body.classList.add('clean');
}
const inspectionTime=inspection&&query.has('at')?Math.max(0,Number(query.get('at'))):null;
// 建筑、山体和植被的世界变换固定；动画只更新实例矩阵/着色器属性。
scene.updateMatrixWorld(true);scene.matrixWorldAutoUpdate=false;
const occlusion=createTerrainOcclusion([terrain,dam,buildings],groundHeight);
reflections.setOcclusion(occlusion);
const walkRoots=[terrain,dam,buildings,district.features];
walker=createFirstPerson({canvas,rig,roots:walkRoots,heightAt:groundHeight,
  onStart:()=>{$('#panel-toggle').textContent='控制 ☰';if(film)stopFilm();paused=false;$('#pause-button').textContent='Ⅱ 暂停';},
  onChange:active=>{canvas.dataset.walking=String(active);if(!active){canvas.dataset.walkState='';touchWalking.reset();}}
});
const touchWalking=installTouchWalking(canvas,walker);
const walkSelection=createWalkSelection({canvas,camera:rig.camera,roots:walkRoots,water:water.group,walker,
  hud:$('#walk-selection'),dot:$('#walk-dot'),message:$('#walk-pick-message'),confirm:$('#confirm-walk'),cancel:$('#cancel-walk')});
$('#walk-button').onclick=()=>walker.active||walker.selecting?walker.stop():walker.start();
$('#exit-walk').onclick=()=>walker.stop();
let last=performance.now(),frame=0,frameSum=0,frameSamples=0;
function animate(now){requestAnimationFrame(animate);const elapsed=(now-last)/1000,dt=Math.min(.06,elapsed);last=now;if(!paused)time+=elapsed;
  const done=walker.active?(walker.update(dt),false):filmPreparing?false:rig.update(film?elapsed:dt,paused);if(waterMoving)water.update(time);if(effects&&effects.group.visible)effects.update(time);
  if(inspectionCamera&&!walker.active){rig.camera.position.set(...inspectionCamera.eye);rig.controls.target.set(...inspectionCamera.target);rig.camera.lookAt(rig.controls.target);}
  walkSelection.update();
  district.update(time);lighting.update(time);
  if(creatures.loaded){
    if(creatureEpoch===null)creatureEpoch=time;
    const actorTime=Number.isFinite(inspectionTime)?inspectionTime:time-creatureEpoch;
    creatures.update(actorTime);
    if(frame%30===0){canvas.dataset.actorStates=JSON.stringify(creatures.snapshot());canvas.dataset.actorTime=actorTime.toFixed(2);if(inspection)canvas.dataset.camera=JSON.stringify({eye:rig.camera.position.toArray(),target:rig.controls.target.toArray()});}
  }
  if(frame++%8===0)updateLabels();reflections.update(renderer,scene,rig.camera,now);occlusion.update(rig.camera);renderer.render(scene,rig.camera);if(done&&film)stopFilm();
  if(frame>15){frameSum+=elapsed;frameSamples++;if(frameSamples===60){canvas.dataset.frameMs=(frameSum*1000/frameSamples).toFixed(1);canvas.dataset.renderCalls=renderer.info.render.calls;canvas.dataset.renderTriangles=renderer.info.render.triangles;frameSum=frameSamples=0;}}
  if(frame===3){renderer.shadowMap.autoUpdate=false;$('#loading').classList.add('ready');$('#loading').setAttribute('aria-hidden','true');window.__APP_READY__=true;clearTimeout(window.__baihetanWatchdog);}
}
requestAnimationFrame(animate);
// Explicit local QA API: application-owned state only, no browser internals required.
window.baihetan={params:P,scene,renderer,rig,water,dam,terrain,errors,setView,setGray,setQuality,startFilm,stopFilm,
  get state(){return {currentView,quality,paused,film,recording,showLabels,gray,time,filmTime:rig.filmTime};},
  stats(){return {arc,chord,damHeight:P.dam.height,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,errors:[...errors]};},
  effects,buildings,reflections,district,creatures,walker,
};
