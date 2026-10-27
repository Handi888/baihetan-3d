import * as THREE from 'three';
import {loadCreatureAsset} from './creature-asset.js';
import {createCreatureInstances} from './creature-instances.js';
import {createHabitatPlan,motionAt,transferRoute} from './creature-motion.js';
import {createCreatureWaterEffects} from './creature-water-effects.js';

/** 直接复用用户模型、原 UV 和 PBR 贴图。实例化 GPU 驱动全部个体，
 * 同一套模型资产只加载一次；没有替身、镜头前刷出或整群同步动作。
 */
export function createCreatures(heightAt){
  const group=new THREE.Group();group.name='Animated wildlife';
  const plan=createHabitatPlan(heightAt),actors=[],effects=createCreatureWaterEffects();group.add(effects.group);
  let loaded=false,previousTime=null,instances;
  const ready=loadCreatureAsset().then(({geometry,material})=>{
    instances=createCreatureInstances(geometry,material,plan.length);geometry.dispose();group.add(instances.mesh);
    for(const a of plan)actors.push({...a,last:null,lastWake:-Infinity});
    group.traverse(o=>o.layers.enable(1));
    group.updateMatrixWorld(true);loaded=true;update(0);return actors.length;
  });
  function update(t){
    if(!loaded||t===previousTime)return false;
    const advancing=previousTime===null||t>previousTime;
    for(let i=0;i<actors.length;i++){const a=actors[i];
      const s=motionAt(a,t,heightAt),old=a.last;
      Object.assign(s,instances.write(i,a,s,t));
      if(advancing){
        if(s.surface&&t-a.lastWake>.85){effects.ring(s.x-Math.sin(s.heading)*a.size*.28,s.z-Math.cos(s.heading)*a.size*.28,s.level,t,.65);a.lastWake=t;}
        if(old&&old.state!==s.state){
          if(s.state==='breach'||old.state==='breach')effects.splash(s.x,s.z,s.level,t,1.15);
          if(a.type==='transfer'){
            const p=transferRoute(a),endX=p.x+p.vx*p.duration,endZ=p.z+p.vz*p.duration;
            if(s.state==='transfer'||old.state==='return')effects.splash(p.x,p.z,259,t,1.65);
            if(s.state==='return'||old.state==='transfer')effects.splash(endX,endZ,24,t,2.5);
          }
        }
      }
      a.last=s;
    }
    instances.flush();effects.update(t);previousTime=t;
    return advancing;
  }
  return {group,ready,plan,actors,update,get loaded(){return loaded;},
    snapshot(){return actors.map(a=>({id:a.id,...a.last}));}};
}
