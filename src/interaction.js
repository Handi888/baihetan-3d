// 精简入口；漫游与地下机组各自处理键盘，避免教学/行走时误切场景。
export function installInteractions(api){
  const $=s=>document.querySelector(s),views=['engineering','upstream','park','overhead'];
  function closePanel(){document.body.classList.remove('panel-open');$('#panel-toggle').textContent='控制 ☰';}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{api.setView(b.dataset.view);closePanel();});
  $('#panel-toggle').onclick=()=>{$('#panel-toggle').textContent=document.body.classList.toggle('panel-open')?'关闭 ✕':'控制 ☰';};
  $('#panel-backdrop').onclick=closePanel;
  window.addEventListener('orientationchange',closePanel);
  $('#toggle-water').onchange=e=>api.setWaterMoving(e.target.checked);
  $('#toggle-flow').onchange=e=>api.setFlow(e.target.checked);
  $('#quality').onchange=e=>api.setQuality(e.target.value);
  $('#pause-button').onclick=api.togglePause;
  $('#reset-button').onclick=()=>api.setView('engineering');
  $('#capture-button').onclick=api.snapshot;
  function cleanView(){const clean=document.body.classList.toggle('clean');$('#clean-view').innerHTML=clean?'显示界面 <span>H</span>':'净览 <span>H</span>';$('#clean-view').setAttribute('aria-pressed',String(clean));}
  $('#clean-view').onclick=cleanView;
  window.addEventListener('keydown',e=>{
    if(e.target.matches('input,select,textarea,button')||document.body.classList.contains('powerhouse')||document.body.classList.contains('walking'))return;
    if(e.code==='Space'){e.preventDefault();api.togglePause();}
    if(e.code==='KeyR')api.setView('engineering');
    if(e.code==='KeyH')cleanView();
    if(['1','2','3','4'].includes(e.key))api.setView(views[Number(e.key)-1]);
  });
}
