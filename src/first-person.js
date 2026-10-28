import * as THREE from 'three';
import {faceZ} from './math.js';
import {createWalkWorld} from './walk-world.js';

export function createFirstPerson({canvas,rig,roots,heightAt,bounds=null,onStart,onChange}){
  let active=false,selecting=false,selected=null,world=null,yaw=0,pitch=0,vy=0,grounded=false,locked=false,lastMouse=null,oldFov=43,leftHeld=false;
  const keys=new Set(),touchKeys=new Set(),euler=new THREE.Euler(0,0,0,'YXZ'),eye=1.7;
  const pressed=code=>keys.has(code)||touchKeys.has(code);
  const shifting=()=>pressed('ShiftLeft')||pressed('ShiftRight');
  const clearInput=()=>{keys.clear();touchKeys.clear();lastMouse=null;leftHeld=false;};
  function look(){euler.set(pitch,yaw,0);rig.camera.quaternion.setFromEuler(euler);}
  function stop(){selecting=false;selected=null;canvas.dataset.walkPick='';document.body.classList.remove('selecting-walk');if(!active)return;active=false;clearInput();locked=false;document.body.classList.remove('walking');
    if(document.pointerLockElement===canvas)document.exitPointerLock();
    rig.camera.fov=oldFov;rig.camera.near=1;rig.camera.updateProjectionMatrix();
    rig.controls.target.copy(rig.camera.position).addScaledVector(rig.camera.getWorldDirection(new THREE.Vector3()),30);rig.controls.enabled=true;onChange(false);
  }
  function start(){
    if(active||selecting)return;
    onStart();rig.setOrbit(false);selecting=true;selected=null;clearInput();
    document.body.classList.add('selecting-walk');document.body.classList.remove('panel-open');canvas.dataset.walkPick='';
  }
  function pick(point,water=false){
    if(!selecting)return false;
    world??=createWalkWorld(roots,heightAt,bounds);
    if(!world.contains(point.x,point.z))return false;
    const floor=water?point.y:world.floor(point.x,point.z,point.y+.48);
    // 用同一碰撞支持面验收起点，拒绝陡壁、无支撑位置和不足以容纳身体的窄缝。
    if(!Number.isFinite(floor)||Math.abs(floor-point.y)>1||world.blocked(point.x,point.z,floor))return false;
    selected=new THREE.Vector3(point.x,floor,point.z);canvas.dataset.walkPick=JSON.stringify(selected.toArray());return true;
  }
  function confirm(){
    if(!selecting||!selected)return false;
    // 在入口点击的用户手势内立即申请锁定，避免构建碰撞索引后手势失效。
    if(!globalThis.matchMedia?.('(pointer:coarse)')?.matches){try{canvas.requestPointerLock?.()?.catch?.(()=>{});}catch{}}
    active=true;selecting=false;clearInput();vy=0;grounded=true;
    euler.setFromQuaternion(rig.camera.quaternion,'YXZ');yaw=euler.y;pitch=-.08;
    rig.camera.position.copy(selected);rig.camera.position.y+=eye;
    oldFov=rig.camera.fov;rig.camera.fov=70;rig.camera.near=.08;rig.camera.updateProjectionMatrix();rig.controls.enabled=false;
    document.body.classList.add('walking');document.body.classList.remove('selecting-walk');look();onChange(true);return true;
  }
  document.addEventListener('pointerlockchange',()=>{
    const wasLocked=locked;locked=document.pointerLockElement===canvas;lastMouse=null;
    if(active&&wasLocked&&!locked)stop();
    // 用户快速退出时，忽略随后才完成的锁定请求。
    if(!active&&locked){locked=false;document.exitPointerLock();}
  });
  document.addEventListener('mousemove',e=>{
    if(!active||e.sourceCapabilities?.firesTouchEvents)return;
    let dx,dy;
    if(document.pointerLockElement===canvas){dx=e.movementX;dy=e.movementY;}
    else{
      // 内嵌浏览器可能不开放指针锁：鼠标在画面上移动就转头，始终无需按键。
      if(e.target!==canvas){lastMouse=null;return;}
      const previous=lastMouse;lastMouse={x:e.clientX,y:e.clientY};if(!previous)return;
      dx=e.clientX-previous.x;dy=e.clientY-previous.y;
    }
    // 组合键按住期间仍更新自由鼠标的基准，松开后不会补转之前积累的位移。
    if((e.shiftKey||shifting())&&((e.buttons&1)||leftHeld))return;
    yaw-=dx*.002;pitch=THREE.MathUtils.clamp(pitch-dy*.002,-1.5,1.5);look();
  });
  canvas.addEventListener('mousedown',e=>{if(active&&e.button===0)leftHeld=true;});
  window.addEventListener('mouseup',e=>{if(e.button===0)leftHeld=false;});
  canvas.addEventListener('mouseleave',()=>lastMouse=null);
  window.addEventListener('keydown',e=>{if(!active&&!selecting)return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){stop();return;}if(selecting){if(e.code==='Enter')confirm();return;}keys.add(e.code);if(e.code==='Space'&&grounded){vy=7.2;grounded=false;}},true);
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);
  // 触屏输入复用同一物理移动和碰撞逻辑，不生成假键盘事件。
  return {get active(){return active;},get selecting(){return selecting;},get selected(){return selected;},start,pick,confirm,stop,
    setTouchKey(code,down){if(!active)return;if(down){touchKeys.add(code);if(code==='Space'&&grounded){vy=7.2;grounded=false;}}else touchKeys.delete(code);},
    clearTouch(){touchKeys.clear();},
    turn(dx,dy){if(!active)return;yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch-dy*.003,-1.5,1.5);look();},
    update(dt){
    if(!active)return;
    // 小步积分避免慢帧穿墙；每次最多移动约 12 cm。
    const speed=shifting()?19.2:10.8,steps=Math.max(1,Math.ceil(dt/Math.min(.016,.12/speed))),h=dt/steps,p=rig.camera.position;
    for(let n=0;n<steps;n++){
      let f=Number(pressed('ArrowUp')||pressed('KeyW'))-Number(pressed('ArrowDown')||pressed('KeyS')),
        r=Number(pressed('ArrowRight')||pressed('KeyD'))-Number(pressed('ArrowLeft')||pressed('KeyA')),len=Math.hypot(f,r)||1;
      const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)/len*speed*h,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)/len*speed*h,feet=p.y-eye;
      if(!world.blocked(p.x+dx,p.z,feet))p.x+=dx;if(!world.blocked(p.x,p.z+dz,feet))p.z+=dz;
      const floor=world.floor(p.x,p.z,feet+.48),level=p.z<faceZ(p.x,259,0)?259:24;
      const swimming=floor<level-1.2&&feet<level-.7;
      if(swimming){vy+=(level+.45-p.y)*6*h;vy*=Math.exp(-4*h);if(pressed('Space'))vy=2;if(pressed('ControlLeft'))vy=-2;grounded=false;}
      else vy-=24*h;
      p.y+=vy*h;if(p.y-eye<=floor){p.y=floor+eye;vy=0;grounded=true;}else if(p.y-eye>floor+.1)grounded=false;
    }
    look();canvas.dataset.walkState=JSON.stringify({active:true,eye:p.toArray(),grounded,yaw,pitch,speed,lookPaused:shifting()&&leftHeld,mouseMode:document.pointerLockElement===canvas?'locked':'free'});
  }};
}
