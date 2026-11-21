import * as THREE from 'three';
import {BANK_CENTRES,UNIT_Z} from './powerhouse-model.js';
import {createHallReflection} from './hall-reflection.js';

import {operatingPoint,createSpeedGovernor,UNIT_SPEC,LEVELS} from './unit-physics.js';

const PARTS=[['intake','压力管道','water'],['spiral','蜗壳','water'],['gate','活动导叶','water'],['runner','混流式转轮','mechanical'],['shaft','主轴','mechanical'],['rotor','转子 · 54 个磁极','electric'],['stator','定子 · 三相绕组','electric'],['bearing','推力轴承','mechanical'],['exciter','励磁装置','electric'],['draft','尾水管','water'],['transformer','主变压器','electric']];
// 讲解按“水 → 机械 → 电”的真实先后排列；数字来自公开资料或由基本物理公式算出。
const STEPS=[
  {title:'水头：水库与下游的高差',tag:'01 / 能量从哪里来',
   text:'大坝把金沙江拦成水库，正常蓄水位 825 m，下游尾水约 590 m，两者相差约 235 m，这就是“毛水头”。水从高处流向低处，重力势能可以转换为其他形式的能量。机组按 202 m 额定水头设计，1 m³ 水落差 200 多米，约可发 0.55 kW·h 电。',
   facts:[['正常蓄水位','825 m'],['死水位','765 m'],['坝顶高程','834 m'],['额定水头','202 m']],
   parts:['intake','draft'],eye:[78,52,112],target:[0,10,0]},
  {title:'进水口与压力管道',tag:'02 / 引水',
   text:'每岸 8 个进水口，前面的拦污栅挡住漂浮物。进水口设叠梁门可分层取水，主要取较温暖的表层水，减少对下游鱼类的影响。之后每台机组有一条独立的压力管道（单机单洞），先竖直下降约两百米，再水平进入厂房。',
   facts:[['布置','单机单洞'],['进口底槛','约 743 m（低于死水位）'],['单机额定流量','约 545 m³/s']],
   parts:['intake','spiral'],eye:[44,26,52],target:[4,10,-6]},
  {title:'蜗壳、座环与活动导叶',tag:'03 / 配水与调节',
   text:'蜗壳像一只截面逐渐变小的“蜗牛壳”：水沿圆周流动时不断有一部分进入内侧，截面缩小后流速仍保持均匀，因此转轮一周都能均匀进水。固定导叶（座环）承受压力并引导水流；内圈的活动导叶由接力器推动控制环转动，开度决定流量，也就决定机组出力。',
   facts:[['调节机构','调速器 → 接力器 → 控制环'],['导叶开度','控制流量与出力'],['转速','由电网频率锁定']],
   parts:['spiral','gate'],eye:[30,20,38],target:[2,5,0]},
  {title:'混流式转轮：水能变机械能',tag:'04 / 水能 → 机械能',
   text:'水从转轮外缘沿径向流入，在弯曲叶片间转向，最后沿轴向向下流出。水流方向和压力的变化对叶片产生反作用力，形成推动转轮旋转的转矩。左岸东方电气转轮直径 8.62 m，重约 353 t；右岸哈电采用长短叶片转轮，短叶片只在进口段，用于改善进口水流。',
   facts:[['左岸转轮','Ø8.62 m · 353 t'],['右岸转轮','长短叶片'],['水轮机最优效率','96.7%'],['额定转矩','约 86 MN·m']],
   parts:['runner','shaft'],eye:[24,13,32],target:[0,4,0]},
  {title:'主轴与轴承：把转矩传上去',tag:'05 / 机械传动',
   text:'转轮与发电机转子固定在同一根立轴上，同步转动，没有齿轮变速。推力轴承“托”住整个转动部分的重量和向下的水推力，承载数千吨；上、下导轴承限制主轴摆动，使机组保持对中。',
   facts:[['额定转速','111.1 r/min'],['传动方式','同轴直连，无齿轮'],['推力轴承','承载数千吨']],
   parts:['shaft','bearing','runner'],eye:[32,24,44],target:[0,15,0]},
  {title:'励磁与旋转磁场：机械能变电能',tag:'06 / 机械能 → 电能',
   text:'励磁装置把直流电送进转子的 54 个磁极绕组，形成 N、S 交替的磁极。转子旋转时，每一对磁极扫过定子线圈，线圈中的磁通就完成一次变化，按法拉第电磁感应定律产生一个周期的交流电压。54 极就是 27 对极，所以 27 × 111.1 r/min ÷ 60 ≈ 50 Hz，正好等于电网频率。三组绕组相隔 120°，输出三相交流电。',
   facts:[['磁极数','54（27 对）'],['频率','27 × 111.1 ÷ 60 ≈ 50 Hz'],['额定电压','24 kV'],['发电机效率','> 99%']],
   parts:['rotor','stator','exciter'],eye:[28,32,40],target:[0,21,0],field:true},
  {title:'升压与远距离送出',tag:'07 / 电能输出',
   text:'发电机出口电压 24 kV，满负荷时电流约 27 kA。电流经离相封闭母线进入平行的主变洞，由主变压器升到 500 kV，再经 GIS 开关站和出线竖井引到地面。功率相同时，电压越高，电流越小，导线发热损失（I²R）也越少。电力最终经白鹤滩—江苏、白鹤滩—浙江 ±800 kV 特高压直流线路送往华东。',
   facts:[['发电机电压','24 kV'],['主变升压','24 → 500 kV'],['外送','±800 kV 特高压直流'],['年均发电','约 624 亿 kW·h']],
   parts:['stator','transformer'],mirror:true,eye:[14,52,118],target:[-31,21,0]},
  {title:'尾水管与尾水调压室',tag:'08 / 回到金沙江',
   text:'离开转轮的水仍有不少流速。尾水管做成逐渐扩大的弯管，让水减速，回收这部分动能，提高效率。每两台机组共用一个圆筒形尾水调压室：机组突然增减负荷时，调压室水位上下波动，吸收水锤压力。最后水经尾水隧洞（每岸 4 条）回到金沙江。',
   facts:[['布置','两机一室一洞'],['尾水隧洞','左右岸各 4 条'],['作用','回收动能 · 缓解水锤']],
   parts:['runner','draft'],eye:[30,8,52],target:[0,-4,10]},
];
const MODE_TEXT={
  system:{tag:'两岸电站',title:'地下引水发电系统',text:'左右岸各有一座地下电站，各装 8 台 100 万 kW 机组，共 16 台、总装机 1600 万 kW。沿水流方向依次是：进水口 → 压力管道竖井 → 主厂房 → 主变洞 → 尾水调压室 → 尾水隧洞。三大洞室彼此平行，中间留有岩柱支撑。',
    facts:[['总装机','16 × 100 万 kW'],['主厂房','长约 438 m，高 88.7 m'],['厂房跨度','34 m（岩锚梁以上）'],['尾水系统','每岸 4 室 4 洞']]},
  hall:{tag:'地下厂房',title:'发电机层',text:'厂房位于山体内数百米深处。地面上看到的圆形盖板下面就是发电机，再往下依次是水轮机层、蜗壳层和尾水管层。顶部桥式起重机用于安装和检修重达数百吨的转轮、转子等部件。',
    facts:[['开挖高度','88.7 m'],['岩锚梁以上跨度','34 m'],['岩锚梁以下跨度','31 m'],['单岸机组','8 台']]},
};
const STATE_TEXT={stopped:'停机：导叶全关，没有水流，转子靠惯性逐渐停下。',
  'no-load':'空载：导叶开度太小，水流只够维持转动，不能带负荷发电。',
  online:'并网发电：转速被 50 Hz 电网“锁定”在 111.1 r/min；开大导叶只增加出力，不会转得更快。',
  over:'超出额定 1000 MW：实际运行时调速器会限制导叶开度，避免机组过负荷。'};

