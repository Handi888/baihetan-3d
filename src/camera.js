import * as THREE from 'three';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {PARAMS as P,PRESETS} from './config.js';
import {terrainHeight,faceZ,section} from './math.js';
import {groundHeight} from './ground-surface.js';
export function safeAltitude(x,z){
  let h=Math.max(terrainHeight(x,z),groundHeight(x,z));
  if(z<faceZ(x,P.water.upstream,1))h=Math.max(h,P.water.upstream);
  else h=Math.max(h,P.water.downstream);
  const s=section(P.dam.height);
  if(Math.abs(x)<s.halfWidth+35&&z>faceZ(x,P.dam.height,1)-40&&z<faceZ(x,P.dam.height,-1)+155)h=Math.max(h,P.dam.height+20);
  return h+(z<-1800?7:P.camera.clearance);
}
const eyeKeys=[[300,610,1200],[210,520,850],[30,455,660],[-270,570,560],[-365,800,90],[-320,860,-600],[0,1070,-230]];
const targetKeys=[[0,170,-50],[0,173,-95],[0,191,-120],[0,211,-130],[0,239,-100],[0,252,-50],[0,176,-65]];
const eyeCurve=new THREE.CatmullRomCurve3(eyeKeys.map(v=>new THREE.Vector3(...v)),false,'centripetal');
const targetCurve=new THREE.CatmullRomCurve3(targetKeys.map(v=>new THREE.Vector3(...v)),false,'centripetal');
export function filmSample(t){
  const eased=t*t*(3-2*t),eye=eyeCurve.getPoint(eased),target=targetCurve.getPoint(eased);
  eye.y=Math.max(eye.y,safeAltitude(eye.x,eye.z));return {eye,target};
}
export function createCamera(canvas){
  const camera=new THREE.PerspectiveCamera(P.camera.fov,1,P.camera.near,P.camera.far);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=25;controls.maxDistance=16000;controls.maxPolarAngle=Math.PI*.495;controls.screenSpacePanning=true;controls.zoomSpeed=.8;controls.panSpeed=.65;
  controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  let transition=null,film=false,filmTime=0,orbit=false;
  function preset(name,immediate=false){const p=PRESETS[name]||PRESETS.downstream;orbit=false;film=false;controls.enabled=true;
    if(immediate){camera.position.set(...p.eye);controls.target.set(...p.target);transition=null;controls.update();}
    else transition={from:camera.position.clone(),target:controls.target.clone(),to:new THREE.Vector3(...p.eye),next:new THREE.Vector3(...p.target),time:0};
  }
  preset('downstream',true);
  controls.addEventListener('start',()=>{transition=null;orbit=false;});
  return {camera,controls,preset,
    setOrbit(value){orbit=value;film=false;transition=null;},
    startFilm(){film=true;filmTime=0;orbit=false;transition=null;controls.enabled=false;},
    stopFilm(){film=false;controls.enabled=true;controls.update();},
    get filmTime(){return filmTime;},get filming(){return film;},get orbit(){return orbit;},
    sampleFilm(t){const s=filmSample(t);camera.position.copy(s.eye);controls.target.copy(s.target);camera.lookAt(s.target);},
    update(dt,paused){
      if(film){if(!paused)filmTime=Math.min(P.camera.filmSeconds,filmTime+dt);this.sampleFilm(filmTime/P.camera.filmSeconds);return filmTime>=P.camera.filmSeconds;}
      if(transition){transition.time+=dt;const length=transition.from.distanceTo(transition.to),duration=length>2500?4.5:1.25,t=Math.min(1,transition.time/duration),e=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,e);controls.target.lerpVectors(transition.target,transition.next,e);
        // 跨区时抬高飞越山脊，在同一世界空间连续移动，不隐藏或换载模型。
        if(length>2500)camera.position.y+=Math.sin(Math.PI*e)*Math.min(1200,length*.17);if(t===1)transition=null;}
      if(orbit&&!paused){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),dt*.09);camera.position.copy(controls.target).add(offset);}
      controls.update();camera.position.y=Math.max(camera.position.y,safeAltitude(camera.position.x,camera.position.z));camera.lookAt(controls.target);return false;
    },
  };
}
