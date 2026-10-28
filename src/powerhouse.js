import * as THREE from 'three';
import {BANK_CENTRES,UNIT_Z} from './powerhouse-model.js';

const PARTS=[['intake','压力管道','water'],['spiral','蜗壳','water'],['gate','活动导叶','water'],['runner','混流式转轮','mechanical'],['shaft','主轴','mechanical'],['rotor','转子 · 旋转磁场','electric'],['stator','定子 · 三相绕组','electric'],['bearing','推力轴承','mechanical'],['exciter','励磁装置','electric'],['draft','尾水管','water'],['transformer','主变压器','electric']];
const STEPS=[
  {title:'水头变成水流的能量',tag:'01 / 引水与配水',text:'水库与下游的水位差形成水头。水沿压力管道进入截面逐渐收缩的蜗壳，经固定导叶、活动导叶均匀进入转轮。活动导叶调节过流量。',parts:['intake','spiral','gate'],eye:[40,23,48],target:[2,7,0]},
  {title:'水流推动转轮，主轴传递转矩',tag:'02 / 水能 → 机械能',text:'混流式转轮的水流由外缘进入，沿弯曲叶片转向下方流出。转轮与上方发电机转子通过同一根立轴连接，一起转动。',parts:['runner','shaft','bearing'],eye:[30,19,42],target:[0,10,0]},
  {title:'旋转磁场使定子绕组产生交流电',tag:'03 / 机械能 → 电能',text:'励磁装置向转子提供直流励磁。转子磁极随主轴旋转，磁场相对静止的定子绕组变化，绕组中产生三相交流电。定子不随轴转动。',parts:['rotor','stator','exciter'],eye:[30,34,43],target:[0,22,0]},
  {title:'三相母线连接主变压器',tag:'04 / 升压与送出',text:'发电机输出的交流电经三相母线送到主变压器，升压后送往电网。蓝色水路与金色电能脉冲各自独立，水不会流进发电机电气腔体。',parts:['stator','transformer'],eye:[23,34,53],target:[-12,19,0]},
  {title:'尾水回到下游，完成过流过程',tag:'05 / 排水与回流',text:'离开转轮的水经扩散锥管和弯肘尾水管进入尾水系统。尾水调压室缓解流量变化产生的水力波动，尾水隧洞最终将水排回下游。',parts:['runner','draft'],eye:[30,11,46],target:[0,0,9]},
];