export function installPowerhouse({scene,renderer,rig,canvas,dam,terrain,beforeEnter,onExit}){
  const $=s=>document.querySelector(s);
  const ui=document.createElement('section');ui.id='powerhouse-ui';ui.hidden=true;
  ui.setAttribute('aria-label','地下电站发电原理讲解');
  ui.innerHTML=`
    <header class="ph-heading"><h1>电站内部</h1><p id="ph-location">左岸厂房 · 01 号机组</p></header>
    <button id="ph-exit" class="ph-exit">返回场景 <span>Esc ↗</span></button>
    <nav class="ph-views" aria-label="电站内部视角"><button data-ph-view="system" aria-pressed="true">整体透视</button><button data-ph-view="hall" aria-pressed="false">进入厂房</button><button data-ph-view="unit" aria-pressed="false">机组剖视</button></nav>
    <aside class="ph-panel">
      <div class="ph-panel-top"><span id="ph-tag">STRUCTURE / 结构观察</span><button id="ph-collapse" aria-label="收起讲解面板" aria-expanded="true">−</button></div>
      <div class="ph-panel-content">
        <h2 id="ph-title">一台机组，三种能量</h2>
        <p id="ph-description"></p>
        <dl id="ph-facts" class="ph-facts"></dl>
        <div class="ph-steps" aria-label="发电原理分步讲解">${STEPS.map((s,i)=>`<button data-ph-step="${i}" title="${s.tag}" aria-label="${s.tag}">${i+1}</button>`).join('')}</div>
        <div class="ph-step-nav"><button id="ph-prev">‹ 上一步</button><button id="ph-overview">完整机组</button><button id="ph-next">下一步 ›</button></div>
        <div class="ph-rule"></div>
        <div class="ph-select-row"><label>厂房<select id="ph-bank"><option value="0">左岸厂房（四川）</option><option value="1">右岸厂房（云南）</option></select></label><label id="ph-unit-select">机组<select id="ph-unit">${Array.from({length:8},(_,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} 号机组</option>`).join('')}</select></label></div>
        <label class="ph-range" id="ph-rock-control">山体不透明度 <output id="ph-rock-value">15%</output><input id="ph-rock" type="range" min="5" max="100" value="15" step="1"></label>
        <div id="ph-unit-controls">
          <label class="ph-option"><span>外壳剖开</span><input type="checkbox" id="ph-cut" checked></label>
          <label class="ph-option"><span>部件分解</span><input type="checkbox" id="ph-explode"></label>
          <label class="ph-option"><span>水流与电能方向</span><input type="checkbox" id="ph-flow" checked></label>
          <label class="ph-option"><span>磁场示意</span><input type="checkbox" id="ph-field"></label>
          <label class="ph-option"><span>部件标注</span><input type="checkbox" id="ph-labels" checked></label>
          <div class="ph-playback"><button id="ph-pause">Ⅱ 暂停演示</button><button id="ph-reset-camera">复位视角 ↗</button></div>
          <p class="ph-footnote">水头、流量、效率与出力由 P = ρgQHη 和平滑效率曲线估算，用于理解变化趋势；洞室与设备尺寸为教学近似，不是设计或调度数据。</p>
        </div>
      </div>
    </aside>
    <section id="ph-dash" class="ph-dash" aria-label="机组实时运行工况">
      <div class="ph-dash-head"><b>运行工况</b><span id="ph-state" class="ph-state">并网发电</span></div>
      <label class="ph-range">上游水位 <output id="ph-level-value">825 m</output><input id="ph-level" type="range" min="765" max="825" value="825" step="1"></label>
      <label class="ph-range">导叶开度 <output id="ph-gate-value">72%</output><input id="ph-gate" type="range" min="0" max="100" value="72" step="1"></label>
      <div class="ph-metrics">
        <div><small>毛水头 / 净水头</small><b id="ph-head">235 / 230 m</b></div>
        <div><small>过机流量</small><b id="ph-flowrate">429 m³/s</b></div>
        <div><small>水轮机效率</small><b id="ph-eff">95.8%</b></div>
        <div class="power"><small>发电机出力</small><b id="ph-power">919 MW</b></div>
        <div><small>转速 · 频率</small><b id="ph-speed">111.1 r/min · 50 Hz</b></div>
        <div><small>24 kV 定子电流</small><b id="ph-current">24.6 kA</b></div>
      </div>
      <div class="ph-chain" aria-label="能量去向"><div id="ph-chain-bar"></div><small id="ph-chain-text"></small></div>
      <div class="ph-wave"><canvas id="ph-wave" width="560" height="120" aria-label="三相交流电压波形"></canvas><small id="ph-wave-text">转子转 1 圈，每相电压变化 27 个周期</small></div>
      <p id="ph-operation" class="ph-operation"></p>
      <label class="ph-option"><span>按真实转速 111.1 r/min 显示</span><input type="checkbox" id="ph-realspeed"></label>
      <small class="ph-speed-note" id="ph-speed-note">当前画面慢放 20 倍，便于看清磁极与叶片</small>
    </section>
    <div id="ph-labels-layer" aria-hidden="true"></div>
    <div class="ph-bottom"><div class="ph-legend"><span class="water">水流</span><span class="mechanical">机械传动</span><span class="electric">电能输出</span></div></div>`;
  document.body.append(ui);
  const labelLayer=$('#ph-labels-layer');
  const labels=PARTS.map(([key,text,type],i)=>{
    const el=document.createElement('div');el.className=`ph-label ${type}`;el.innerHTML=`<i></i><span><b>${String(i+1).padStart(2,'0')}</b>${text}</span>`;labelLayer.append(el);return {key,el};
  });
  let op=operatingPoint(),realSpeed=false;const governor=createSpeedGovernor();
  let model=null,hallReflection=null,active=false,loading=false,mode='unit',bank=0,unit=0,step=-1,running=true,showLabels=true,exploded=false,saved=null,labelFrame=0;
  const lightGroup=new THREE.Group();lightGroup.name='地下展陈照明';lightGroup.visible=false;
  lightGroup.add(new THREE.HemisphereLight(0xc9e9ff,0x24404a,1.3));
  const key=new THREE.DirectionalLight(0xe3f4ff,2.6);key.position.set(70,120,100);lightGroup.add(key);
  const rim=new THREE.DirectionalLight(0x719dcf,1.1);rim.position.set(-30,60,-60);lightGroup.add(rim);
  scene.add(lightGroup);
  function resize(){
    if(!active)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    rig.camera.setViewOffset(w,h,w>850?(mode==="unit"?-10:150):0,w<=850&&!ui.classList.contains('ph-collapsed')?Math.min(140,h*.17):0,w,h);
  }
  function syncAudit(){if(active&&model)canvas.dataset.powerhouse=JSON.stringify({...model.audit(),running,step,operating:{state:op.state,powerMW:Math.round(op.generatorMW),flow:Math.round(op.flow),head:Math.round(op.gross)}});else delete canvas.dataset.powerhouse;}
  function cameraView(){
    const origin=model.origin;let eye,target;
    if(mode==='unit'){
      const base=step>=0?STEPS[step]:{eye:exploded?[59,57,84]:[54,37,77],target:exploded?[0,26,0]:[-3,10,1]};
      // 电能输出一步需朝向本岸主变洞：右岸镜像。
      const s=base.mirror&&bank?{eye:[-base.eye[0],base.eye[1],base.eye[2]],target:[-base.target[0],base.target[1],base.target[2]]}:base;
      eye=new THREE.Vector3(...s.eye).add(origin);target=new THREE.Vector3(...s.target).add(origin);
      rig.controls.minDistance=6;rig.controls.maxDistance=170;rig.camera.near=.12;rig.camera.fov=42;
    }else if(mode==='hall'){
      const p=new THREE.Vector3(...BANK_CENTRES[bank]);eye=p.clone().add(new THREE.Vector3(6,39,198));target=p.clone().add(new THREE.Vector3(-1,37,-110));
      rig.controls.minDistance=1;rig.controls.maxDistance=650;rig.camera.near=.2;rig.camera.fov=59;
    }else{
      eye=new THREE.Vector3(1230,1070,1630);target=new THREE.Vector3(0,110,-60);rig.controls.minDistance=160;rig.controls.maxDistance=3500;rig.camera.near=2;rig.camera.fov=47;
    }
    rig.controls.maxPolarAngle=Math.PI*.94;rig.controls.minPolarAngle=.03;rig.controls.enableDamping=false;
    rig.camera.position.copy(eye);rig.controls.target.copy(target);rig.controls.update();resize();rig.camera.updateProjectionMatrix();
  }
  function setMode(value){
    mode=value;model.setMode(mode);
    hallReflection?.disable();
    if(saved){for(const [o,visible] of saved.objects)if(o.isLight)o.visible=mode==='system'&&visible;scene.fog=mode==='system'?saved.fog:null;}
    lightGroup.visible=mode!=='system';
    $('#ph-location').textContent=`${bank===0?'左岸':'右岸'}厂房 · ${String(bank*8+unit+1).padStart(2,'0')} 号机组`;
    $('#ph-unit-controls').hidden=mode!=='unit';labelLayer.hidden=mode!=='unit';
    $('.ph-steps').hidden=mode!=='unit';$('.ph-step-nav').hidden=mode!=='unit';
    $('#ph-unit-select').hidden=mode!=='unit';$('#ph-rock-control').hidden=mode==='hall';
    document.querySelectorAll('[data-ph-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phView===mode)));
    $('#ph-dash').hidden=mode!=='unit';
    if(mode!=='unit'){
      const t=MODE_TEXT[mode];$('#ph-tag').textContent=t.tag;$('#ph-title').textContent=mode==='hall'?`${bank===0?'左岸':'右岸'}厂房 · ${t.title}`:t.title;
      setFacts(t.text,t.facts);
    }else setStepText();
    cameraView();syncAudit();
  }
  function setStepText(){
    const s=STEPS[step];$('#ph-tag').textContent=s?s.tag:'OVERVIEW / 完整机组';$('#ph-title').textContent=s?s.title:'一台机组，三种能量';
    setFacts(s?s.text:'水能 → 机械能 → 电能。上方是发电机（转子、定子），下方是水轮机（蜗壳、导叶、转轮），中间由一根立轴相连。用 1–8 步或键盘 ← → 逐步观察；左侧“运行工况”可调节水位和导叶开度，看出力怎样变化。',
      s?s.facts:[['单机容量','100 万 kW'],['额定转速','111.1 r/min'],['额定水头','202 m'],['额定电压','24 kV']]);
    if(s)model?.configure({field:Boolean(s.field)||$('#ph-field').checked});

    document.querySelectorAll('[data-ph-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.phStep)===step)));
  }
  function setFacts(text,facts=[]){
    $('#ph-description').textContent=text;
    $('#ph-facts').innerHTML=facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }
  function setStep(value){step=value;setMode('unit');}
  async function enter(initial='system'){
    if(active){setMode(initial);return;}if(loading)return;loading=true;const button=$('#powerhouse-button');button.disabled=true;button.textContent='正在构建内部机组…';
    try{
      beforeEnter();
      if(!model){const {createPowerhouseModel}=await import('./powerhouse-model.js');model=createPowerhouseModel();model.root.visible=false;scene.add(model.root);hallReflection=createHallReflection(model,lightGroup);}
      saved={objects:scene.children.filter(o=>o!==model.root&&o!==lightGroup).map(o=>[o,o.visible]),background:scene.background,fog:scene.fog,override:scene.overrideMaterial,exposure:renderer.toneMappingExposure,position:rig.camera.position.clone(),target:rig.controls.target.clone(),fov:rig.camera.fov,near:rig.camera.near,min:rig.controls.minDistance,max:rig.controls.maxDistance,polar:rig.controls.maxPolarAngle,minPolar:rig.controls.minPolarAngle,damping:rig.controls.enableDamping,localClipping:renderer.localClippingEnabled,terrainMaterials:[],xray:new Map()};
      // 仅改变覆盖岩体的透明度，不移动地下设备，不切掉原有水面三角形。
      const forest=terrain.getObjectByName('Canyon natural ridge forest');saved.forest=[forest,forest.visible];forest.visible=false;
      terrain.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;const source=o.material;if(!saved.xray.has(source)){const copy=source.clone();copy.onBeforeCompile=source.onBeforeCompile;copy.customProgramCacheKey=source.customProgramCacheKey;copy.transparent=true;copy.opacity=Number($('#ph-rock').value)/100;copy.depthWrite=false;copy.side=THREE.DoubleSide;saved.xray.set(source,copy);}saved.terrainMaterials.push([o,source]);o.material=saved.xray.get(source);});
      scene.overrideMaterial=null;renderer.localClippingEnabled=true;renderer.toneMappingExposure=1.0;
      active=true;model.root.visible=true;lightGroup.visible=true;lightGroup.updateMatrixWorld(true);rig.setOrbit(false);rig.controls.enabled=true;
      document.body.classList.add('powerhouse');document.body.classList.remove('panel-open','clean');ui.hidden=false;
      model.select(bank,unit);recompute();governor.reset(op.gate>.005?UNIT_SPEC.ratedSpeed:0);setMode(initial);model.update(0,running);renderer.shadowMap.needsUpdate=true;$('#ph-exit').focus();
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
  $('#ph-overview').onclick=()=>setStep(-1);
  $('#ph-bank').onchange=choose;$('#ph-unit').onchange=choose;
  $('#ph-cut').onchange=e=>{model.configure({cut:e.target.checked});syncAudit();};
  $('#ph-explode').onchange=e=>{exploded=e.target.checked;step=-1;model.configure({explosion:exploded?1:0});setMode('unit');};
  $('#ph-flow').onchange=e=>model.configure({flow:e.target.checked});$('#ph-field').onchange=e=>model.configure({field:e.target.checked});
  $('#ph-labels').onchange=e=>showLabels=e.target.checked;
  $('#ph-rock').oninput=e=>{const value=Number(e.target.value);$('#ph-rock-value').textContent=value+'%';for(const material of saved.xray.values())material.opacity=value/100;};
  $('#ph-gate').oninput=e=>{const value=Number(e.target.value);$('#ph-gate-value').textContent=value+'%';model.configure({gate:value/100});recompute();syncAudit();};
  $('#ph-level').oninput=e=>{$('#ph-level-value').textContent=e.target.value+' m';recompute();syncAudit();};
  $('#ph-realspeed').onchange=e=>{realSpeed=e.target.checked;$('#ph-speed-note').textContent=realSpeed?'真实转速：每秒约 1.85 圈，54 个磁极快速掠过，屏幕帧率下会出现频闪':'当前画面慢放 20 倍，便于看清磁极与叶片';};
  $('#ph-prev').onclick=()=>setStep(step<=0?STEPS.length-1:step-1);$('#ph-next').onclick=()=>setStep((step+1)%STEPS.length);
  $('#ph-pause').onclick=()=>{running=!running;$('#ph-pause').textContent=running?'Ⅱ 暂停演示':'▶ 继续演示';syncAudit();};$('#ph-reset-camera').onclick=cameraView;
  $('#ph-collapse').onclick=()=>{const collapsed=ui.classList.toggle('ph-collapsed');$('#ph-collapse').textContent=collapsed?'+':'−';$('#ph-collapse').setAttribute('aria-expanded',String(!collapsed));$('#ph-collapse').setAttribute('aria-label',collapsed?'展开讲解面板':'收起讲解面板');resize();};
  window.addEventListener('keydown',e=>{
    if(!active)return;
    // 捕获内部快捷键，防止原场景的空格/数字/F 键抢走相机。
    if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();exit();return;}
    if(e.target.matches('input,select,button'))return;
    if(e.code==='Space'){e.preventDefault();$('#ph-pause').click();}
    if(e.code==='ArrowRight')setStep((step+1)%STEPS.length);if(e.code==='ArrowLeft')setStep((step+STEPS.length-1)%STEPS.length);
    e.stopImmediatePropagation();
  },true);
  window.addEventListener('resize',resize);
  const fmt=(v,d=0)=>v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d});
  function recompute(){
    op=operatingPoint({upstream:Number($('#ph-level').value),tailwater:LEVELS.tailwater,gate:Number($('#ph-gate').value)/100});
    $('#ph-head').textContent=`${fmt(op.gross)} / ${fmt(op.net)} m`;
    $('#ph-flowrate').textContent=`${fmt(op.flow)} m³/s`;
    $('#ph-eff').textContent=op.turbineEff>0?`${fmt(op.turbineEff*100,1)}%`:'—';
    $('#ph-power').textContent=`${fmt(op.generatorMW)} MW`;
    $('#ph-current').textContent=`${fmt(op.currentKA,1)} kA`;
    const state={stopped:'停机',['no-load']:'空载',online:'并网发电',over:'超出额定'}[op.state];
    $('#ph-state').textContent=state;$('#ph-state').dataset.state=op.state;$('#ph-operation').textContent=STATE_TEXT[op.state];
    // 能量去向：以毛水头计的水流功率为 100%。
    const total=Math.max(op.hydraulicMW,1e-6),parts=[['grid',op.gridMW,'送入电网'],['loss-pipe',op.hydraulicMW-op.netHydraulicMW,'引水管道损失'],['loss-turbine',op.netHydraulicMW-op.turbineMW,'水轮机损失'],['loss-electric',op.turbineMW-op.gridMW,'发电机与主变损失']];
    $('#ph-chain-bar').innerHTML=op.hydraulicMW>0?parts.map(([k,v,t])=>`<i class="${k}" style="width:${Math.max(0,v/total*100).toFixed(2)}%" title="${t} ${fmt(v)} MW"></i>`).join(''):'';
    $('#ph-chain-text').textContent=op.hydraulicMW>0?`水流功率 ${fmt(op.hydraulicMW)} MW → 送入电网 ${fmt(op.gridMW)} MW（${fmt(op.gridMW/total*100,1)}%）· 每立方米水约 ${fmt(op.kwhPerM3,2)} kW·h`:'没有水流，也就没有能量输入';
  }
  const wave=ui.querySelector('#ph-wave'),waveCtx=wave.getContext('2d');
  function drawWave(rotorAngle,amplitude){
    const w=wave.width,h=wave.height,mid=h/2;waveCtx.clearRect(0,0,w,h);
    waveCtx.strokeStyle='#2f4b58';waveCtx.lineWidth=1;waveCtx.beginPath();waveCtx.moveTo(0,mid);waveCtx.lineTo(w,mid);waveCtx.stroke();
    // 电角度 = 极对数 × 机械角度；横轴显示 2 个电周期。
    const electrical=rotorAngle*UNIT_SPEC.poles/2;
    ['#dca25a','#d0605a','#4f9fd8'].forEach((color,k)=>{
      waveCtx.strokeStyle=color;waveCtx.lineWidth=2.4;waveCtx.beginPath();
      for(let x=0;x<=w;x+=3){const y=mid-amplitude*(h*.4)*Math.sin(electrical-x/w*Math.PI*4-k*2*Math.PI/3);x?waveCtx.lineTo(x,y):waveCtx.moveTo(x,y);}
      waveCtx.stroke();
    });
  }
  const projection=new THREE.Vector3();
  function update(dt){
    if(!active)return;rig.controls.update();
    const live=running&&!exploded;
    if(live)governor.update(dt,op.gate);
    const speed=governor.speed,omega=speed*2*Math.PI/60*(realSpeed?1:1/20);
    model.update(dt,live,{omega,flowRate:op.flow/600,powerRate:Math.max(0,op.generatorMW)/1000*(speed/UNIT_SPEC.ratedSpeed)});
    rig.camera.updateMatrixWorld();
    if(mode==='unit'&&labelFrame%2===0){
      // 电压幅值正比于转速（励磁不变时）；停机时波形逐渐变平。
      drawWave(model.audit().rotorAngle,speed/UNIT_SPEC.ratedSpeed);
      const hz=speed/60*UNIT_SPEC.poles/2;$('#ph-speed').textContent=`${fmt(speed,1)} r/min · ${fmt(hz,Math.abs(hz-50)<.05?0:1)} Hz`;
    }
    if(mode==='hall')hallReflection.update(renderer,scene,rig.camera,bank);
    if(labelFrame++%4===0){
      const w=canvas.clientWidth,h=canvas.clientHeight,small=w<=850,occupied=[];const focus=step>=0?STEPS[step].parts:null;
      for(const l of labels){
        projection.copy(model.anchor(l.key)).project(rig.camera);const x=(projection.x*.5+.5)*w,y=(-projection.y*.5+.5)*h;
        let visible=showLabels&&mode==='unit'&&Math.abs(projection.x)<.92&&Math.abs(projection.y)<.88&&projection.z<1&&(!focus||focus.includes(l.key));
        if(small&&!focus&&!['runner','stator','rotor','draft','intake'].includes(l.key))visible=false;
        if(x>w-370&&w>850)visible=false;if(w>850&&x<350&&y>190)visible=false;if(y>h-290&&small&&!ui.classList.contains('ph-collapsed'))visible=false;
        if(occupied.some(p=>Math.abs(p.x-x)<150&&Math.abs(p.y-y)<30))visible=false;
        l.el.hidden=!visible;if(visible){l.el.style.left=x+'px';l.el.style.top=y+'px';occupied.push({x,y});}
      }
      syncAudit();
    }
  }
  const hallLocal=new THREE.Vector3();
  function renderHall(){
    if(!active||mode!=='hall')return false;
    model.halls[bank].worldToLocal(hallLocal.copy(rig.camera.position));
    // 只在封闭大厅内部省去被墙/地板完全遮住的室外绘制。移出大厅即恢复完整剖视。
    if(Math.abs(hallLocal.x)>17.5||Math.abs(hallLocal.z)>205||hallLocal.y<28.4||hallLocal.y>63)return false;
    const states=scene.children.map(o=>[o,o.visible]),shadows=renderer.shadowMap.enabled;
    try{for(const [o] of states)o.visible=o===model.root||o===lightGroup;renderer.shadowMap.enabled=false;renderer.render(scene,rig.camera);}
    finally{for(const [o,v] of states)o.visible=v;renderer.shadowMap.enabled=shadows;}
    return true;
  }
  return {enter,exit,update,resize,renderHall,get active(){return active;},get model(){return model;}};
}
