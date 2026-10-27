import * as THREE from 'three';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** 原模型没有骨骼。以原始表面连续权重绑定躯干、头、双鳍和尾柄。
 * 顶点位置、UV、法线在中立姿态保持原样；各个体共享几何和 PBR 贴图。
 */
export function prepareRigGeometry(source){
  const geometry=source.clone();geometry.translate(0,-37.5,0);geometry.scale(1/75,1/75,1/75);
  const p=geometry.attributes.position,ids=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const fin=smooth(.145,.235,Math.abs(x))*smooth(-.36,-.24,y)*(1-smooth(.025,.15,y))*(1-smooth(.14,.25,Math.abs(z-.035)));
    const tail=(1-smooth(-.32,-.17,y))*(1-smooth(-.06,.08,z));
    const head=smooth(.17,.32,y);
    let w=[Math.max(0,1-fin-tail-head),fin,tail,head],sum=w.reduce((a,b)=>a+b,0);w=w.map(v=>v/sum);
    ids.set([1,x<0?3:4,5,2],i*4);weights.set(w,i*4);
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.computeBoundingSphere();geometry.boundingSphere.radius+=.16;return geometry;
}

export function createRiggedActor(geometry,material){
  const root=new THREE.Bone(),spine=new THREE.Bone(),head=new THREE.Bone(),left=new THREE.Bone(),right=new THREE.Bone(),tail=new THREE.Bone();
  spine.position.set(0,-.1,0);root.add(spine);head.position.set(0,.34,.025);spine.add(head);
  left.position.set(-.135,.13,.025);right.position.set(.135,.13,.025);spine.add(left,right);
  tail.position.set(0,-.29,-.08);root.add(tail);
  const bones=[root,spine,head,left,right,tail],mesh=new THREE.SkinnedMesh(geometry,material);mesh.add(root);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
  spine.rotation.order='ZYX';head.rotation.order='YXZ';left.rotation.order=right.rotation.order=tail.rotation.order='ZYX';
  const group=new THREE.Group();group.add(mesh);
  return {group,mesh,bones,pose(time,state,id){
    const phase=time*(state.state==='rest'?1.2:3.5)+id*1.89,amp=state.activity;
    spine.rotation.x=Math.sin(phase-1)*.035*amp;spine.rotation.z=Math.sin(phase*.43)*.025*amp;
    head.rotation.x=state.state==='rest'?-.02:-.23+Math.sin(phase*.5)*.035;head.rotation.y=Math.sin(time*.36+id)*.075;
    for(const [bone,sign] of [[left,-1],[right,1]]){const stroke=phase+sign*.55;bone.rotation.z=sign*(.20+.58*Math.sin(stroke)*amp);bone.rotation.x=Math.cos(stroke)*.65*amp;}
    tail.rotation.x=-1.15+Math.sin(phase-1.0)*.50*amp;tail.rotation.z=Math.sin(phase*.47)*.055*amp;
  }};
}
