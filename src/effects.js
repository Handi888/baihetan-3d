import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {damPoint,makeOpenings} from './math.js';

// 连续启闭与飞行延迟：关闭孔口后，已经离开孔口的水仍会落下，水雾随后消散。
// g=9.81；出流速度为视觉参数，不把此模型当作水力计算结果。
export function createDischargeState(){
  let time=0,enabled=false,opening=0,impact=0,mist=0;
  const history=[{t:0,v:0}];
  function sample(t){if(t<0)return 0;for(let i=history.length-1;i>=0;i--)if(history[i].t<=t)return history[i].v;return 0;}
  return {setEnabled(v){enabled=!!v;},sample,
    update(dt,travel){dt=Math.max(0,Math.min(dt,.1));if(dt===0)return this.value;time+=dt;const target=enabled?1:0;opening+=Math.sign(target-opening)*Math.min(Math.abs(target-opening),dt/(enabled?4.5:3.5));history.push({t:time,v:opening});while(history.length>2&&history[1].t<time-15)history.shift();impact=sample(time-travel);mist+=(impact-mist)*(1-Math.exp(-dt/(impact>mist?2.8:5.5)));if(mist<.0001)mist=0;return {time,opening,impact,mist,enabled};},
    get value(){return {time,opening,impact,mist,enabled};}
  };
}
export function createEffects(){
  const group=new THREE.Group();group.name='Gradual spillway jets, impact spray and drifting mist';group.visible=false;
  const state=createDischargeState(),jets=[],active=makeOpenings().filter(o=>o.kind==='deep'&&[1,3,5].includes(o.index));
  const shared=new THREE.MeshStandardMaterial({color:0xc6e4df,roughness:.24,transparent:true,opacity:.89,side:THREE.DoubleSide,depthWrite:false});
  shared.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float discharge; varying float vDischarge;').replace('#include <begin_vertex>','#include <begin_vertex>\nvDischarge=discharge;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vDischarge;').replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=smoothstep(0.005,.12,vDischarge);');};
  for(const outlet of active){
    const p=new THREE.Vector3(...damPoint(outlet.u,(outlet.y0+outlet.y1)/2,-1,-4));
    const vx=-p.x*.035,vy=3.4,vz=44,travel=(vy+Math.sqrt(vy*vy+19.62*(p.y-P.water.downstream)))/9.81;
    const point=t=>new THREE.Vector3(p.x+vx*t,p.y+vy*t-4.905*t*t,p.z+vz*t);
    const segments=90,sides=12,positions=new Float32Array((segments+1)*(sides+1)*3),flow=new Float32Array((segments+1)*(sides+1)),indices=[];
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('discharge',new THREE.BufferAttribute(flow,1).setUsage(THREE.DynamicDrawUsage));geo.setIndex(indices);
    const mesh=new THREE.Mesh(geo,shared);mesh.frustumCulled=false;group.add(mesh);jets.push({p,vx,vy,vz,travel,point,end:point(travel),geo,segments,sides,positions,flow});
  }
  const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const count=2700,positions=new Float32Array(count*3),sizes=new Float32Array(count),alphas=new Float32Array(count),seed=new Float32Array(count);
  for(let i=0;i<count;i++)seed[i]=(i*.61803398875)%1;
  const particles=new THREE.BufferGeometry();particles.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));particles.setAttribute('pSize',new THREE.BufferAttribute(sizes,1).setUsage(THREE.DynamicDrawUsage));particles.setAttribute('pAlpha',new THREE.BufferAttribute(alphas,1).setUsage(THREE.DynamicDrawUsage));particles.setAttribute('seed',new THREE.BufferAttribute(seed,1));
  const sprayMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{t:{value:0}},vertexShader:`attribute float pSize,pAlpha,seed;varying float alpha,phase;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(pSize*720./max(1.,-p.z),1.,110.);gl_Position=projectionMatrix*p;alpha=pAlpha;phase=seed;}`,
    fragmentShader:`varying float alpha,phase;uniform float t;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}void main(){vec2 p=gl_PointCoord-.5;float n=noise(p*9.+phase*73.+vec2(t*.12,0.));float edge=1.-smoothstep(.10,.5,length(p)+(n-.5)*.12);vec3 c=mix(vec3(.61,.76,.78),vec3(.94,.98,.96),.52+n*.43);gl_FragColor=vec4(c,alpha*edge*(.55+n*.45));#include <tonemapping_fragment>\n#include <colorspace_fragment>
}`.replace(';#include',';\n#include')});
  const cloud=new THREE.Points(particles,sprayMaterial);cloud.frustumCulled=false;group.add(cloud);
  const foam=[];
  for(const j of jets){
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{t:{value:0},strength:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float t,strength;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),n=sin(p.x*57.+sin(p.y*34.)+t*2.)*sin(p.y*71.-t*3.);float bands=pow(.5+.5*sin(r*38.-t*4.+n*1.5),6.);float a=(1.-smoothstep(.4,1.,r))*(.08+bands*.25)*strength;gl_FragColor=vec4(.82,.94,.89,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>
}`.replace(';#include',';\n#include')});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(145,205),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(j.end.x,P.water.downstream+.16,j.end.z+35);group.add(mesh);foam.push(mat);
  }
  const cross=new THREE.Vector3(),tangent=new THREE.Vector3(),normal=new THREE.Vector3(),axis=new THREE.Vector3(1,0,0);
  function update(dt){
    if(!state.value.enabled&&state.value.opening===0&&state.value.mist===0&&!group.visible)return;
    const s=state.update(dt,jets[0].travel);group.visible=s.enabled||s.opening>0||s.mist>0||state.sample(s.time-jets[0].travel)>0;
    for(const j of jets){
      for(let i=0;i<=j.segments;i++){
        const f=i/j.segments,t=j.travel*f,opening=state.sample(s.time-t),p=j.point(t),radius=(3.6+f*1.7)*Math.sqrt(Math.max(.00001,opening));
        tangent.set(j.vx,j.vy-9.81*t,j.vz).normalize();cross.crossVectors(tangent,axis).normalize();normal.crossVectors(cross,tangent).normalize();
        for(let k=0;k<=j.sides;k++){const a=k/j.sides*Math.PI*2,q=i*(j.sides+1)+k,r=radius*(1+Math.sin(f*75-s.time*13+a*3)*(.025+f*.06));j.positions[q*3]=p.x+cross.x*Math.cos(a)*r+normal.x*Math.sin(a)*r;j.positions[q*3+1]=p.y+cross.y*Math.cos(a)*r+normal.y*Math.sin(a)*r;j.positions[q*3+2]=p.z+cross.z*Math.cos(a)*r+normal.z*Math.sin(a)*r;j.flow[q]=opening;}
      }
      j.geo.attributes.position.needsUpdate=true;j.geo.attributes.discharge.needsUpdate=true;j.geo.computeVertexNormals();
    }
    for(let i=0;i<count;i++){
      const j=jets[Math.floor(i/3)%jets.length],r=seed[i],theta=hash(i+37)*Math.PI*2,f=(r+s.time*(i%3===0?.065:.16))%1;
      if(i%3===0){ // 风带走的细雾：先从落点抬升、扩散，再缓慢消失。
        const spread=Math.sqrt(hash(i+711))*(12+f*75);positions[i*3]=j.end.x+Math.cos(theta)*spread+f*20;positions[i*3+1]=P.water.downstream+4+f*(25+hash(i+877)*48);positions[i*3+2]=j.end.z+Math.sin(theta)*spread+f*38;sizes[i]=14+f*34;alphas[i]=s.mist*.065*Math.sin(Math.PI*f);
      }else if(i%3===1){ // 落点的粗水滴遵循重力抛射，形体迅速扩散。
        const t=f*2.8,speed=8+r*17;positions[i*3]=j.end.x+Math.cos(theta)*speed*t;positions[i*3+1]=P.water.downstream+1+25*t-4.905*t*t;positions[i*3+2]=j.end.z+Math.sin(theta)*speed*t;sizes[i]=2+r*4;alphas[i]=s.impact*.36*(1-f);
      }else{const t=j.travel*f,p=j.point(t),spread=2+f*9;positions[i*3]=p.x+Math.sin(theta)*spread;positions[i*3+1]=p.y+Math.cos(theta)*spread;positions[i*3+2]=p.z+Math.sin(theta*1.7)*spread;sizes[i]=1+f*5;alphas[i]=state.sample(s.time-t)*.3;}
    }
    for(const key of ['position','pSize','pAlpha'])particles.attributes[key].needsUpdate=true;sprayMaterial.uniforms.t.value=s.time;for(const m of foam){m.uniforms.t.value=s.time;m.uniforms.strength.value=Math.max(s.impact,s.mist*.55);}
  }
  return {group,update,setEnabled(value){state.setEnabled(value);if(value)group.visible=true;},audit(){const s=state.value;return {enabled:s.enabled,opening:+s.opening.toFixed(3),impact:+s.impact.toFixed(3),mist:+s.mist.toFixed(3),visible:group.visible};}};
}
