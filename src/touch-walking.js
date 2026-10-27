// 多指可同时按移动键和拖动画面；取消、失焦或切后台会释放按键。
export function installTouchWalking(canvas,walker){
  const held=new Map();let lookPointer=null;
  for(const button of document.querySelectorAll('[data-walk-key]')){
    button.addEventListener('pointerdown',e=>{
      if(!walker.active)return;
      e.preventDefault();button.setPointerCapture(e.pointerId);
      held.set(e.pointerId,{button,code:button.dataset.walkKey});
      button.classList.add('pressed');walker.setTouchKey(button.dataset.walkKey,true);
    });
    const release=e=>{
      const item=held.get(e.pointerId);if(!item)return;
      held.delete(e.pointerId);
      if(![...held.values()].some(v=>v.code===item.code)){walker.setTouchKey(item.code,false);item.button.classList.remove('pressed');}
    };
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
    button.addEventListener('contextmenu',e=>e.preventDefault());
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!walker.active||e.pointerType==='mouse'||lookPointer)return;
    e.preventDefault();canvas.setPointerCapture(e.pointerId);lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener('pointermove',e=>{
    if(!lookPointer||lookPointer.id!==e.pointerId)return;
    walker.turn(e.clientX-lookPointer.x,e.clientY-lookPointer.y);lookPointer.x=e.clientX;lookPointer.y=e.clientY;
  });
  const releaseLook=e=>{if(lookPointer?.id===e.pointerId)lookPointer=null;};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,releaseLook);
  function reset(){for(const {button} of held.values())button.classList.remove('pressed');held.clear();lookPointer=null;walker.clearTouch();}
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  return {reset};
}
