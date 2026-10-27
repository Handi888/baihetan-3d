import * as THREE from 'three';
import {prepareRigGeometry} from './creature-rig.js';
import {prepareSoftTargets,softMotionAt} from './creature-soft-motion.js';

// 所有个体共享一份网格、一组贴图、一次实例化绘制。
// 鳍、头、尾的连续权重仍来自原模型，摆动在 GPU 内完成。
export function createCreatureInstances(source,material,count){
  const geometry=prepareRigGeometry(source),pose=new Float32Array(count*4),behavior=new Float32Array(count),airTuck=new Float32Array(count),softPose=new Float32Array(count*2);
  geometry.setAttribute('jointWeights',geometry.attributes.skinWeight);
  geometry.deleteAttribute('skinWeight');geometry.deleteAttribute('skinIndex');
  prepareSoftTargets(geometry);
  geometry.setAttribute('actorPose',new THREE.InstancedBufferAttribute(pose,4));
  geometry.setAttribute('restBlend',new THREE.InstancedBufferAttribute(behavior,1));
  geometry.setAttribute('airTuck',new THREE.InstancedBufferAttribute(airTuck,1));
  geometry.setAttribute('softPose',new THREE.InstancedBufferAttribute(softPose,2));
  const functions=`
    attribute vec4 jointWeights; attribute vec4 actorPose; attribute float restBlend; attribute float airTuck;
    attribute vec2 softPose; attribute vec3 blinkDelta,bellyDelta,blinkNormal,bellyNormal;
    vec3 turnX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
    vec3 turnY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
    vec3 turnZ(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
    vec3 spineTurn(vec3 v){return turnZ(turnX(v,sin(actorPose.x-1.)*.035*actorPose.y+.18*airTuck),sin(actorPose.x*.43)*.025*actorPose.y);}
    vec3 deform(vec3 v,float isPoint){
      vec3 spine=vec3(0.,-.1,0.)*isPoint;
      float side=position.x<0.?-1.:1.;
      vec3 fin=vec3(side*.135,.03,.025)*isPoint;
      vec3 head=vec3(0.,.24,.025)*isPoint,tail=vec3(0.,-.29,-.08)*isPoint;
      vec3 a=spineTurn(v-spine)+spine;
      // 游动双鳍有相位差，拍水和回收交替；休息时两侧分别执行不同动作。
      float stroke=actorPose.x+side*.55;
      vec3 swimmingFin=turnZ(turnX(v-fin,cos(stroke)*.65*actorPose.y),side*(.20+.58*sin(stroke)*actorPose.y));
      swimmingFin=mix(swimmingFin,turnZ(turnX(v-fin,-.35),-side*.8),airTuck*.85);
      vec3 restingFin;
      if(side>0.){
        // 下侧鳍向头部弯起，鳍尖托住脸颊；仅保留轻微呼吸动作。
        restingFin=turnX(turnZ(v-fin,1.86),-.82+.025*sin(actorPose.x*.34));
      }else{
        // 上侧鳍跨向腹部，抬起—轻拍—抬起，避免双鳍同步僵摆。
        float pat=.5+.5*sin(actorPose.x*.62);
        restingFin=turnX(turnY(v-fin,-.45+1.10*pat),-.08+.24*pat);
      }
      vec3 b=mix(swimmingFin,restingFin,restBlend)+fin;
      b=spineTurn(b-spine)+spine;
      // 原模型尾部向背侧上翘，先放平尾柄，再作海豚式上下拍动。
      // 游泳中心降低，尾鳍整个推进周期留在水下；跃出时仍延续摆尾。
      float tailBend=mix(-1.15,-.20,restBlend)+sin(actorPose.x-1.)*.50*actorPose.y+.35*airTuck;
      vec3 c=turnZ(turnX(v-tail,tailBend),sin(actorPose.x*.47)*.055*actorPose.y)+tail;
      vec3 d=turnY(turnX(v-head,actorPose.z),actorPose.w)+head;d=spineTurn(d-spine)+spine;
      return a*jointWeights.x+b*jointWeights.y+c*jointWeights.z+d*jointWeights.w;
    }`;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+functions)
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=normalize(deform(normalize(objectNormal+blinkNormal*softPose.x+bellyNormal*softPose.y),0.));')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=deform(position+blinkDelta*softPose.x+bellyDelta*softPose.y,1.);');
  };
  material.customProgramCacheKey=()=> 'shared-weighted-creature-v4';
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;
  const dummy=new THREE.Object3D(),rollAxis=new THREE.Vector3(0,1,0),rollQ=new THREE.Quaternion(),trickEuler=new THREE.Euler(0,0,0,'XYZ');
  return {mesh,write(i,a,s,t){
    // 原模型长轴为局部 Y；侧躺必须绕这个轴滚转，不能用欧拉 Z 将身体在水平面转向。
    dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(s.pitch,s.heading,0,'YXZ');
    dummy.quaternion.multiply(rollQ.setFromAxisAngle(rollAxis,s.roll));
    if(s.trickRotation)dummy.quaternion.multiply(rollQ.setFromEuler(trickEuler.set(...s.trickRotation)));
    dummy.scale.setScalar(a.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    const rest=s.state==='rest',phase=t*3.5+a.id*1.89,blend=s.restBlend??(rest?1:0);
    pose.set([phase,s.activity,THREE.MathUtils.lerp(-.23+Math.sin(phase*.5)*.035,-.08,blend),Math.sin(t*.36+a.id)*.075],i*4);
    behavior[i]=blend;
    airTuck[i]=s.airTuck??0;
    const soft=softMotionAt(a,s,t);softPose.set([soft.blink,soft.belly],i*2);return soft;
  },flush(){mesh.instanceMatrix.needsUpdate=true;geometry.attributes.actorPose.needsUpdate=true;geometry.attributes.restBlend.needsUpdate=true;geometry.attributes.airTuck.needsUpdate=true;geometry.attributes.softPose.needsUpdate=true;}};
}
