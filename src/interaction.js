// DOM and keyboard bindings live separately from scene construction and camera math.
export function installInteractions(api){
  const $=s=>document.querySelector(s);
  const {rig,setView,setGray,setQuality,snapshot,startFilm,stopFilm,togglePause,pointerActive}=api;
  function closePanel(){document.body.classList.remove('panel-open');const t=$('#panel-toggle');if(t)t.textContent='控制 ☰';}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.view);closePanel();});
  const panelToggle=$('#panel-toggle');
  if(panelToggle)panelToggle.onclick=()=>{
    const open=document.body.classList.toggle('panel-open');
    panelToggle.textContent=open?'关闭 ✕':'控制 ☰';
  };
  const backdrop=$('#panel-backdrop');
  if(backdrop)backdrop.onclick=closePanel;
  window.addEventListener('orientationchange',()=>setTimeout(()=>closePanel(),300));
  $('#toggle-labels').onchange=e=>api.setLabels(e.target.checked);
  $('#toggle-orbit').onchange=e=>rig.setOrbit(e.target.checked);
  rig.controls.addEventListener('start',()=>$('#toggle-orbit').checked=false);
  $('#toggle-water').onchange=e=>api.setWaterMoving(e.target.checked);
  $('#toggle-water-wire').onchange=e=>api.setWaterWire(e.target.checked);
  $('#toggle-powerlines').onchange=e=>api.setPowerlines(e.target.checked);
  $('#toggle-plants').onchange=e=>api.setPlants(e.target.checked);
  $('#toggle-flow').onchange=e=>api.setFlow(e.target.checked);
  $('#toggle-gray').onchange=e=>setGray(e.target.checked);
  $('#quality').onchange=e=>setQuality(e.target.value);
  $('#pause-button').onclick=togglePause;
  $('#reset-button').onclick=()=>{if(api.isFilming())stopFilm();setView('downstream');};
  function cleanView(){const clean=document.body.classList.toggle('clean');$('#clean-view').innerHTML=clean?'显示界面 <span>H</span>':'净览 <span>H</span>';$('#clean-view').setAttribute('aria-pressed',String(clean));}
  $('#clean-view').onclick=cleanView;
  $('#capture-button').onclick=snapshot;
  $('#film-button').onclick=()=>{closePanel();startFilm();};$('#record-button').onclick=()=>{closePanel();startFilm(true);};$('#exit-film').onclick=stopFilm;
  window.addEventListener('pointermove',pointerActive);window.addEventListener('pointerdown',pointerActive);
  $('#reference-button').onclick=()=>$('#reference-dialog').showModal();$('#help-button').onclick=()=>$('#help-dialog').showModal();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  window.addEventListener('keydown',e=>{
    if(e.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
    if(e.code==='Escape'&&api.isFilming()){stopFilm();return;}
    if(e.code==='Space'){e.preventDefault();togglePause();}
    if(e.code==='KeyF')startFilm();if(e.code==='KeyR'){if(api.isFilming())stopFilm();setView('downstream');}
    if(e.code==='KeyH')cleanView();
    if(!api.isFilming()){
      if(['1','2','3','4'].includes(e.key))setView(['downstream','upstream','overhead','side'][Number(e.key)-1]);
      if(e.code==='KeyL'){$('#toggle-labels').checked=!api.getLabels();api.setLabels($('#toggle-labels').checked);}
    }
  });
}
