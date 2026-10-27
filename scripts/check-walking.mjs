import {build} from 'esbuild';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'scripts/.walk-audit.mjs');
await build({stdin:{resolveDir:root,contents:`
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWalkWorld} from './src/walk-world.js';
import {createFirstPerson} from './src/first-person.js';
import {createDam} from './src/dam.js';
import {makeMaterials} from './src/materials.js';
import {groundHeight} from './src/ground-surface.js';
import {damPoint} from './src/math.js';
const group=new THREE.Group();
function box(name,size,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...size));m.name=name;m.position.set(...pos);group.add(m);}
box('Concrete wall',[.25,3,8],[2,1.5,0]);box('Walk deck',[5,.3,5],[0,1.85,12]);box('Step slab',[2,.3,2],[0,.15,5]);group.updateMatrixWorld(true);
const world=createWalkWorld([group],()=>0);
assert.equal(world.floor(0,0,.5),0);assert(Math.abs(world.floor(0,12,2.5)-2)<1e-6);
assert.equal(world.floor(0,12,.5),0,'Do not teleport onto overhead decks');
assert(Math.abs(world.floor(0,5,.48)-.3)<1e-6,'Small step is walkable');
assert(world.blocked(1.8,0,0),'Capsule stops before wall');assert(!world.blocked(1.2,0,0),'Open space stays traversable');
assert(!world.blocked(1.8,0,3.1),'A wall below the feet does not block');
const dam=createDam(makeMaterials());dam.updateMatrixWorld(true);const dw=createWalkWorld([dam],groundHeight),p=damPoint(-.55,289);
const crest=dw.floor(p[0],p[2],291);assert(crest>=289&&crest<290,'Spawn is supported by actual crest surface');
// 用实际控制器验证方向键与“不按鼠标键”的输入，覆盖内嵌浏览器拒绝指针锁的情况。
function events(){const listeners=new Map();return {addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},emit(name,event={}){for(const fn of listeners.get(name)||[])fn(event);}};}
globalThis.window=events();globalThis.document={...events(),pointerLockElement:null,body:{classList:{add(){},remove(){}}},exitPointerLock(){this.pointerLockElement=null;this.emit('pointerlockchange');}};
const canvas={...events(),dataset:{},requestPointerLock(){throw new Error('Unavailable in embedded browser');}};
const camera=new THREE.PerspectiveCamera(),controls={enabled:true,target:new THREE.Vector3()};camera.rotation.y=Math.PI;
const walker=createFirstPerson({canvas,rig:{camera,controls,setOrbit(){}},roots:[],heightAt:()=>289,onStart(){},onChange(){}});
const observer=camera.position.clone();walker.start();assert(walker.selecting&&!walker.active);assert(camera.position.equals(observer));assert(!walker.confirm(),'No default spawn before choosing');
assert(walker.pick(new THREE.Vector3(40,289,-400)));assert(!walker.active,'Choosing only marks the spot');
assert(walker.pick(new THREE.Vector3(55,289,-420)));assert(walker.confirm());assert(walker.active);
assert(camera.position.distanceTo(new THREE.Vector3(55,290.7,-420))<1e-6,'Confirm uses the latest selected point plus eye height');
function key(code){window.emit('keydown',{code,preventDefault(){},stopImmediatePropagation(){}});walker.update(1);window.emit('keyup',{code});}
const origin=camera.position.clone(),initialDirection=camera.quaternion.clone();
key('ArrowUp');assert(Math.abs(camera.position.z-origin.z-10.8)<1e-5,'Walking speed is exactly three times the previous speed');
key('ArrowDown');assert(camera.position.distanceTo(origin)<1e-5,'Down moves backward');
key('ArrowRight');assert(camera.position.x<origin.x-10.7,'Right strafes relative to view');
key('ArrowLeft');assert(camera.position.distanceTo(origin)<1e-5,'Left strafes relative to view');
assert(camera.quaternion.angleTo(initialDirection)<1e-6,'Arrow keys must not turn the camera');
window.emit('keydown',{code:'ShiftLeft',preventDefault(){},stopImmediatePropagation(){}});key('ArrowUp');
assert(Math.abs(camera.position.z-origin.z-19.2)<1e-5,'Sprint speed is three times previous speed');window.emit('keyup',{code:'ShiftLeft'});
document.emit('mousemove',{target:canvas,clientX:100,clientY:100,buttons:0});
document.emit('mousemove',{target:canvas,clientX:150,clientY:130,buttons:0});walker.update(.016);
const state=JSON.parse(canvas.dataset.walkState);assert(Math.abs(state.yaw-(Math.PI-.1))<1e-6);assert(Math.abs(state.pitch-(-.14))<1e-6);assert.equal(state.mouseMode,'free');
const frozen=camera.quaternion.clone();canvas.emit('mousedown',{button:0});
document.emit('mousemove',{target:canvas,clientX:350,clientY:200,buttons:1,shiftKey:true});assert(camera.quaternion.angleTo(frozen)<1e-6,'Shift plus left pauses free mouse look');
window.emit('mouseup',{button:0});document.emit('mousemove',{target:canvas,clientX:355,clientY:200,buttons:0,shiftKey:true});walker.update(.016);
assert(Math.abs(JSON.parse(canvas.dataset.walkState).yaw-(Math.PI-.11))<1e-6,'Releasing left resumes without accumulated movement');
document.pointerLockElement=canvas;document.emit('pointerlockchange');
document.emit('mousemove',{target:canvas,movementX:200,movementY:50,buttons:1,shiftKey:true});walker.update(.016);
assert(Math.abs(JSON.parse(canvas.dataset.walkState).yaw-(Math.PI-.11))<1e-6,'Shift plus left also pauses locked mouse');
document.emit('mousemove',{target:canvas,movementX:25,movementY:-10,buttons:0});walker.update(.016);
assert(Math.abs(JSON.parse(canvas.dataset.walkState).yaw-(Math.PI-.16))<1e-6,'Locked mouse also turns without buttons');
document.exitPointerLock();assert(!walker.active,'Unlock exits cleanly');assert(controls.enabled);
walker.start();walker.pick(new THREE.Vector3(0,289,0));walker.stop();assert(!walker.selecting&&!walker.active&&walker.selected===null,'Cancel discards pending selection');
// 触屏与键盘共用移动物理：斜向不加速，转头限幅，释放后不粘键。
walker.start();walker.pick(new THREE.Vector3(0,289,0));walker.confirm();
const touchOrigin=camera.position.clone();walker.setTouchKey('ArrowUp',true);walker.setTouchKey('ArrowRight',true);walker.update(1);
assert(Math.abs(camera.position.distanceTo(touchOrigin)-10.8)<1e-5,'Touch diagonal speed stays normalized');
walker.clearTouch();const released=camera.position.clone();walker.update(.2);assert(camera.position.distanceTo(released)<1e-5,'Touch release stops movement');
const touchLook=camera.quaternion.clone();walker.turn(30,20);assert(camera.quaternion.angleTo(touchLook)>.05,'Touch drag turns the view');
walker.turn(0,100000);walker.update(.01);assert.equal(JSON.parse(canvas.dataset.walkState).pitch,-1.5,'Touch vertical look is clamped');
walker.setTouchKey('Space',true);walker.update(.1);assert(camera.position.y>released.y,'Touch jump works');walker.stop();
// 快速跑动跨越长帧时仍不得穿过 25 cm 薄墙。
const obstacle=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(.25,3,8));wall.name='Concrete wall';wall.position.set(2,290.5,0);obstacle.add(wall);obstacle.updateMatrixWorld(true);
const c2=new THREE.PerspectiveCamera(),fast=createFirstPerson({canvas,rig:{camera:c2,controls,setOrbit(){}},roots:[obstacle],heightAt:()=>289,onStart(){},onChange(){}});
fast.start();assert(!fast.pick(new THREE.Vector3(1.9,289,0)),'Reject spawn inside wall');assert(fast.pick(new THREE.Vector3(0,289,0)));fast.confirm();
for(const code of ['ShiftLeft','ArrowRight'])window.emit('keydown',{code,preventDefault(){},stopImmediatePropagation(){}});
fast.update(.5);assert(c2.position.x>1&&c2.position.x<1.53,'Fast movement stops before a thin wall');fast.stop();
console.log(JSON.stringify({passed:true,crestFeet:crest,collisionCells:dw.cellCount,checks:['select then confirm','replace selected position','cancel selection','3x walk and sprint','four arrow directions','free mouse look','Shift-left freeze and seamless release','locked mouse look','fast thin-wall collision','unlock exit']}));
`},outfile:out,bundle:true,platform:'node',format:'esm',alias:{three:path.join(root,'vendor/three.module.js')}});
try{await import(pathToFileURL(out));}finally{await rm(out,{force:true});}
