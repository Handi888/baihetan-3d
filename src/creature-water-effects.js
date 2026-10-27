import * as THREE from 'three';

// 固定容量循环池；水花只是水面上方的附加几何，不修改水面索引或岸线。
export function createCreatureWaterEffects(){
  const group=new THREE.Group(),ringSlots=96,dropSlots=192,rings=Array(ringSlots),drops=Array(dropSlots);
  const rg=new THREE.RingGeometry(.87,1,64),fades=new Float32Array(ringSlots);
  rg.setAttribute('aFade',new THREE.InstancedBufferAttribute(fades,1));
  const rm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute float aFade; varying float vFade;
      void main(){vFade=aFade;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`varying float vFade; void main(){gl_FragColor=vec4(.72,.90,.86,vFade);}`});
  const ripple=new THREE.InstancedMesh(rg,rm,ringSlots);
  const droplets=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshPhysicalMaterial({color:0xb8e1dc,roughness:.22,metalness:0,transparent:true,opacity:.62,depthWrite:false}),dropSlots);
  ripple.frustumCulled=droplets.frustumCulled=false;group.add(ripple,droplets);
  const dummy=new THREE.Object3D();let ri=0,di=0;
  function ring(x,z,level,t,power=1){rings[ri++%ringSlots]={x,z,level,t,power};}
  function splash(x,z,level,t,power=1){
    for(let j=0;j<3;j++)ring(x,z,level,t+j*.12,power*(1-j*.15));
    const n=Math.round(16+power*10);
    for(let j=0;j<n;j++){
      const angle=j*2.39996,spread=(.5+(j%7)/7)*power;
      drops[di++%dropSlots]={x,z,level,t,vx:Math.cos(angle)*spread*2.2,vz:Math.sin(angle)*spread*2.2,vy:(2.6+(j%5)*.6)*Math.sqrt(power),size:(.035+(j%3)*.015)*power};
    }
  }
  function update(t){
    for(let i=0;i<ringSlots;i++){
      const r=rings[i],age=r?t-r.t:-1,active=r&&age>=0&&age<3.1;
      if(active){const scale=(.6+age*1.6)*r.power;dummy.position.set(r.x,r.level+.075,r.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(scale,scale,scale);fades[i]=.23*(1-age/3.1);}
      else{dummy.scale.setScalar(0);fades[i]=0;}
      dummy.updateMatrix();ripple.setMatrixAt(i,dummy.matrix);
    }
    for(let i=0;i<dropSlots;i++){
      const d=drops[i],age=d?t-d.t:-1,y=d?d.level+d.vy*age-4.905*age*age:0;
      if(d&&age>=0&&age<1.8&&y>d.level){dummy.position.set(d.x+d.vx*age,y,d.z+d.vz*age);dummy.rotation.set(0,0,0);dummy.scale.setScalar(d.size*Math.min(1,3*(1.8-age)));}
      else dummy.scale.setScalar(0);
      dummy.updateMatrix();droplets.setMatrixAt(i,dummy.matrix);
    }
    ripple.instanceMatrix.needsUpdate=droplets.instanceMatrix.needsUpdate=true;rg.attributes.aFade.needsUpdate=true;
  }
  update(0);return {group,ring,splash,update};
}
