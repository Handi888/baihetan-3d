import * as THREE from 'three';
import {intakeLayout} from './intake-layout.js';
import {groundShoreline} from './ground-surface.js';

// 教学模型坐标沿用总场景：Y 向上、+Z 向下游。洞室位置/设备尺寸为示意，
// 不是 BIM。两岸各 8 台的布置依据公开工程资料；详细机组只构建一份，按选择移动。
export const UNIT_SPACING=48;
export const BANK_CENTRES=[[-650,65,0],[650,65,0]];
export const UNIT_Z=Array.from({length:8},(_,i)=>-168+i*UNIT_SPACING);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const TAU=Math.PI*2;
function material(color,metalness=.25,roughness=.42){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
function group(parent,name){const g=new THREE.Group();g.name=name;parent.add(g);return g;}
function mesh(parent,geometry,mat,name,pos=[0,0,0]){const m=new THREE.Mesh(geometry,mat);m.name=name;m.position.set(...pos);parent.add(m);return m;}
function box(parent,mat,size,pos,name='构件'){return mesh(parent,new THREE.BoxGeometry(...size),mat,name,pos);}
function cylinder(parent,mat,r,h,pos,rt=r,name='圆筒'){return mesh(parent,new THREE.CylinderGeometry(rt,r,h,64),mat,name,pos);}
function rod(parent,mat,a,b,r=.09,name='杆件'){
  const d=V(...b).sub(V(...a));const m=cylinder(parent,mat,r,d.length(),V(...a).add(V(...b)).multiplyScalar(.5).toArray(),r,name);
  m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m;
}
function ring(parent,mat,outer,inner,height,y,start=0,length=TAU,name='环形构件'){
  // 带厚度的环扇：剖口有端盖，不使用透明黑洞冒充内部，也不影响原库区水网格。
  const s=new THREE.Shape();s.absarc(0,0,outer,start,start+length,false);
  s.absarc(0,0,inner,start+length,start,true);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:64});
  const m=mesh(parent,geo,mat,name,[0,y,0]);m.rotation.x=-Math.PI/2;return m;
}
function torus(parent,mat,r,t,y,name='环管'){const m=mesh(parent,new THREE.TorusGeometry(r,t,10,80),mat,name,[0,y,0]);m.rotation.x=Math.PI/2;return m;}
function path(points){return new THREE.CatmullRomCurve3(points.map(p=>V(...p)),false,'centripetal');}
function pipe(parent,mat,points,r,name,segments=64){return mesh(parent,new THREE.TubeGeometry(path(points),segments,r,14,false),mat,name);}
function line(parent,points,color,name){const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>V(...p))),new THREE.LineBasicMaterial({color}));m.name=name;parent.add(m);return m;}
function instance(parent,geo,mat,transforms,name){
  const m=new THREE.InstancedMesh(geo,mat,transforms.length),dummy=new THREE.Object3D();m.name=name;
  transforms.forEach((t,i)=>{dummy.position.set(...t.p);dummy.rotation.set(...(t.r||[0,0,0]));dummy.scale.set(...(t.s||[1,1,1]));dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.computeBoundingSphere();parent.add(m);return m;
}

// 非均匀蜗壳：沿周向截面逐渐收缩，上半壳可移走；切边由独立厚边线显示。
function spiralGeometry(top=false){
  const p=[],idx=[],steps=120,sides=20;
  for(let i=0;i<=steps;i++){
    const t=i/steps,a=t*TAU*.985,r=3.15*(1-t)+.6;
    for(let j=0;j<=sides;j++){
      const b=(top?0:Math.PI)+j/sides*Math.PI;
      p.push((9.2+Math.cos(b)*r)*Math.cos(a),5.2+Math.sin(b)*r,(9.2+Math.cos(b)*r)*Math.sin(a));
    }
  }
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}

// 混流式转轮叶片：入口径向、出口轴向，叶片沿半径和高度双向扭转，并封闭厚度侧边。
function runnerBlade(){
  const p=[],idx=[],nu=16,nv=8;
  for(let side=0;side<2;side++)for(let u=0;u<=nu;u++)for(let v=0;v<=nv;v++){
    const a=u/nu,b=v/nv,r=5.15-2.8*a,theta=.67*a+.24*b+.03*(side-.5);
    const y=(5.15-2.9*a)*(1-b)+(3.4-3.0*a)*b;
    p.push(r*Math.cos(theta),y,r*Math.sin(theta));
  }
  const n=(nu+1)*(nv+1),at=(u,v)=>u*(nv+1)+v;
  for(let u=0;u<nu;u++)for(let v=0;v<nv;v++){const a=at(u,v),b=at(u+1,v);idx.push(a,b,a+1,b,b+1,a+1,a+n,a+1+n,b+n,b+n,a+1+n,b+1+n);}
  const edge=[];for(let u=0;u<=nu;u++)edge.push(at(u,0));for(let v=1;v<=nv;v++)edge.push(at(nu,v));for(let u=nu-1;u>=0;u--)edge.push(at(u,nv));for(let v=nv-1;v>0;v--)edge.push(at(0,v));
  edge.forEach((a,i)=>{const b=edge[(i+1)%edge.length];idx.push(a,a+n,b,b,a+n,b+n);});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}

export function createPowerhouseModel(){
  const root=new THREE.Group();root.name='两岸地下引水发电系统 · 教学剖视';
  const m={steel:material(0xa7bfcb,.83,.26),dark:material(0x293b48,.65,.32),blue:material(0x477e98,.5,.35),concrete:material(0xb5bec1,.02,.85),floor:material(0xa8c0c7,.12,.38),white:material(0xe8ece7,.1,.52),copper:material(0xdca25a,.8,.26),red:material(0xbe514b,.45,.4),navy:material(0x286e9f,.5,.35),yellow:material(0xf3b445,.3,.4),black:material(0x142d38,.3,.45)};
  m.glow=new THREE.MeshStandardMaterial({color:0xe8f7ff,emissive:0xcceaff,emissiveIntensity:2.2});
  m.water=new THREE.MeshStandardMaterial({color:0x45d9eb,metalness:.15,roughness:.25,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
  m.pipe=new THREE.MeshStandardMaterial({color:0x68adc3,metalness:.6,roughness:.3,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
  m.spiral=material(0x417e91,.63,.32);m.spiral.side=THREE.DoubleSide;
  const halls=[],systems=[],covers=[],banks=[];
  for(let bank=0;bank<2;bank++){
    const side=bank===0?-1:1,b=group(root,bank===0?'左岸 · 8 台机组':'右岸 · 8 台机组');b.position.set(...BANK_CENTRES[bank]);banks.push(b);
    const hall=group(b,'主厂房 · 发电机层');halls.push(hall);
    const system=group(b,'引水竖井与尾水支洞');systems.push(system);
    const coverGroup=group(b,'8 台发电机组');covers.push(coverGroup);
    // 地面保留真实圆形机坑，旁侧检修道和每跨地板均单独建模。
    for(let i=0;i<8;i++){
      const systemStart=system.children.length;
      const z=UNIT_Z[i],floorShape=new THREE.Shape();floorShape.moveTo(-18,-24);floorShape.lineTo(18,-24);floorShape.lineTo(18,24);floorShape.lineTo(-18,24);floorShape.closePath();
      const hole=new THREE.Path();hole.absarc(0,0,11,0,TAU,true);floorShape.holes.push(hole);
      const floor=mesh(hall,new THREE.ExtrudeGeometry(floorShape,{depth:1.4,bevelEnabled:false,curveSegments:64}),m.floor,'带机坑的发电机层楼板',[0,26.6,z]);floor.rotation.x=-Math.PI/2;
      for(const y of [-17,12]){
        const plate=new THREE.Shape();plate.moveTo(-18,-24);plate.lineTo(18,-24);plate.lineTo(18,24);plate.lineTo(-18,24);plate.closePath();
        const opening=new THREE.Path();opening.absarc(0,0,y<0?7:3.5,0,TAU,true);plate.holes.push(opening);
        const slab=mesh(hall,new THREE.ExtrudeGeometry(plate,{depth:1,bevelEnabled:false,curveSegments:48}),m.concrete,y<0?'尾水管层楼板':'水轮机检修层楼板',[0,y-1,z]);slab.rotation.x=-Math.PI/2;
      }
      for(const x of [-17,17])for(const dz of [-23,23])box(hall,m.concrete,[1.5,45,1.5],[x,5.5,z+dz],'地下厂房层间立柱');
      const cover=group(coverGroup,`${bank*8+i+1} 号机组`);cover.position.z=z;cover.userData.unit=i;
      cylinder(cover,m.blue,10.7,.48,[0,28.3,0],10.7,'蓝色机组盖板');cylinder(cover,m.blue,2.9,2.3,[0,29.7,0],2.9,'励磁罩');torus(cover,m.dark,10.75,.12,28.6);
      for(let k=0;k<12;k++){
        const a=k*TAU/12;rod(cover,m.dark,[3*Math.cos(a),28.57,3*Math.sin(a)],[10.6*Math.cos(a),28.57,10.6*Math.sin(a)],.025,'盖板分缝');
        const vent=box(cover,m.black,[.56,.8,.08],[Math.sin(a)*2.91,29.65,Math.cos(a)*2.91],'励磁罩通风格栅');vent.rotation.y=a;
      }
      // 低成本机组外壳仅供系统总览，精细转轮/线圈仅在聚焦的机组内构建。
      cylinder(system,m.blue,8.9,6,[0,21,z],8.9,'发电机外壳');cylinder(system,m.dark,1.1,16,[0,11,z],1.1,'立轴');torus(system,m.blue,9.2,3,5.2).position.z=z;
      const intake=intakeLayout(bank).gates[i],intakeZ=intake.z,intakeX=intake.x;
      const localX=intakeX-BANK_CENTRES[bank][0];
      const inletY=intake.y-BANK_CENTRES[bank][1];
      // 竖井位于主厂房侧墙外，降至水轮机层以后再接入蜗壳，避免穿过发电机层走道。
      const penstock=pipe(system,m.pipe,[[localX,inletY,intakeZ],[-side*48,inletY,intakeZ+24],[-side*48,80,z-28],[-side*48,5.2,z-28],[9.2,5.2,z-22],[9.2,5.2,z]],3.3,'单洞单机 · 引水上平洞与竖井');penstock.userData.intake=[intake.x,intake.y,intake.z];
      pipe(system,m.pipe,[[0,2.4,z],[0,-3,z],[0,-7,z+2],[0,-11,z+8],[0,-11,z+22],[side*60,-18,z+28]],3.6,'尾水管与尾水支洞');
      // 主变洞内的主变与母线。输电路径位于发电机侧，水流不经过这里。
      box(system,m.dark,[9,9,10],[side*102,22,z],'主变压器');
      for(let k=0;k<3;k++)pipe(system,[m.red,m.yellow,m.navy][k],[[7,22+k*.6,z],[side*55,22+k*.6,z],[side*102,28,z+k-1]],.32,'三相母线');
      for(const part of system.children.slice(systemStart))part.userData.unit=i;
    }
    for(let i=0;i<4;i++){
      const z=(UNIT_Z[i*2]+UNIT_Z[i*2+1])/2;
      // 每两台汇入一个尾水调压室；下游分支合并关系作教学布局，不声称精确测绘。
      cylinder(system,m.pipe,24,85,[side*60,21,z],24,'两机共用 · 尾水调压室');
      for(const zz of [UNIT_Z[i*2]+28,UNIT_Z[i*2+1]+28])pipe(system,m.pipe,[[side*60,-18,zz],[side*60,-18,z]],4.2,'尾水汇流支管',8);
      const trunk=bank===0?[0,1,1,2][i]:Math.floor(i/2),joinZ=340+trunk*75;
      pipe(system,m.pipe,[[side*60,-18,z],[side*82,-20,z+50],[side*110,-29,joinZ]],6,'调压室至尾水干洞支线');
    }
    // 公开工程资料为左岸三条、右岸两条尾水隧洞；汇流位置仍为教学近似。
    for(let i=0;i<(bank===0?3:2);i++){
      const outZ=550+i*110,outX=groundShoreline(outZ,24,side)-BANK_CENTRES[bank][0];
      pipe(system,m.pipe,[[side*110,-29,340+i*75],[side*100,-38,440+i*50],[outX,-42,outZ]],7,'尾水隧洞');
    }
    for(const x of [-19,19]){
      box(hall,m.white,[1.4,36,416],[x,46,0],'厂房纵墙');box(hall,m.dark,[1.6,1,416],[x-.8*Math.sign(x),57,0],'桥机轨道梁');
      const seams=[],lamps=[],vents=[];
      for(let z=-202;z<=202;z+=6){seams.push({p:[x-Math.sign(x)*.72,45,z],s:[.022,33,.028]});if(z%12===-10)lamps.push({p:[x-Math.sign(x)*.8,45,z],s:[.16,15,.16]});}
      for(let y=30;y<64;y+=3)seams.push({p:[x-Math.sign(x)*.74,y,0],s:[.02,.025,416]});
      for(let z=-198;z<200;z+=1.8)vents.push({p:[x-Math.sign(x)*.85,30.3,z],s:[.1,2.3,.8]});
      instance(hall,new THREE.BoxGeometry(1,1,1),m.concrete,seams,'墙面方格分缝');instance(hall,new THREE.BoxGeometry(1,1,1),m.glow,lamps,'纵墙灯带');instance(hall,new THREE.BoxGeometry(1,1,1),m.dark,vents,'通风格栅');
      // 服务廊道护栏及检修孔，用实心分段地板和栏杆表现。
      for(let z=-182;z<190;z+=48){
        const px=x*.78;box(hall,m.dark,[3,.3,5],[px,28.1,z],'检修盖板');
        for(const dx of [-1.6,1.6])for(const dz of [-2.6,2.6])rod(hall,m.red,[px+dx,28,z+dz],[px+dx,29.6,z+dz],.08);
        for(const dy of [.8,1.6])for(const dx of [-1.6,1.6])rod(hall,m.red,[px+dx,28+dy,z-2.6],[px+dx,28+dy,z+2.6],.07);
      }
    }
    // 拱顶肋架 + 排列灯具，不用几十盏实时点光源拖慢画面。
    for(let z=-204;z<=204;z+=24){const pts=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24;pts.push([19*Math.cos(a),64+9*Math.sin(a),z]);}pipe(hall,m.dark,pts,.3,'拱顶钢肋',24);}
    const roofP=[],roofI=[];for(let j=0;j<=48;j++){const a=Math.PI*j/48;for(const z of [-208,208])roofP.push(19.3*Math.cos(a),64.3+9.2*Math.sin(a),z);if(j<48){const n=j*2;roofI.push(n,n+1,n+2,n+1,n+3,n+2);}}
    const roofG=new THREE.BufferGeometry();roofG.setAttribute('position',new THREE.Float32BufferAttribute(roofP,3));roofG.setIndex(roofI);roofG.computeVertexNormals();const roofM=material(0x687985,.2,.72);roofM.side=THREE.DoubleSide;mesh(hall,roofG,roofM,'完整拱顶衬砌');
    const lamps=[];for(const x of [-12,0,12])for(let z=-192;z<=192;z+=12)lamps.push({p:[x,66, z],s:[.75,.15,.75]});instance(hall,new THREE.SphereGeometry(1,12,6),m.glow,lamps,'三排顶灯');
    box(hall,m.white,[38,40,1],[0,48,208],'厂房端墙');
    // 橙色桥式起重机：两根主梁、端梁、小车、护栏、钢索、吊钩。
    const crane=group(hall,'双梁桥式起重机');crane.position.set(0,57,130);
    for(const z of [-3,3]){box(crane,m.yellow,[36,2.4,1.5],[0,0,z],'桥机主梁');rod(crane,m.dark,[-17,2,z],[17,2,z],.06);for(let x=-16;x<=16;x+=4)rod(crane,m.dark,[x,1,z],[x,2,z],.06);}
    for(const x of [-17,17])box(crane,m.yellow,[2.2,2.4,9],[x,0,0],'端梁');
    box(crane,m.red,[5,2,6],[-5,2,0],'起升小车');
    for(const x of [-5.5,-4.5])rod(crane,m.dark,[x,0,0],[x,-10,0],.045,'起重钢索');
    const hook=mesh(crane,new THREE.TorusGeometry(.6,.15,12,30,Math.PI*1.5),m.steel,'吊钩',[-5,-10.7,0]);hook.rotation.z=Math.PI/2;
  }

  const detailed=group(root,'选中机组 · 精细内部');
  const base=group(detailed,'水轮机与蜗壳'),generator=group(detailed,'发电机定子'),rotor=group(detailed,'发电机转子'),top=group(detailed,'上机架与励磁机'),runner=group(detailed,'混流式转轮'),shaft=group(detailed,'传动主轴'),context=group(detailed,'单机引水与电能输出');
  const housing=group(base,'可移开的上半蜗壳'),outer=group(generator,'可移开的定子前壳');
  const stays=[],frontStays=[],gates=[];
  mesh(base,spiralGeometry(),m.spiral,'变截面下半蜗壳');mesh(housing,spiralGeometry(true),m.spiral,'变截面上半蜗壳');
  const spiralLine=[];for(let i=0;i<=120;i++){const t=i/120,a=t*TAU*.985;spiralLine.push([(9.2+3.15*(1-t)+.6)*Math.cos(a),5.2,(9.2+3.15*(1-t)+.6)*Math.sin(a)]);}line(base,spiralLine,0x89dce6,'蜗壳剖切边');
  ring(base,m.steel,8,6.8,.4,3.35,0,TAU,'座环下环');ring(base,m.steel,8,6.8,.35,7.1,0,Math.PI,'座环上环 · 半剖');
  for(let i=0;i<24;i++){
    const a=i*TAU/24;
    (Math.sin(a)>.4?frontStays:stays).push({p:[Math.cos(a)*7.8,5.2,Math.sin(a)*7.8],s:[1.3,3.4,.16],r:[0,-a+.32,0]});
    const pivot=group(base,'活动导叶');pivot.position.set(Math.cos(a)*6.45,5.15,Math.sin(a)*6.45);pivot.userData.angle=a;
    box(pivot,m.yellow,[1.48,3.3,.16],[0,0,0],'导叶叶身');cylinder(pivot,m.steel,.09,4,[0,0,0]);gates.push(pivot);
  }
  instance(base,new THREE.BoxGeometry(1,1,1),m.steel,stays,'固定导叶 · 座环支柱');torus(base,m.yellow,6.45,.12,7.8,'导叶控制环');
  const frontGuide=instance(base,new THREE.BoxGeometry(1,1,1),m.steel,frontStays,'前半固定导叶 · 随剖视移除');
  const bladeGeo=runnerBlade();for(let i=0;i<15;i++){const b=mesh(runner,bladeGeo,m.steel,'双向扭曲的混流式转轮叶片');b.rotation.y=i*TAU/15;}
  // 下环形成轴向出口；顶部轮毂与主轴刚性连接。
  ring(runner,m.steel,5.2,4.75,.35,3.25,Math.PI,Math.PI,'转轮下环 · 剖视');
  const crown=new THREE.LatheGeometry([[0,6.2],[1.3,6.2],[2.2,5.4],[3.5,5.15],[5.2,5.45],[5.2,5.1],[3.5,4.8],[2,2],[0,1.8]].map(p=>new THREE.Vector2(...p)),80);
  const runnerCrown=mesh(runner,crown,m.steel,'转轮上冠与轮毂');cylinder(runner,m.steel,1.4,3.1,[0,4.6,0],1.4,'转轮轮毂');
  cylinder(shaft,m.steel,1.05,20,[0,15.5,0],1.05,'连接转轮与转子的竖直主轴');
  ring(base,m.dark,2.3,1.13,.7,10,0,TAU,'水轮机导轴承');ring(base,m.yellow,2.15,1.16,.18,10.8,0,TAU,'轴承油槽');
  // 定子始终静止；三相线圈按 A/B/C 着色，数量仅用于说明，不当作实际槽/极数。
  ring(generator,m.dark,9.8,8.5,6.6,18,0,Math.PI,'定子铁芯 · 后半剖');ring(outer,m.blue,10,9.8,6.6,18,Math.PI,Math.PI,'定子机座 · 前半壳');
  const laminations=[];for(let y=18;y<=24.6;y+=.25){const pts=[];for(let i=0;i<=80;i++){const a=Math.PI+i*Math.PI/80;pts.push([9.85*Math.cos(a),y,9.85*Math.sin(a)]);}line(generator,pts,0x607e8b,'铁芯叠片分层');}
  const coilGeo=new THREE.TorusGeometry(1,.16,8,16);const phaseM=[m.copper,m.red,m.navy];
  for(let i=0;i<36;i++){
    const a=TAU*i/36;
    // 朝观察者的前 120° 留出剖口，可直接看见转子与气隙。
    if(Math.sin(a)>.55)continue;
    const coil=mesh(generator,coilGeo,phaseM[i%3],'定子三相绕组');coil.position.set(8.55*Math.cos(a),21.3,8.55*Math.sin(a));coil.rotation.y=Math.PI/2-a;coil.scale.set(.42,3.65,1);
    const tooth=box(generator,m.steel,[.42,5.8,.5],[8.65*Math.cos(a),21.3,8.65*Math.sin(a)],'定子齿');tooth.rotation.y=-a;
  }
  ring(generator,m.steel,10,8.4,.4,17.5,0,Math.PI,'下机架外环');
  for(const y of [18.4,21,23.7])for(const a of [Math.PI*1.15,Math.PI*1.4,Math.PI*1.65,Math.PI*1.9])box(generator,m.blue,[1.1,2,1.6],[10.1*Math.cos(a),y,10.1*Math.sin(a)],'冷却器外壳').rotation.y=-a;
  cylinder(rotor,m.dark,2.25,6.3,[0,21.2,0],2.25,'转子中心体');
  ring(rotor,m.steel,7.6,6.8,5.2,18.7,0,TAU,'转子磁轭');
  for(let i=0;i<16;i++){
    const a=i*TAU/16;rod(rotor,m.steel,[1.5*Math.cos(a),21.2,1.5*Math.sin(a)],[7*Math.cos(a),21.2,7*Math.sin(a)],.3,'转子支臂');
    const pole=box(rotor,i%2?m.navy:m.red,[1.65,4.8,.46],[7.8*Math.cos(a),21.2,7.8*Math.sin(a)],i%2?'转子 S 磁极（示意）':'转子 N 磁极（示意）');pole.rotation.y=Math.PI/2-a;
    const winding=mesh(rotor,coilGeo,m.copper,'磁极励磁绕组',[7.55*Math.cos(a),21.2,7.55*Math.sin(a)]);winding.rotation.y=Math.PI/2-a;winding.scale.set(.7,2.5,1);
  }
  ring(top,m.dark,3.1,1.15,1.4,26,0,TAU,'推力轴承');for(let i=0;i<8;i++){const a=i*TAU/8;rod(top,m.steel,[3*Math.cos(a),26.5,3*Math.sin(a)],[9.4*Math.cos(a),26.5,9.4*Math.sin(a)],.22,'上机架径向支臂');}
  cylinder(top,m.blue,2.6,1.6,[0,29.1,0],2.6,'励磁机罩');cylinder(top,m.steel,1.4,1.5,[0,30.6,0],1.4,'励磁机');
  torus(top,m.copper,1.15,.15,27.5,'励磁导电环');
  const bolts=[];for(const y of [17.3,24.9])for(let i=0;i<64;i++){const a=i*TAU/64;bolts.push({p:[9.5*Math.cos(a),y,9.5*Math.sin(a)],s:[.12,.16,.12]});}instance(generator,new THREE.CylinderGeometry(1,1,1,6),m.steel,bolts,'机座连接螺栓');
  // 尾水管自转轮下方扩散，再弯向下游；水路与发电机电气腔体严格分开。
  const draftPts=[[0,2.4,0],[0,-3,0],[0,-7,2],[0,-11,8],[0,-11,22]];
  pipe(context,m.pipe,draftPts,3.6,'轴向出流 · 弯肘尾水管');
  const cone=mesh(context,new THREE.CylinderGeometry(2.7,4.2,7,64,1,true),m.pipe,'尾水扩散锥管',[0,-1.4,0]);
  const inletPts=[[9.2,31,-24],[9.2,20,-24],[9.2,7,-19],[9.2,5.2,-10],[9.2,5.2,0]];
  pipe(context,m.pipe,inletPts,3.55,'压力管道 · 展示段');
  for(const z of [-19,-12,-4]){const flange=mesh(context,new THREE.TorusGeometry(3.6,.1,8,48),m.steel,'压力钢管环焊缝',[9.2,z===-19?7:5.2,z]);}
  const transformer=group(context,'主变压器与电能输出');transformer.position.set(-102,0,0);
  box(transformer,m.dark,[6,8,7],[0,18,0],'变压器油箱');for(const x of [-3.3,3.3])for(let z=-3;z<=3;z+=.5)box(transformer,m.steel,[1.3,6,.12],[x,18,z],'散热片');
  for(let i=0;i<3;i++){cylinder(transformer,m.white,.28,3,[i*1.7-1.7,23,0],.2,'高压套管');for(let y=22;y<24.4;y+=.3)torus(transformer,m.white,.4,.07,y).position.x=i*1.7-1.7;}
  const electricalPaths=[];for(let i=0;i<3;i++){
    const pts=[[-8,20+i*.6,-2],[-33,20+i*.6,-2],[-75,23,-2],[-103.7+i*1.7,24.5,0]];
    electricalPaths.push(path(pts));pipe(context,phaseM[i],pts,.16,'发电机出线 · 三相母线');
    pipe(context,phaseM[i],[[-103.7+i*1.7,24.5,0],[-103.7+i*1.7,27,0],[-132,27,i*1.2]],.13,'升压后送出');
  }
  // 水流粒子逐段连续：进口 -> 蜗壳 -> 导叶 -> 转轮 -> 尾水；没有流经发电机的假动画。
  const flowPaths=[path(inletPts)];
  for(let branch=0;branch<6;branch++){
    const a=.55+branch*.73,pts=[];
    for(let j=0;j<=36;j++){const t=j/36,angle=a*t;pts.push([9.2*Math.cos(angle),5.15,9.2*Math.sin(angle)]);}
    pts.push([6.4*Math.cos(a+.12),5,6.4*Math.sin(a+.12)],[4.6*Math.cos(a+.3),4.4,4.6*Math.sin(a+.3)],[2*Math.cos(a+.6),1,2*Math.sin(a+.6)],[0,-3,0],[0,-7,2],[0,-11,8],[0,-11,22]);flowPaths.push(path(pts));
  }
  const flowGroup=group(detailed,'水流方向粒子'),electricGroup=group(detailed,'电能输出脉冲'),fields=group(rotor,'随磁极旋转的磁场示意');
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,pts=[];for(let j=0;j<=40;j++){const t=j/40,r=7.8+1.35*Math.sin(Math.PI*t);pts.push([r*Math.cos(a+.33*t),21.2,r*Math.sin(a+.33*t)]);}line(fields,pts,i%2?0x6aa8ff:0xff8b74,'磁场跨过气隙');
  }
  const flowMat=new THREE.MeshBasicMaterial({color:0x78edff}),energyMat=new THREE.MeshBasicMaterial({color:0xffd989});
  const flow=new THREE.InstancedMesh(new THREE.SphereGeometry(.18,7,5),flowMat,210);flow.name='水流粒子';flowGroup.add(flow);flow.frustumCulled=false;
  const energy=new THREE.InstancedMesh(new THREE.SphereGeometry(.14,7,5),energyMat,30);electricGroup.add(energy);energy.frustumCulled=false;
  const axis=line(detailed,[[0,-12,0],[0,65,0]],0x587786,'分解参考轴');axis.visible=false;
  const sectionPlane=new THREE.Plane(V(0,0,-1),0),hallMaterialCopies=new Map();
  for(const hall of halls)hall.traverse(o=>{if(!o.isMesh)return;const source=o.material;if(!hallMaterialCopies.has(source))hallMaterialCopies.set(source,source.clone());o.material=hallMaterialCopies.get(source);});
  const dummy=new THREE.Object3D();let time=0,angle=0,bankIndex=0,unitIndex=0,mode='unit',cut=true,explosion=0,gate=.72,flowOn=true,fieldOn=true;
  // 精细机组是对应厂房中那台设备的子装配，不搬去另一个展示坐标系。
  function select(bank,unit){bankIndex=bank;unitIndex=unit;covers[bank].children[unit].add(detailed);detailed.position.set(0,0,0);
    const sign=bank===0?1:-1;transformer.position.x=-102*sign;for(const part of context.children)if(/发电机出线|升压后送出/.test(part.name))part.scale.x=sign;
    applyMode();}
  function applyMode(){
    sectionPlane.constant=UNIT_Z[unitIndex]+1;
    // 在原位沿机组中线剖开厂房楼板/围护，保留后方机组、楼层和连接管道。
    for(const mat of hallMaterialCopies.values()){const next=mode==='unit'?[sectionPlane]:null;if(Boolean(mat.clippingPlanes)!==Boolean(next))mat.needsUpdate=true;mat.clippingPlanes=next;}
    banks.forEach((b,i)=>{
      b.visible=true;halls[i].visible=true;systems[i].visible=true;covers[i].visible=true;
      for(let j=0;j<8;j++){const machine=covers[i].children[j];machine.visible=mode!=='unit'||i!==bankIndex||j<=unitIndex;
        for(const part of machine.children)if(part!==detailed)part.visible=!(mode==='unit'&&i===bankIndex&&j===unitIndex);
      }
      for(const part of systems[i].children){const selected=i===bankIndex&&part.userData.unit===unitIndex;
        const replaced=/发电机外壳|立轴|主变压器|三相母线/.test(part.name)||part.geometry?.type==='TorusGeometry';
        part.visible=mode!=='unit'||(i===bankIndex&&selected&&!replaced);
      }
    });
    for(const name of ['压力管道 · 展示段','轴向出流 · 弯肘尾水管','尾水扩散锥管'])context.getObjectByName(name).visible=false;
    detailed.visible=mode==='unit';root.updateMatrixWorld(true);
  }
  function setMode(value){mode=value;applyMode();}
  function configure(options={}){
    if('cut'in options)cut=options.cut;if('explosion'in options)explosion=options.explosion;if('gate'in options)gate=Math.max(0,Math.min(1,options.gate));if('flow'in options)flowOn=options.flow;if('field'in options)fieldOn=options.field;
    housing.visible=!cut;outer.visible=!cut;frontGuide.visible=!cut;runnerCrown.visible=!cut;generator.position.y=explosion*15;rotor.position.y=explosion*24;top.position.y=explosion*34;axis.visible=explosion>0;
    flowGroup.visible=flowOn&&explosion===0;electricGroup.visible=flowOn&&explosion===0;fields.visible=fieldOn&&explosion===0;
    for(const g of gates){g.rotation.y=-g.userData.angle+Math.PI/2-gate*.9;g.visible=!cut||Math.sin(g.userData.angle)<=.4;}
    root.updateMatrixWorld(true);
  }
  function update(dt,running=true){
    if(running){time+=dt;if(gate>.001)angle+=dt*.65;} // 同步机并网时转速稳定；导叶开度只改变流量/负荷，非任意调转速。
    runner.rotation.y=shaft.rotation.y=rotor.rotation.y=angle;
    for(let i=0;i<flow.count;i++){
      const curve=flowPaths[i%flowPaths.length],t=(i/flow.count+time*.085*gate)%1;dummy.position.copy(curve.getPointAt(t));dummy.scale.setScalar(gate>.001?1:0);dummy.updateMatrix();flow.setMatrixAt(i,dummy.matrix);
    }
    for(let i=0;i<energy.count;i++){dummy.position.copy(electricalPaths[i%3].getPointAt((i/energy.count+time*.18)%1));dummy.position.x*=bankIndex===0?1:-1;dummy.scale.setScalar(gate>.001?1:0);dummy.updateMatrix();energy.setMatrixAt(i,dummy.matrix);}
    flow.instanceMatrix.needsUpdate=true;energy.instanceMatrix.needsUpdate=true;detailed.updateMatrixWorld(true);
  }
  const anchors={intake:[9.2,27,-24],spiral:[11.3,5,3],gate:[6.45,6.4,0],runner:[3.5,3.2,3],shaft:[0,13.6,0],rotor:[7.8,21.3,1],stator:[-8,22,0],bearing:[0,26.5,0],exciter:[0,31.5,0],draft:[0,-11,17],transformer:[-22,23,0]};
  function anchor(key){const v=V(...anchors[key]);if(key==='transformer')v.x=bankIndex===0?-102:102;if(['stator'].includes(key))v.y+=generator.position.y;if(key==='rotor')v.y+=rotor.position.y;if(['bearing','exciter'].includes(key))v.y+=top.position.y;return detailed.localToWorld(v);}
  function audit(){return {bankCount:2,unitsPerBank:8,totalUnits:16,selectedUnit:bankIndex*8+unitIndex+1,bankIndex,unitIndex,mode,gate,cut,explosion,runnerAngle:runner.rotation.y,shaftAngle:shaft.rotation.y,rotorAngle:rotor.rotation.y,statorAngle:generator.rotation.y,flowPaths:flowPaths.length};}
  select(0,0);configure();update(0);
  return {root,halls,banks,detailed,select,setMode,configure,update,anchor,audit,get mode(){return mode;},get origin(){return detailed.getWorldPosition(new THREE.Vector3());}};
}
