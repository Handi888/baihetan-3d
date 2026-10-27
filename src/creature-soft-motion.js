import * as THREE from 'three';
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(lo,hi,x)=>{const u=clamp((x-lo)/(hi-lo));return u*u*(3-2*u);};
const mod=(x,n)=>(x%n+n)%n;
const spring=t=>-Math.exp(-5*t)*Math.cos(16*t);

/** 每只独立眨眼，快速闭合、短暂停留、慢一点张开；偶尔连眨两次。
 * 肚子是局部表面形变，不缩放整个躯体，也不会把眼睛、尾部一同放大。
 */
export function softMotionAt(a,s,t){
  const period=3.8+(a.id%11)*.19,clock=t+a.id*.697,cycle=Math.floor(clock/period),phase=mod(clock,period);
  const pulse=u=>smooth(0,.085,u)*(1-smooth(.12,.29,u));
  let blink=Math.max(pulse(phase-.8),cycle%4===3?pulse(phase-1.22):0);
  // 入水瞬间主动闭眼，随后恢复各自的自然眨眼节奏。
  if(s.impactAge!=null&&s.impactAge>=0)blink=Math.max(blink,1-smooth(.08,.28,s.impactAge));
  const patAge=mod((t*3.5+a.id*1.89)*.62-Math.PI/2,TAU)/(3.5*.62);
  const rest=s.restBlend??(s.state==='rest'?1:0);
  let belly=.10*Math.sin(t*1.7+a.id*1.13)-.32*(s.airTuck??0)+.70*rest*spring(patAge);
  if(s.impactAge!=null&&s.impactAge>=0)belly+=.85*spring(s.impactAge);
  return {blink,belly:THREE.MathUtils.clamp(belly,-1,1)};
}

// 眼部中心从原模型 UV 的瞳孔顶点定位（不是另画一对眼睛）。
// 保留拓扑与原贴图，闭眼时将眼睑区域收成细缝，周围皮肤平滑过渡。
export function softTarget(x,y,z,kind){
  if(kind==='blink'){
    const d=((Math.abs(x)-.0777)/.055)**2+((y-.403)/.060)**2;
    const w=(1-smooth(.70,1.20,d))*smooth(.18,.225,z);
    return [x,y-(y-.403)*.975*w,z-.012*w];
  }
  const d=(x/.19)**2+((y+.012)/.255)**2;
  const w=(1-smooth(.05,1,d))*smooth(.16,.24,z);
  return [x-x*.06*w,y-(y+.012)*.04*w,z+.04*w];
}

/** 两个共享形变目标及法线只计算一次，每个体仅上传两个标量。
 * 合计 16 个顶点属性位置（含 instanceMatrix），在 WebGL2 保证范围内。
 */
export function prepareSoftTargets(geometry){
  const original=geometry.attributes.position,normal=geometry.attributes.normal;
  for(const kind of ['blink','belly']){
    const target=geometry.clone(),p=target.attributes.position,delta=new Float32Array(p.count*3),normals=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
      const v=softTarget(p.getX(i),p.getY(i),p.getZ(i),kind);p.setXYZ(i,...v);
      for(let j=0;j<3;j++)delta[i*3+j]=v[j]-original.array[i*3+j];
    }
    target.computeVertexNormals();
    // 只在形变的邻域调整法线，原件的未变形面保持原法线。
    for(let i=0;i<p.count;i++){
      const touched=Math.abs(delta[i*3])+Math.abs(delta[i*3+1])+Math.abs(delta[i*3+2])>1e-8;
      for(let j=0;j<3;j++)normals[i*3+j]=touched?target.attributes.normal.array[i*3+j]-normal.array[i*3+j]:0;
    }
    geometry.setAttribute(kind+'Delta',new THREE.BufferAttribute(delta,3));
    geometry.setAttribute(kind+'Normal',new THREE.BufferAttribute(normals,3));target.dispose();
  }
}
