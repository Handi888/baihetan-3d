import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {damPoint,makeOpenings} from './math.js';
// Deliberately illustrative ballistic ribbons. Not a hydraulics solver.
export function createEffects(){
  const group=new THREE.Group();group.name='Illustrative discharge (disabled by default)';group.visible=false;
  const jets=[];
  const jetMaterial=new THREE.MeshStandardMaterial({color:0xe1f3eb,roughness:.28,transparent:true,opacity:.83,side:THREE.DoubleSide,depthWrite:false});
  const active=makeOpenings().filter(o=>o.kind==='deep'&&[1,3,5].includes(o.index));
  for(const outlet of active){
    const p=damPoint(outlet.u,(outlet.y0+outlet.y1)/2,-1,-3),points=[];
    const travel=Math.sqrt(2*(p[1]-P.water.downstream)/9.81),vx=-p[0]*.035;
    for(let i=0;i<=50;i++){const t=travel*i/50;points.push(new THREE.Vector3(p[0]+vx*t,p[1]-9.81*t*t/2,p[2]+46*t));}
    const curve=new THREE.CatmullRomCurve3(points),geo=new THREE.TubeGeometry(curve,64,4.0,8,false),jet=new THREE.Mesh(geo,jetMaterial);group.add(jet);jets.push({p,travel,vx,curve});
  }
  const n=1200,positions=new Float32Array(n*3),phases=Float32Array.from({length:n},(_,i)=>((i*0.61803398875)%1));
  const particles=new THREE.BufferGeometry();particles.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const cloud=new THREE.Points(particles,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{color:{value:new THREE.Color(0xe7f2e9)}},vertexShader:'varying float a; void main(){vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(4200./-mv.z,2.,30.); a=.20; gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform vec3 color; varying float a; void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard; gl_FragColor=vec4(color,a*pow(1.-r,2.));}'}));group.add(cloud);
  return {group,update(time){
    for(let i=0;i<n;i++){
      const j=jets[i%jets.length],f=(phases[i]+time*.13)%1,t=j.travel*f;
      if(i%4){const jitter=1+f*5;positions[3*i]=j.p[0]+j.vx*t+Math.sin(i*17.3+time)*jitter;positions[3*i+1]=j.p[1]-9.81*t*t/2+Math.cos(i*1.7)*jitter;positions[3*i+2]=j.p[2]+46*t;}
      else{const end=j.curve.getPoint(1);positions[3*i]=end.x+Math.sin(i*13.17)*f*50;positions[3*i+1]=P.water.downstream+4+f*40;positions[3*i+2]=end.z+Math.cos(i*2.39)*f*45;}
    }
    particles.attributes.position.needsUpdate=true;
  }};
}