export function installPowerhouse({scene,renderer,rig,canvas,dam,terrain,beforeEnter,onExit}){
  const $=s=>document.querySelector(s);
  const ui=document.createElement('section');ui.id='powerhouse-ui';ui.hidden=true;
  ui.setAttribute('aria-label','地下电站发电原理讲解');
  ui.innerHTML=`
    <header class="ph-heading"><h1>电站内部</h1><p id="ph-location">坝库整体 › 两岸山体 › 地下厂房 › 机组</p></header>
    <button id="ph-exit" class="ph-exit">返回场景 <span>Esc ↗</span></button>
    <nav class="ph-views" aria-label="电站内部视角"><button data-ph-view="system" aria-pressed="true">整体透视</button><button data-ph-view="hall" aria-pressed="false">进入厂房</button><button data-ph-view="unit" aria-pressed="false">机组剖视</button></nav>
    <aside class="ph-panel">
      <div class="ph-panel-top"><span id="ph-tag">STRUCTURE / 结构观察</span><button id="ph-collapse" aria-label="收起讲解面板" aria-expanded="true">−</button></div>
      <div class="ph-panel-content">
        <h2 id="ph-title">一台机组，三种能量</h2>
        <div class="ph-steps" aria-label="发电原理分步讲解">${STEPS.map((s,i)=>`<button data-ph-step="${i}" title="${s.tag}" aria-label="${s.tag}">${String(i+1).padStart(2,'0')}</button>`).join('')}</div>
        <div class="ph-step-nav"><button id="ph-prev">← 上一步</button><button id="ph-overview">完整机组</button><button id="ph-next">下一步 →</button></div>
        <div class="ph-rule"></div>
        <div class="ph-select-row"><label>厂房<select id="ph-bank"><option value="0">左岸厂房</option><option value="1">右岸厂房</option></select></label><label>机组<select id="ph-unit">${Array.from({length:8},(_,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} 号机组</option>`).join('')}</select></label></div>
        <label class="ph-range">山体不透明度 <output id="ph-rock-value">15%</output><input id="ph-rock" type="range" min="5" max="100" value="15" step="1"></label>
        <div id="ph-unit-controls">
          <label class="ph-option"><span>外壳剖开</span><input type="checkbox" id="ph-cut" checked></label>
          <label class="ph-option"><span>部件分解</span><input type="checkbox" id="ph-explode"></label>
          <label class="ph-option"><span>水流与电能方向</span><input type="checkbox" id="ph-flow" checked></label>
          <label class="ph-option"><span>磁场示意</span><input type="checkbox" id="ph-field" checked></label>
          <label class="ph-option"><span>部件标注</span><input type="checkbox" id="ph-labels" checked></label>
          <label class="ph-range">导叶开度 <output id="ph-gate-value">72%</output><input id="ph-gate" type="range" min="0" max="100" value="72" step="1"></label>
          <output id="ph-operation" hidden></output>
          <div class="ph-playback"><button id="ph-pause">Ⅱ 暂停演示</button><button id="ph-reset-camera">复位视角 ↗</button></div>
        </div>
        
        
      </div>
    </aside>
    <div id="ph-labels-layer" aria-hidden="true"></div>
    <div class="ph-bottom"><div class="ph-legend"><span class="water">水流</span><span class="mechanical">机械传动</span><span class="electric">电能输出</span></div><span id="ph-model-status">同轴传动 / 定子静止</span><small>拖动旋转 · 滚轮缩放 · 双指平移</small></div>`;
  document.body.append(ui);
  const labelLayer=$('#ph-labels-layer');
  const labels=PARTS.map(([key,text,type],i)=>{
    const el=document.createElement('div');el.className=`ph-label ${type}`;el.innerHTML=`<i></i><span><b>${String(i+1).padStart(2,'0')}</b>${text}</span>`;labelLayer.append(el);return {key,el};
  });
  let model=null,active=false,loading=false,mode='unit',bank=0,unit=0,step=-1,running=true,showLabels=true,exploded=false,saved=null,labelFrame=0;
  const lightGroup=new THREE.Group();lightGroup.name='地下展陈照明';lightGroup.visible=false;
  lightGroup.add(new THREE.HemisphereLight(0xc9e9ff,0x24404a,1.3));
  const key=new THREE.DirectionalLight(0xe3f4ff,2.6);key.position.set(70,120,100);lightGroup.add(key);
  const rim=new THREE.DirectionalLight(0x719dcf,1.1);rim.position.set(-30,60,-60);lightGroup.add(rim);
  scene.add(lightGroup);
  function resize(){
    if(!active)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    rig.camera.setViewOffset(w,h,w>850?150:0,w<=850&&!ui.classList.contains('ph-collapsed')?Math.min(140,h*.17):0,w,h);
  }
  function syncAudit(){if(active&&model)canvas.dataset.powerhouse=JSON.stringify({...model.audit(),running,step});else delete canvas.dataset.powerhouse;}
  function cameraView(){
    const origin=model.origin;let eye,target;
    if(mode==='unit'){
      const s=step===3?{eye:[bank? -28:28,58,142],target:[bank?52:-52,21,0]}:step>=0?STEPS[step]:{eye:exploded?[59,57,84]:[54,37,77],target:exploded?[0,26,0]:[-3,10,1]};
      eye=new THREE.Vector3(...s.eye).add(origin);target=new THREE.Vector3(...s.target).add(origin);
      rig.controls.minDistance=6;rig.controls.maxDistance=170;rig.camera.near=.12;rig.camera.fov=42;
    }else if(mode==='hall'){
      const p=new THREE.Vector3(...BANK_CENTRES[bank]);eye=p.clone().add(new THREE.Vector3(12,42,198));target=p.clone().add(new THREE.Vector3(-1,34,-100));
      rig.controls.minDistance=1;rig.controls.maxDistance=650;rig.camera.near=.2;rig.camera.fov=59;
    }else{
      eye=new THREE.Vector3(1230,1070,1630);target=new THREE.Vector3(0,110,-60);rig.controls.minDistance=160;rig.controls.maxDistance=3500;rig.camera.near=2;rig.camera.fov=47;
    }
    rig.controls.maxPolarAngle=Math.PI*.94;rig.controls.minPolarAngle=.03;rig.controls.enableDamping=false;
    rig.camera.position.copy(eye);rig.controls.target.copy(target);rig.controls.update();resize();rig.camera.updateProjectionMatrix();
  }
  function setMode(value){
    mode=value;model.setMode(mode);
    if(saved){for(const [o,visible] of saved.objects)if(o.isLight)o.visible=mode==='system'&&visible;scene.fog=mode==='system'?saved.fog:null;}
    lightGroup.visible=mode!=='system';
    $('#ph-location').textContent=`坝库整体 › ${bank===0?'左岸':'右岸'}山体 › 地下厂房 › ${String(bank*8+unit+1).padStart(2,'0')} 号机组`;
    $('#ph-unit-controls').hidden=mode!=='unit';labelLayer.hidden=mode!=='unit';
    document.querySelectorAll('[data-ph-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phView===mode)));
    if(mode==='hall'){
      $('#ph-tag').textContent='UNDERGROUND / 地下厂房';$('#ph-title').textContent=`${bank===0?'左岸':'右岸'} · 八台机组排列`;
      
      $('#ph-model-status').textContent='发电机层 / 桥式起重机 / 检修廊道';
    }else if(mode==='system'){
      $('#ph-tag').textContent='WATERWAY / 地下引水系统';$('#ph-title').textContent='山体内部，两岸发电';
      
      $('#ph-model-status').textContent='山体 → 厂房 → 机组 / 同一装配与世界坐标';
    }else setStepText();
    cameraView();syncAudit();
  }
  function setStepText(){
    const s=STEPS[step];$('#ph-tag').textContent=s?s.tag:'STRUCTURE / 结构观察';$('#ph-title').textContent=s?s.title:'一台机组，三种能量';
    
    $('#ph-model-status').textContent=exploded?'装配分解 / 非运行状态':'同轴传动 / 定子静止';
    document.querySelectorAll('[data-ph-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.phStep)===step)));
  }
  function setStep(value){step=value;setMode('unit');}
  async function enter(initial='system'){
    if(active){setMode(initial);return;}if(loading)return;loading=true;const button=$('#powerhouse-button');button.disabled=true;button.textContent='正在构建内部机组…';
    try{
      beforeEnter();
      if(!model){const {createPowerhouseModel}=await import('./powerhouse-model.js');model=createPowerhouseModel();model.root.visible=false;scene.add(model.root);}
      saved={objects:scene.children.filter(o=>o!==model.root&&o!==lightGroup).map(o=>[o,o.visible]),background:scene.background,fog:scene.fog,override:scene.overrideMaterial,exposure:renderer.toneMappingExposure,position:rig.camera.position.clone(),target:rig.controls.target.clone(),fov:rig.camera.fov,near:rig.camera.near,min:rig.controls.minDistance,max:rig.controls.maxDistance,polar:rig.controls.maxPolarAngle,minPolar:rig.controls.minPolarAngle,damping:rig.controls.enableDamping,localClipping:renderer.localClippingEnabled,terrainMaterials:[],xray:new Map()};
      // 仅改变覆盖岩体的透明度，不移动地下设备，不切掉原有水面三角形。
      const forest=terrain.getObjectByName('Canyon natural ridge forest');saved.forest=[forest,forest.visible];forest.visible=false;
      terrain.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;const source=o.material;if(!saved.xray.has(source)){const copy=source.clone();copy.onBeforeCompile=source.onBeforeCompile;copy.customProgramCacheKey=source.customProgramCacheKey;copy.transparent=true;copy.opacity=Number($('#ph-rock').value)/100;copy.depthWrite=false;copy.side=THREE.DoubleSide;saved.xray.set(source,copy);}saved.terrainMaterials.push([o,source]);o.material=saved.xray.get(source);});
      scene.overrideMaterial=null;renderer.localClippingEnabled=true;renderer.toneMappingExposure=1.0;
      active=true;model.root.visible=true;lightGroup.visible=true;lightGroup.updateMatrixWorld(true);rig.setOrbit(false);rig.controls.enabled=true;
      document.body.classList.add('powerhouse');document.body.classList.remove('panel-open','clean');ui.hidden=false;
      model.select(bank,unit);setMode(initial);model.update(0,running);renderer.shadowMap.needsUpdate=true;$('#ph-exit').focus();
    }catch(error){console.error('Powerhouse initialization failed:',error);if(saved)exit();button.textContent='内部模型加载失败，点击重试';}
    finally{loading=false;button.disabled=false;if(active||model)button.textContent='进入电站内部 ↗';}
  }
  function exit(){
    if(!active)return;active=false;model.root.visible=false;lightGroup.visible=false;saved.objects.forEach(([o,visible])=>o.visible=visible);
    scene.background=saved.background;scene.fog=saved.fog;scene.overrideMaterial=saved.override;renderer.toneMappingExposure=saved.exposure;
    for(const [o,material] of saved.terrainMaterials)o.material=material;for(const material of saved.xray.values())material.dispose();saved.forest[0].visible=saved.forest[1];renderer.localClippingEnabled=saved.localClipping;
    rig.camera.clearViewOffset();rig.camera.fov=saved.fov;rig.camera.near=saved.near;rig.camera.position.copy(saved.position);rig.controls.target.copy(saved.target);
    rig.controls.minDistance=saved.min;rig.controls.maxDistance=saved.max;rig.controls.maxPolarAngle=saved.polar;rig.controls.minPolarAngle=saved.minPolar;rig.controls.enableDamping=saved.damping;rig.controls.update();rig.camera.updateProjectionMatrix();
    document.body.classList.remove('powerhouse');ui.hidden=true;renderer.shadowMap.needsUpdate=true;syncAudit();onExit();$('#powerhouse-button').focus();
  }
  function choose(){
    bank=Number($('#ph-bank').value);unit=Number($('#ph-unit').value);
    Array.from($('#ph-unit').options).forEach((o,i)=>o.textContent=`${String(bank*8+i+1).padStart(2,'0')} 号机组`);
    model.select(bank,unit);setMode(mode);
  }
  $('#powerhouse-button').onclick=()=>enter();$('#ph-exit').onclick=exit;
  document.querySelectorAll('[data-ph-view]').forEach(b=>b.onclick=()=>setMode(b.dataset.phView));
  document.querySelectorAll('[data-ph-step]').forEach(b=>b.onclick=()=>setStep(Number(b.dataset.phStep)));
  $('#ph-next').onclick=()=>setStep((step+1)%STEPS.length);$('#ph-prev').onclick=()=>setStep((step+STEPS.length-1)%STEPS.length);$('#ph-overview').onclick=()=>setStep(-1);
  $('#ph-bank').onchange=choose;$('#ph-unit').onchange=choose;
  $('#ph-cut').onchange=e=>{model.configure({cut:e.target.checked});syncAudit();};
  $('#ph-explode').onchange=e=>{exploded=e.target.checked;step=-1;model.configure({explosion:exploded?1:0});setMode('unit');};
  $('#ph-flow').onchange=e=>model.configure({flow:e.target.checked});$('#ph-field').onchange=e=>model.configure({field:e.target.checked});
  $('#ph-labels').onchange=e=>showLabels=e.target.checked;
  $('#ph-rock').oninput=e=>{const value=Number(e.target.value);$('#ph-rock-value').textContent=value+'%';for(const material of saved.xray.values())material.opacity=value/100;};
  $('#ph-gate').oninput=e=>{const value=Number(e.target.value);$('#ph-gate-value').textContent=value+'%';model.configure({gate:value/100});$('#ph-operation').textContent=value===0?'导叶已关闭，水流与传动停止（停机过程简化演示）。':'开度影响流量和负荷；并网运行的转速保持稳定。';syncAudit();};
  $('#ph-pause').onclick=()=>{running=!running;$('#ph-pause').textContent=running?'Ⅱ 暂停演示':'▶ 继续演示';syncAudit();};$('#ph-reset-camera').onclick=cameraView;
  $('#ph-collapse').onclick=()=>{const collapsed=ui.classList.toggle('ph-collapsed');$('#ph-collapse').textContent=collapsed?'+':'−';$('#ph-collapse').setAttribute('aria-expanded',String(!collapsed));$('#ph-collapse').setAttribute('aria-label',collapsed?'展开讲解面板':'收起讲解面板');resize();};
  window.addEventListener('keydown',e=>{
    if(!active)return;
    // 捕获内部快捷键，防止原场景的空格/数字/F 键抢走相机。
    if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();exit();return;}
    if(e.target.matches('input,select,button'))return;
    if(e.code==='Space'){e.preventDefault();$('#ph-pause').click();}
    if(e.code==='ArrowRight')$('#ph-next').click();if(e.code==='ArrowLeft')$('#ph-prev').click();
    e.stopImmediatePropagation();
  },true);
  window.addEventListener('resize',resize);
  const projection=new THREE.Vector3();
  function update(dt){
    if(!active)return;rig.controls.update();model.update(dt,running&&!exploded);rig.camera.updateMatrixWorld();
    if(labelFrame++%4===0){
      const w=canvas.clientWidth,h=canvas.clientHeight,small=w<=850,occupied=[];const focus=step>=0?STEPS[step].parts:null;
      for(const l of labels){
        projection.copy(model.anchor(l.key)).project(rig.camera);const x=(projection.x*.5+.5)*w,y=(-projection.y*.5+.5)*h;
        let visible=showLabels&&mode==='unit'&&Math.abs(projection.x)<.92&&Math.abs(projection.y)<.88&&projection.z<1&&(!focus||focus.includes(l.key));
        if(small&&!focus&&!['runner','stator','rotor','draft','intake'].includes(l.key))visible=false;
        if(x>w-370&&w>850)visible=false;if(y>h-290&&small&&!ui.classList.contains('ph-collapsed'))visible=false;
        if(occupied.some(p=>Math.abs(p.x-x)<150&&Math.abs(p.y-y)<30))visible=false;
        l.el.hidden=!visible;if(visible){l.el.style.left=x+'px';l.el.style.top=y+'px';occupied.push({x,y});}
      }
      syncAudit();
    }
  }
  return {enter,exit,update,resize,get active(){return active;},get model(){return model;}};
}
