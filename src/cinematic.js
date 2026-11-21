import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {createPowerhouseModel,BANK_CENTRES,UNIT_Z} from './powerhouse-model.js';
import {operatingPoint,UNIT_SPEC} from './unit-physics.js';

// 影片模式（?cine=1）：逐帧确定性渲染。外部录制脚本按 t = i / FPS 调用 frame(t)，
// 每帧把 WebGL 画面与 2D 动画、字幕合成到同一张画布，再交给 ffmpeg 编码。
// 不依赖实时帧率，因此在没有 GPU 的机器上也能输出流畅视频。
export const FPS=25;
const FONT='"WenQuanYi Zen Hei","Microsoft YaHei","PingFang SC",sans-serif';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const ease=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;

/** 单调三次插值（Fritsch–Carlson）：关键帧时间 → 曲线参数，速度连续变化不突跳。 */
function monotone(xs,ys){
  const n=xs.length,d=[],m=new Array(n);
  for(let i=0;i<n-1;i++)d.push((ys[i+1]-ys[i])/(xs[i+1]-xs[i]));
  m[0]=d[0];m[n-1]=d[n-2];
  for(let i=1;i<n-1;i++){
    if(d[i-1]*d[i]<=0){m[i]=0;continue;}
    const h0=xs[i]-xs[i-1],h1=xs[i+1]-xs[i],w1=2*h1+h0,w2=h1+2*h0;
    m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]);
  }
  return x=>{
    if(x<=xs[0])return ys[0];if(x>=xs[n-1])return ys[n-1];
    let i=0;while(x>xs[i+1])i++;
    const h=xs[i+1]-xs[i],t=(x-xs[i])/h,t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1];
  };
}
function cameraPath(keys){
  const eye=new THREE.CatmullRomCurve3(keys.map(k=>new THREE.Vector3(...k.eye)),false,'centripetal');
  const target=new THREE.CatmullRomCurve3(keys.map(k=>new THREE.Vector3(...k.target)),false,'centripetal');
  const u=monotone(keys.map(k=>k.t),keys.map((_,i)=>i/(keys.length-1)));
  return {start:keys[0].t,end:keys.at(-1).t,sample(t,outEye,outTarget){const s=clamp(u(t));eye.getPoint(s,outEye);target.getPoint(s,outTarget);}};
}

// —— 一镜到底航拍：关键帧间隔越短越快，重点处（大坝、厂房、公园）放慢 ——
const L=BANK_CENTRES[0];
const TOUR_KEYS=[
  {t:0,  eye:[-120,1180,1640], target:[0,150,0]},          // 远景：沿河道俯瞰峡谷与库区
  {t:7,  eye:[-40,800,1380],   target:[0,190,-80]},
  {t:12, eye:[110,540,1160],   target:[0,205,-80]},           // 沿峡谷快速下降
  {t:17, eye:[40,330,780],     target:[0,190,-60]},           // 低空贴近水垫塘
  {t:24, eye:[-40,300,470],    target:[0,205,-95]},           // 慢：坝面与泄洪
  {t:30, eye:[-235,390,250],   target:[-40,262,-120]},        // 绕向左岸
  {t:35, eye:[-330,430,-70],   target:[-230,285,-320]},       // 慢：左岸进水口
  {t:39, eye:[-430,485,-330],  target:[-660,230,-240]},       // 掠过山体表面，岩体渐隐
  {t:43, eye:[L[0]+55,175,-300],target:[L[0],108,-205]},       // 穿入山体
  {t:46.5,eye:[L[0],101,-236], target:[L[0],99,-150]},         // 厂房端门
  {t:51, eye:[L[0]+2,106,-150],target:[L[0]-2,95,-40]},        // 慢：主厂房、机组盖板
  {t:56, eye:[L[0]-3,108,-40], target:[L[0],96,85]},
  {t:61, eye:[L[0]+2,112,85],  target:[L[0],104,210]},
  {t:63.5,eye:[L[0]+2,290,165],target:[-480,360,-200]},       // 垂直上升，穿出山体
  {t:66, eye:[L[0]+20,720,110],target:[-320,430,-700]},
  {t:69.5,eye:[-470,820,-420], target:[-150,220,-1500]},
  {t:74, eye:[-120,900,-2150], target:[-40,280,-3050]},          // 快：飞越库区
  {t:79, eye:[110,560,-3880],  target:[-250,300,-4650]},
  {t:84, eye:[-30,362,-4320],  target:[-280,289,-4680]},       // 慢：滨水公园
  {t:90, eye:[-170,330,-4470], target:[-330,286,-4730]},
];
const TOUR=cameraPath(TOUR_KEYS);
const TOUR_END=TOUR.end;
const UNDER={fadeIn:[38.5,41.5],fadeOut:[65.8,66.6],model:[37,67]};
const PLACE_CAPTIONS=[
  {t:[1,9],  title:'白鹤滩水电站',sub:'金沙江下游 · 四川宁南与云南巧家交界'},
  {t:[17,29],title:'混凝土双曲拱坝',sub:'最大坝高 289 m · 坝顶弧长 709 m · 6 表孔 7 深孔泄洪'},
  {t:[31,38],title:'左岸进水口',sub:'8 孔进水塔 · 拦污栅 · 单机单洞'},
  {t:[40,45],title:'穿入山体',sub:'岩体半透明显示地下引水系统'},
  {t:[46,62],title:'左岸地下主厂房',sub:'8 台百万千瓦机组 · 开挖高度 88.7 m'},
  {t:[72,79],title:'上游水库',sub:'正常蓄水位 825 m · 总库容约 206 亿 m³'},
  {t:[81,90],title:'库区滨水公园',sub:'岸线步道 · 廊架 · 乔灌草'},
];

// —— 发电原理讲解 ——
// 机组局部坐标：与厂房内“机组剖视”一致（原点为机组中心，+Y 向上）。
const E0=TOUR_END+1.5; // 转场后开始
const SCENES=[
  {id:'title',  d:6},
  {id:'head',   d:15},
  {id:'guide',  d:15},
  {id:'runner', d:13},
  {id:'shaft',  d:9},
  {id:'gen',    d:20},
  {id:'grid',   d:15},
  {id:'tail',   d:13},
  {id:'summary',d:12},
];
{let t=E0;for(const s of SCENES){s.t0=t;t+=s.d;s.t1=t;}}
export const DURATION=SCENES.at(-1).t1;

const SUBS=[
  // [开始, 结束, 文字]（时间相对各讲解段起点）
  ['head',0.6,7,'发电的能量来自“水头”：水库水面比下游高出约 235 米。'],
  ['head',7,14.6,'高处的水具有重力势能 E = mgh。1 立方米水落下 200 多米，大约能发 0.55 度电。'],
  ['guide',0.5,7.5,'水经压力管道进入蜗壳。蜗壳越往里越细，让水从四周均匀地流向中心。'],
  ['guide',7.5,14.6,'内圈的活动导叶像百叶窗：开得越大，流量越大，发出的电越多。'],
  ['runner',0.5,6.5,'水从外圈冲进转轮，在弯曲的叶片间转弯，再向下流出。'],
  ['runner',6.5,12.6,'水改变方向时推动叶片，转轮就转起来——水能变成了机械能。'],
  ['shaft',0.5,8.6,'转轮和上方发电机的转子装在同一根立轴上，一起转动，没有齿轮。'],
  ['gen',0.5,6.5,'励磁电流让转子的 54 个磁极变成 N、S 交替的电磁铁。'],
  ['gen',6.5,13,'磁极扫过定子线圈，线圈里的磁通不断变化，就感应出交流电。'],
  ['gen',13,19.6,'27 对磁极 × 每分钟 111.1 转 ÷ 60 ≈ 50 赫兹，正好和电网频率一致。'],
  ['grid',0.5,7.5,'发电机输出 24 千伏，主变压器把它升到 500 千伏。'],
  ['grid',7.5,14.6,'电压升高，电流变小，线路发热损失也更小。电力经 ±800 千伏特高压直流送往华东。'],
  ['tail',0.5,6.5,'做完功的水经尾水管减速，回收剩余动能。'],
  ['tail',6.5,12.6,'两台机组共用一个尾水调压室，缓冲水锤，再经尾水隧洞回到金沙江。'],
  ['summary',0.5,11.6,'水能 → 机械能 → 电能：16 台机组，总装机 1600 万千瓦。'],
];

/** 影片专用：把大量静态小构件按材质与 500 m 空间格合并成少数网格，减少绘制调用。
 * 原网格只是隐藏，几何形状与位置完全不变。 */
function mergeStatic(root,cell=500){
  const buckets=new Map(),v=new THREE.Vector3(),nm=new THREE.Matrix3(),disposed=new Set();
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||Array.isArray(o.material)||o.material.transparent)return;
    for(let p=o;p;p=p.parent)if(!p.visible)return;
    const g=o.geometry,pos=g.attributes.position;if(!pos||pos.itemSize!==3)return;
    const tris=(g.index?g.index.count:pos.count)/3;if(tris>20000)return;
    // 地形分块共享一整块顶点缓冲，只用各自索引；这类网格数量少，不合并。
    if(g.index&&pos.count>g.index.count*2)return;
    if(!g.boundingSphere)g.computeBoundingSphere();v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
    const key=[o.material.uuid,o.castShadow,o.receiveShadow,Math.floor(v.x/cell),Math.floor(v.z/cell)].join('|');
    if(!buckets.has(key))buckets.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,list:[]});buckets.get(key).list.push(o);
  });
  const out=new THREE.Group();out.name='Cinematic merged static details';let merged=0;const hidden=[];
  for(const b of buckets.values()){
    if(b.list.length<2)continue;
    let vertices=0,indices=0;for(const o of b.list){const g=o.geometry;vertices+=g.attributes.position.count;indices+=g.index?g.index.count:g.attributes.position.count;}
    const P3=new Float32Array(vertices*3),N3=new Float32Array(vertices*3),U2=new Float32Array(vertices*2),I=new Uint32Array(indices);let vo=0,io=0;
    for(const o of b.list){
      const g=o.geometry,pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv;nm.getNormalMatrix(o.matrixWorld);
      for(let i=0;i<pos.count;i++){
        const k=(vo+i)*3;v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);P3[k]=v.x;P3[k+1]=v.y;P3[k+2]=v.z;
        if(nor){v.fromBufferAttribute(nor,i).applyMatrix3(nm).normalize();N3[k]=v.x;N3[k+1]=v.y;N3[k+2]=v.z;}
        if(uv&&uv.itemSize===2){U2[(vo+i)*2]=uv.getX(i);U2[(vo+i)*2+1]=uv.getY(i);}
      }
      if(g.index)for(let k=0;k<g.index.count;k++)I[io+k]=g.index.getX(k)+vo;else for(let k=0;k<pos.count;k++)I[io+k]=vo+k;
      io+=g.index?g.index.count:pos.count;vo+=pos.count;o.visible=false;hidden.push(o);merged++;
      // 释放原网格的显存（软件渲染时即内存）；影片模式下这些原网格不再绘制。
      if(!disposed.has(g)){disposed.add(g);g.dispose();}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P3,3));geo.setAttribute('normal',new THREE.BufferAttribute(N3,3));geo.setAttribute('uv',new THREE.BufferAttribute(U2,2));geo.setIndex(new THREE.BufferAttribute(I,1));geo.computeBoundingSphere();
    const m=new THREE.Mesh(geo,b.material);m.castShadow=b.cast;m.receiveShadow=b.receive;m.matrixAutoUpdate=false;out.add(m);
  }
  root.add(out);out.updateMatrixWorld(true);return {group:out,merged,hidden,meshes:out.children.length};
}

export function installCinematic({scene,renderer,rig,terrain,dam,water,district,buildings,creatures,effects,lighting,reflections,occlusion,W=1920,H=1080,RW=1280,RH=720}){
  // 三维画面以 RW×RH 渲染后放大合成；文字与二维动画按 W×H 原生分辨率绘制，保持清晰。
  const camera=rig.camera;
  const mergeStats=[terrain,dam,buildings].map(r=>mergeStatic(r));
  const out=document.createElement('canvas');out.width=W;out.height=H;const g=out.getContext('2d');
  // —— 地下模型与照明（照明一直存在，强度为 0 时不影响室外，避免中途重新编译着色器） ——
  const model=createPowerhouseModel();model.root.visible=false;scene.add(model.root);
  const hallLights=new THREE.Group();
  const hemi=new THREE.HemisphereLight(0xc9e9ff,0x24404a,0),key=new THREE.DirectionalLight(0xe3f4ff,0);key.position.set(70,120,100);
  hallLights.add(hemi,key,key.target);scene.add(hallLights);
  model.setMode('hall');
  // 岩体半透明材质：与“进入电站内部”相同的做法，只改透明度，不动几何。
  const forest=terrain.getObjectByName('Canyon natural ridge forest');
  const xray=new Map(),terrainMeshes=[];
  terrain.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;terrainMeshes.push([o,o.material]);
    if(!xray.has(o.material)){const c=o.material.clone();c.onBeforeCompile=o.material.onBeforeCompile;c.customProgramCacheKey=o.material.customProgramCacheKey;c.transparent=true;c.depthWrite=false;c.side=THREE.DoubleSide;xray.set(o.material,c);}});
  let xrayOn=false;
  function setRockOpacity(a){
    const want=a<.999;
    if(want!==xrayOn){xrayOn=want;for(const [o,m] of terrainMeshes)o.material=want?xray.get(m):m;forest.visible=!want;}
    for(const m of xray.values())m.opacity=a;
  }
  // —— 讲解用水流粒子：沿所选机组真实的压力管道、尾水管、尾水隧洞曲线 ——
  const BANK=0,UNIT=3;
  const system=model.banks[BANK].children.find(c=>c.name==='引水竖井与尾水支洞');
  const curveOf=name=>system.children.find(c=>c.name===name&&c.userData.unit===UNIT)?.geometry.parameters.path;
  const tunnels=system.children.filter(c=>c.name==='尾水隧洞');
  const waterCurves=[curveOf('单洞单机 · 引水上平洞与竖井'),curveOf('尾水管与尾水支洞'),tunnels[Math.floor(UNIT/2)].geometry.parameters.path].filter(Boolean);
  const dropsRoot=new THREE.Group();dropsRoot.position.set(...BANK_CENTRES[BANK]);model.root.add(dropsRoot);
  const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(1.1,8,6),new THREE.MeshBasicMaterial({color:0x7fe9ff}),240);drops.frustumCulled=false;drops.visible=false;dropsRoot.add(drops);
  const cavern=system.children.find(c=>c.name==='主变洞');
  const pairSurge=system.children.filter(c=>c.name==='两机共用 · 尾水调压室')[Math.floor(UNIT/2)],pairTunnel=tunnels[Math.floor(UNIT/2)];
  const dummy=new THREE.Object3D();
  function updateDrops(t,on){
    drops.visible=on;if(!on)return;
    for(let i=0;i<drops.count;i++){const c=waterCurves[i%waterCurves.length],u=(i/drops.count*3+t*.05)%1;dummy.position.copy(c.getPointAt(u));dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);}
    drops.instanceMatrix.needsUpdate=true;drops.updateMatrixWorld(true);
  }

  // —— 影片专用细节层次（LOD）：软件渲染以顶点为瓶颈。远处树冠按距离抽稀，
  // 树干、草丛只在近处绘制；不改变网页里的模型，也不改变任何实例的位置。
  const lodItems=[];const sphere=new THREE.Sphere();
  scene.traverse(o=>{
    if(!o.isInstancedMesh)return;const n=o.name;let kind=null;
    if(/canopy|crowns|shrub|灌木|reeds/i.test(n))kind='crown';else if(/trunk/i.test(n))kind='trunk';else if(/grass|草丛|野花|flower|bloom/i.test(n))kind='grass';
    if(!kind)return;if(!o.boundingSphere)o.computeBoundingSphere();
    lodItems.push({o,kind,full:o.count,s:o.boundingSphere.clone().applyMatrix4(o.matrixWorld)});
  });
  function applyLod(cam){
    for(const it of lodItems){
      const d=Math.max(0,cam.distanceTo(it.s.center)-it.s.radius);
      if(it.kind==='crown')it.o.count=Math.max(1,Math.round(it.full*(d<450?1:Math.max(.1,(450/d)**1.6))));
      else it.o.visible=d<(it.kind==='trunk'?300:180);
    }
  }
  const outdoor=[terrain,dam,water.group,district.group,buildings,creatures.group,effects.group,lighting.sky];
  const fogDensity=.00009;
  let lastT=null,simTime=0,stage=null;
  const eye=new THREE.Vector3(),target=new THREE.Vector3(),tmp=new THREE.Vector3();
  function stageTour(){
    if(stage==='tour')return;stage='tour';
    for(const o of outdoor)o.visible=true;lighting.sky.visible=true;
    scene.fog=new THREE.FogExp2(0xc9d6dd,fogDensity);scene.background=new THREE.Color(0xc9d6dd);
    model.setMode('hall');effects.setEnabled(true);
  }
  const explainBg=new THREE.Color(0x0b1820);
  function stageExplain(){
    if(stage==='explain')return;stage='explain';
    for(const o of outdoor)o.visible=false;setRockOpacity(1);forest.visible=false;
    scene.fog=null;scene.background=explainBg;
    model.select(BANK,UNIT);model.setMode('unit');model.root.visible=true;
    // 只保留所选机组：其余厂房、机组与另一岸隐藏，形成干净的“展台”。
    model.banks[1].visible=false;model.halls[BANK].visible=false;
    const covers=model.banks[BANK].children.find(c=>c.name==='8 台发电机组');
    covers.children.forEach((c,j)=>{c.visible=j===UNIT;for(const part of c.children)if(part!==model.detailed)part.visible=false;});
    model.configure({cut:true,explosion:0,flow:true,field:false,gate:.72});
    hemi.intensity=1.3;key.intensity=2.6;model.root.updateMatrixWorld(true);
  }
  // 太阳阴影区域跟随相机目标，远处的公园也有正确投影。
  function followSun(at){
    lighting.sun.target.position.copy(at);lighting.sun.position.set(at.x-550,at.y+1900,at.z+1050);
    lighting.sun.target.updateMatrixWorld();lighting.sun.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;
  }
  const local=(x,y,z)=>model.detailed.localToWorld(tmp.set(x,y,z)).clone();
  function look(e,t2){camera.position.copy(e);camera.lookAt(t2);camera.updateMatrixWorld();}
  function project(v){const p=v.clone().project(camera);return {x:(p.x*.5+.5)*W,y:(-p.y*.5+.5)*H,ok:p.z<1};}

  // —— 3D 部分 ——
  function renderTour(t,dt){
    stageTour();
    TOUR.sample(t,eye,target);
    // 地面安全高度：室外段不让相机钻入地形（地下段除外）。
    look(eye,target);camera.fov=43+19*smooth(43,46,t)*(1-smooth(61,64,t));camera.near=t>40&&t<67?.3:1;camera.updateProjectionMatrix();
    const rock=t<UNDER.fadeIn[0]?1:t<UNDER.fadeIn[1]?mix(1,.13,smooth(...UNDER.fadeIn,t)):t<UNDER.fadeOut[0]?.13:mix(.13,1,smooth(...UNDER.fadeOut,t));
    setRockOpacity(rock);water.group.visible=rock>.6;
    model.root.visible=t>UNDER.model[0]&&t<UNDER.model[1];
    const hall=smooth(42,46,t)*(1-smooth(61,65,t));hemi.intensity=1.3*hall;key.intensity=2.4*hall;
    if(model.root.visible)model.root.updateMatrixWorld(true);
    applyLod(eye);creatures.group.visible=t>76;
    simTime+=dt;water.update(simTime);effects.update(dt);district.update(simTime);lighting.update?.(simTime);
    if(creatures.loaded)creatures.update(simTime);
    scene.fog.density=.00007+.00016*smooth(450,1200,eye.y);
    if(Math.round(t*FPS)%5===0)followSun(target);
    reflections.update(renderer,scene,camera,simTime*1000);
    renderer.render(scene,camera);
  }
  const op=gate=>operatingPoint({upstream:825,gate});
  let gateNow=.72,fieldNow=false,explosionNow=0;
  function renderExplain(t,dt){
    stageExplain();
    const s=SCENES.find(x=>t<x.t1)||SCENES.at(-1),lt=t-s.t0,p=lt/s.d;
    let e=[60,40,90],tg=[0,12,0],field=false,explosion=0,gate=.72,dropsOn=false;
    switch(s.id){
      case 'title': e=[mix(70,52,ease(p)),mix(46,36,ease(p)),mix(100,82,ease(p))];tg=[0,13,0];break;
      case 'head': e=[52,36,82];tg=[0,13,0];break; // 背景为 2D 剖面动画
      case 'guide':{const a=mix(-.35,.5,ease(p));e=[34*Math.cos(a)+4,mix(26,20,ease(p)),34*Math.sin(a)+30];tg=[2,4,0];gate=lt<7?.72:mix(.25,.95,smooth(7.5,13,lt));break;}
      case 'runner':{const a=mix(.15,.9,ease(p));e=[24*Math.cos(a),mix(10,13,p),24*Math.sin(a)+8];tg=[0,3.5,0];break;}
      case 'shaft': e=[mix(30,40,ease(p)),mix(12,30,ease(p)),mix(40,56,ease(p))];tg=[0,mix(6,20,ease(p)),0];explosion=smooth(1,3,lt)*(1-smooth(6.5,8.5,lt));break;
      case 'gen':{const a=mix(.95,1.45,ease(p));e=[26*Math.cos(a),mix(30,27,p),26*Math.sin(a)];tg=[0,21,0];field=lt>1;break;}
      case 'grid': e=[mix(18,10,ease(p)),mix(48,56,ease(p)),mix(100,118,ease(p))];tg=[mix(-10,-31,ease(p)),21,0];break;
      case 'tail': e=[mix(55,-5,ease(p)),mix(55,95,ease(p)),mix(105,200,ease(p))];tg=[mix(-55,-115,ease(p)),mix(2,-12,ease(p)),mix(5,95,ease(p))];dropsOn=true;break;
      case 'summary': e=[60*Math.cos(p*.8+.4),42,60*Math.sin(p*.8+.4)+30];tg=[0,14,0];break;
    }
    if(Math.abs(gate-gateNow)>.002||field!==fieldNow||Math.abs(explosion-explosionNow)>.001){gateNow=gate;fieldNow=field;explosionNow=explosion;model.configure({gate,field,explosion});}
    pairSurge.visible=pairTunnel.visible=s.id==='tail';cavern.visible=s.id==='grid';
    const o=op(gateNow);
    model.update(dt,true,{omega:UNIT_SPEC.ratedSpeed*2*Math.PI/60/20,flowRate:o.flow/600,powerRate:o.generatorMW/1000});
    // 尾水段需要看到系统级管道：显示所选机组的引水/尾水管道与调压室。
    updateDrops(t,dropsOn);
    look(local(...e),local(...tg));camera.fov=42;camera.near=.12;camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    return {scene:s,lt,p,op:o};
  }

  // —— 2D 叠加层 ——
  function text(str,x,y,{size=34,color='#fff',align='left',weight=500,base='alphabetic',alpha=1}={}){g.save();g.globalAlpha*=alpha;g.font=`${weight} ${size}px ${FONT}`;g.fillStyle=color;g.textAlign=align;g.textBaseline=base;g.fillText(str,x,y);g.restore();}
  function panel(x,y,w,h,alpha=.82,r=14){g.save();g.globalAlpha*=alpha;g.fillStyle='#0b1c26';g.beginPath();g.roundRect(x,y,w,h,r);g.fill();g.globalAlpha=1*alpha;g.strokeStyle='#2e4c5a';g.lineWidth=2;g.stroke();g.restore();}
  function subtitle(str,alpha){
    if(!str||alpha<=0)return;g.save();g.font=`500 40px ${FONT}`;const w=Math.min(W-160,g.measureText(str).width+80);
    g.globalAlpha=alpha*.72;g.fillStyle='#08141b';g.beginPath();g.roundRect((W-w)/2,H-150,w,74,12);g.fill();g.restore();
    text(str,W/2,H-100,{size:40,align:'center',alpha});
  }
  function arrow(x1,y1,x2,y2,color,width=5,head=18){g.save();g.strokeStyle=color;g.fillStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();const a=Math.atan2(y2-y1,x2-x1);g.beginPath();g.moveTo(x2,y2);g.lineTo(x2-head*Math.cos(a-.4),y2-head*Math.sin(a-.4));g.lineTo(x2-head*Math.cos(a+.4),y2-head*Math.sin(a+.4));g.closePath();g.fill();g.restore();}
  function callout(v,label,color='#ffd989',alpha=1,dx=60,dy=-50){const p=project(v);if(!p.ok)return;g.save();g.globalAlpha=alpha;g.strokeStyle=color;g.fillStyle=color;g.lineWidth=2.5;g.beginPath();g.arc(p.x,p.y,7,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x+dx,p.y+dy);g.lineTo(p.x+dx+(dx>0?24:-24),p.y+dy);g.stroke();g.restore();
    g.save();g.globalAlpha=alpha;g.font=`500 30px ${FONT}`;const w=g.measureText(label).width+28,bx=dx>0?p.x+dx+24:p.x+dx-24-w;g.fillStyle='#0b1c26e0';g.beginPath();g.roundRect(bx,p.y+dy-24,w,48,8);g.fill();g.restore();
    text(label,(dx>0?p.x+dx+38:p.x+dx-38),p.y+dy+11,{size:30,color,align:dx>0?'left':'right',alpha});}
  function chip(x,y,title,value,color='#e7f2f3',w=250){panel(x,y,w,92,.9,10);text(title,x+18,y+34,{size:22,color:'#86a5b2'});text(value,x+18,y+74,{size:32,color});}

  function overlayTour(t){
    // 片头与地点字幕（左下角），淡入淡出。
    for(const c of PLACE_CAPTIONS){const a=smooth(c.t[0],c.t[0]+.8,t)*(1-smooth(c.t[1]-.8,c.t[1],t));if(a<=0)continue;
      g.save();g.globalAlpha=a;g.translate(80,H);g.scale(1,.33);const grad=g.createRadialGradient(0,0,0,0,0,1000);grad.addColorStop(0,'#0b1c26b8');grad.addColorStop(.6,'#0b1c2670');grad.addColorStop(1,'#0b1c2600');g.fillStyle=grad;g.fillRect(-80,-1000,1100,1000);g.restore();
      g.save();g.globalAlpha=a*.85;g.fillStyle='#ffd27a';g.fillRect(70,H-205,6,110);g.restore();
      text(c.title,100,H-150,{size:c===PLACE_CAPTIONS[0]?64:48,weight:600,alpha:a});text(c.sub,102,H-102,{size:28,color:'#d6e6ea',alpha:a});}
    if(t>TOUR_END-2){g.save();g.globalAlpha=smooth(TOUR_END-2,TOUR_END+1.5,t);g.fillStyle='#0b1820';g.fillRect(0,0,W,H);g.restore();}
  }
  // 2D 剖面：水库—坝—压力管道—机组—尾水，粒子沿真实先后流动。
  function headDiagram(lt,alpha){
    g.save();g.globalAlpha=alpha;g.fillStyle='#0b1820';g.fillRect(0,0,W,H);
    const X0=170,X1=1750,Y=e=>mix(930,170,(e-540)/(860-540));
    // 山体剖面
    g.fillStyle='#2b3a33';g.beginPath();g.moveTo(X0,Y(540));g.lineTo(X0,Y(840));g.lineTo(820,Y(845));g.lineTo(900,Y(834));g.lineTo(980,Y(834));g.lineTo(1150,Y(700));g.lineTo(1320,Y(600));g.lineTo(X1,Y(598));g.lineTo(X1,Y(540));g.closePath();g.fill();
    // 水库与下游
    g.fillStyle='#1d7f86';g.beginPath();g.moveTo(X0,Y(825));g.lineTo(900,Y(825));g.lineTo(900,Y(560));g.lineTo(X0,Y(560));g.closePath();g.globalAlpha=alpha*.85;g.fill();
    g.beginPath();g.moveTo(1320,Y(590));g.lineTo(X1,Y(590));g.lineTo(X1,Y(560));g.lineTo(1320,Y(560));g.closePath();g.fill();g.globalAlpha=alpha;
    // 拱坝剖面
    g.fillStyle='#cdc3ac';g.beginPath();g.moveTo(900,Y(834));g.lineTo(915,Y(834));g.lineTo(990,Y(545));g.lineTo(890,Y(545));g.closePath();g.fill();
    // 引水线路：进水口 → 竖井 → 机组 → 尾水隧洞
    const route=[[860,Y(745)],[1040,Y(745)],[1040,Y(590)],[1180,Y(575)],[1280,Y(575)],[1340,Y(585)]];
    g.strokeStyle='#5fa9c1';g.lineWidth=26;g.lineJoin='round';g.beginPath();route.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
    g.fillStyle='#ffd27a';g.beginPath();g.arc(1180,Y(578),26,0,Math.PI*2);g.fill();
    text('机组',1180,Y(578)-44,{size:28,align:'center',color:'#ffd27a'});
    // 流动的水滴
    const segs=[];let total=0;for(let i=0;i<route.length-1;i++){const l=Math.hypot(route[i+1][0]-route[i][0],route[i+1][1]-route[i][1]);segs.push(l);total+=l;}
    g.fillStyle='#bff6ff';
    for(let k=0;k<26;k++){let d=((k/26+lt*.09)%1)*total,i=0;while(d>segs[i]){d-=segs[i];i++;}const f=d/segs[i],x=mix(route[i][0],route[i+1][0],f),y=mix(route[i][1],route[i+1][1],f);g.beginPath();g.arc(x,y,7,0,Math.PI*2);g.fill();}
    // 水位与水头
    g.setLineDash([12,10]);g.strokeStyle='#9fd8e6';g.lineWidth=2;for(const e of [825,590]){g.beginPath();g.moveTo(X0,Y(e));g.lineTo(X1,Y(e));g.stroke();}g.setLineDash([]);
    text('正常蓄水位 825 m',X0+16,Y(825)-16,{size:30,color:'#c9f1f6'});text('下游尾水约 590 m',X1-16,Y(590)-16,{size:30,color:'#c9f1f6',align:'right'});
    const a=smooth(1.5,4,lt);if(a>0){g.globalAlpha=alpha*a;arrow(1560,Y(825)+6,1560,Y(590)-6,'#ffd27a',6,22);arrow(1560,Y(590)-6,1560,Y(825)+6,'#ffd27a',6,22);g.globalAlpha=alpha;
      text('水头 ≈ 235 m',1590,(Y(825)+Y(590))/2+12,{size:44,weight:700,color:'#ffd27a',alpha:a});}
    const b=smooth(7.5,9.5,lt);if(b>0){const py=Y(780);panel(X0+40,py,600,180,b*.94);text('重力势能  E = m · g · h',X0+70,py+65,{size:40,weight:600,alpha:b});text('1 m³ 水 ≈ 1 吨，落差 200 多米',X0+70,py+118,{size:30,color:'#cfe1e6',alpha:b});text('→ 约 0.55 kW·h 电能',X0+70,py+160,{size:30,color:'#ffd27a',alpha:b});}
    text('剖面示意（高程按比例，水平方向压缩）',X1,H-40,{size:22,color:'#6f8d99',align:'right'});
    g.restore();
  }
  function gateInset(lt,o){
    const a=smooth(7.5,8.5,lt);if(a<=0)return;g.save();g.globalAlpha=a;
    const x=W-560,y=150;panel(x,y,480,330,.92);text('导叶开度 → 流量 → 出力',x+28,y+52,{size:30,weight:600});
    const bars=[['导叶开度',o.gate,`${Math.round(o.gate*100)}%`,'#8edfea'],['过机流量',o.flow/600,`${Math.round(o.flow)} m³/s`,'#5fa9c1'],['发电机出力',o.generatorMW/1100,`${Math.round(o.generatorMW)} MW`,'#ffd27a']];
    bars.forEach(([k,v,label,c],i)=>{const yy=y+105+i*72;text(k,x+28,yy,{size:24,color:'#9fb9c4'});g.fillStyle='#1b3340';g.fillRect(x+28,yy+14,420,18);g.fillStyle=c;g.fillRect(x+28,yy+14,420*clamp(v),18);text(label,x+448,yy,{size:26,color:c,align:'right'});});
    text('转速始终 111.1 r/min（被电网频率锁定）',x+28,y+312,{size:22,color:'#86a5b2'});g.restore();
  }
  function inductionInset(lt){
    const a=smooth(6.5,7.5,lt)*(1-smooth(19.2,19.9,lt));if(a<=0)return;g.save();g.globalAlpha=a;
    const x=70,y=170,w=620,h=480;panel(x,y,w,h,.97);text('电磁感应示意',x+28,y+50,{size:30,weight:600});
    const cx=x+170,cy=y+215,win=115;
    // 线圈
    g.strokeStyle='#dca25a';g.lineWidth=6;for(let k=0;k<5;k++){g.beginPath();g.ellipse(cx+k*10-20,cy,24,72,0,0,Math.PI*2);g.stroke();}
    // 磁极条带从线圈前向下移动（N 红、S 蓝交替），只在窗口内显示
    g.save();g.beginPath();g.rect(cx-150,cy-win,90,win*2);g.clip();
    const ph=(lt-6.5)*1.2,pitch=76,shift=(ph*pitch)%(2*pitch);
    for(let k=-3;k<=3;k++){const yy=cy+k*pitch+shift-pitch;const n=((k%2)+2)%2===0;
      g.fillStyle=n?'#d0605a':'#4f9fd8';g.fillRect(cx-140,yy-32,70,64);text(n?'N':'S',cx-105,yy+12,{size:32,weight:700,align:'center'});}
    g.restore();
    text('转子磁极',cx-105,cy+win+38,{size:22,color:'#86a5b2',align:'center'});text('定子线圈',cx,cy+win+38,{size:22,color:'#86a5b2',align:'center'});
    // 电压波形与磁极同步：每过一对磁极，电压完成一个周期
    const gx=x+300,gw=290;g.strokeStyle='#2f4b58';g.lineWidth=2;g.beginPath();g.moveTo(gx,cy);g.lineTo(gx+gw,cy);g.stroke();
    g.strokeStyle='#ffd27a';g.lineWidth=4;g.beginPath();for(let i=0;i<=gw;i+=3){const v=Math.sin(ph*Math.PI-i/gw*Math.PI*4);i?g.lineTo(gx+i,cy-v*70):g.moveTo(gx+i,cy-v*70);}g.stroke();
    text('感应电压',gx+gw,cy-88,{size:22,color:'#ffd27a',align:'right'});
    const b=smooth(13,14,lt);if(b>0){g.globalAlpha=a*b;g.fillStyle='#132a36';g.beginPath();g.roundRect(x+20,y+h-82,w-40,60,8);g.fill();text('f = 27 对极 × 111.1 r/min ÷ 60 ≈ 50 Hz',x+w/2,y+h-41,{size:30,weight:600,color:'#ffd27a',align:'center',alpha:a*b});}
    g.restore();
  }
  function gridInset(lt){
    const a=smooth(.8,1.8,lt);if(a<=0)return;g.save();g.globalAlpha=a;
    const x=120,y=110,w=W-240,h=270;panel(x,y,w,h,.93);
    const nodes=[['发电机','24 kV','≈ 27 kA'],['主变压器','500 kV','≈ 1.3 kA'],['换流站','±800 kV 直流','远距离外送'],['华东电网','江苏 · 浙江','约 2000 km']];
    const nx=i=>x+150+i*(w-300)/3,ny=y+120;
    for(let i=0;i<3;i++){g.strokeStyle='#2f4b58';g.lineWidth=6;g.beginPath();g.moveTo(nx(i)+90,ny);g.lineTo(nx(i+1)-90,ny);g.stroke();
      for(let k=0;k<5;k++){const f=((k/5+lt*.35)%1);g.fillStyle='#ffd27a';g.beginPath();g.arc(mix(nx(i)+90,nx(i+1)-90,f),ny,7,0,Math.PI*2);g.fill();}}
    nodes.forEach(([n,v,c],i)=>{const b=smooth(1+i*1.2,2+i*1.2,lt);g.globalAlpha=a*b;g.fillStyle='#132a36';g.beginPath();g.roundRect(nx(i)-90,ny-52,180,104,12);g.fill();g.strokeStyle='#ffd27a';g.lineWidth=2;g.stroke();
      text(n,nx(i),ny-10,{size:28,weight:600,align:'center',alpha:a*b});text(v,nx(i),ny+30,{size:26,color:'#ffd27a',align:'center',alpha:a*b});text(c,nx(i),ny+92,{size:24,color:'#9fb9c4',align:'center',alpha:a*b});});
    g.globalAlpha=a;text('同样 100 万 kW：电压升高约 20 倍，电流降到约 1/20，导线发热损失 ∝ I²',x+w/2,y+h-22,{size:26,color:'#cfe1e6',align:'center',alpha:a*smooth(7.5,8.5,lt)});
    g.restore();
  }
  function surgeInset(lt){
    const a=smooth(6.5,7.3,lt);if(a<=0)return;g.save();g.globalAlpha=a;
    const x=W-520,y=150,w=440,h=380;panel(x,y,w,h,.93);text('尾水调压室：缓冲水锤',x+28,y+50,{size:30,weight:600});
    const cx=x+w/2,top=y+90,bottom=y+300;g.strokeStyle='#9fb9c4';g.lineWidth=4;g.strokeRect(cx-80,top,160,bottom-top);
    const level=mix(top,bottom,.5)+Math.sin((lt-6.5)*4)*60*Math.exp(-(lt-6.5)*.35);
    g.fillStyle='#1d7f86';g.fillRect(cx-78,level,156,bottom-level-2);
    g.fillStyle='#1d7f86';g.fillRect(x+30,bottom-30,w-60,28);
    text('负荷突变 → 水位上下摆动 → 压力波被吸收',cx,y+h-26,{size:22,color:'#cfe1e6',align:'center'});g.restore();
  }
  function summaryCard(lt,o){
    const a=smooth(.3,1.3,lt);g.save();g.globalAlpha=a*.86;g.fillStyle='#0b1820';g.fillRect(0,0,W,H);g.restore();g.save();g.globalAlpha=a;
    const items=[['水能',`${Math.round(o.hydraulicMW)} MW`,'#5fa9c1','水流功率（毛水头）'],['机械能',`${Math.round(o.turbineMW)} MW`,'#cfe1e6',`水轮机效率 ${(o.turbineEff*100).toFixed(1)}%`],['电能',`${Math.round(o.gridMW)} MW`,'#ffd27a','送入电网']];
    items.forEach(([n,v,c,s],i)=>{const b=smooth(.8+i*1.3,1.8+i*1.3,lt),x=360+i*600,y=380;g.globalAlpha=a*b;g.fillStyle='#132a36';g.beginPath();g.arc(x,y,150,0,Math.PI*2);g.fill();g.strokeStyle=c;g.lineWidth=5;g.stroke();
      text(n,x,y-20,{size:52,weight:700,color:c,align:'center',alpha:a*b});text(v,x,y+40,{size:36,align:'center',alpha:a*b});text(s,x,y+200,{size:26,color:'#9fb9c4',align:'center',alpha:a*b});
      if(i<2){g.globalAlpha=a*smooth(1.6+i*1.3,2.4+i*1.3,lt);arrow(x+170,y,x+430,y,c,6,24);}});
    g.globalAlpha=a*smooth(5,6,lt);
    text(`以一台机组、水位 825 m、导叶开度 72% 为例：约 ${(o.gridMW/o.hydraulicMW*100).toFixed(0)}% 的水能变成送入电网的电能`,W/2,700,{size:32,align:'center',color:'#cfe1e6',alpha:a*smooth(5,6,lt)});
    text('16 台 × 100 万 kW = 1600 万 kW   ·   多年平均年发电量约 624 亿 kW·h',W/2,770,{size:34,weight:600,align:'center',color:'#ffd27a',alpha:a*smooth(6.5,7.5,lt)});
    const c=smooth(9,10.5,lt);text('白鹤滩 · 数字模型与发电原理',W/2,880,{size:30,align:'center',color:'#9fb9c4',alpha:a*c});
    text('Created by 段茜媛 · 蒋寒狄 · 刘子涵 · 罗惟伊 · 彭钰绚 · 王晨熙 · 王金涛 · 温子萱',W/2,925,{size:24,align:'center',color:'#6f8d99',alpha:a*c});
    g.restore();
  }
  function overlayExplain(t,info){
    const {scene:s,lt,op:o}=info;
    if(s.id==='title'){const a=smooth(.3,1.5,lt)*(1-smooth(5,6,lt));g.save();g.globalAlpha=1-smooth(0,1.2,lt);g.fillStyle='#0b1820';g.fillRect(0,0,W,H);g.restore();
      text('发电原理',W/2,H/2-40,{size:96,weight:700,align:'center',alpha:a});text('一滴水怎样变成一度电',W/2,H/2+40,{size:44,align:'center',color:'#ffd27a',alpha:a});}
    if(s.id==='head')headDiagram(lt,smooth(0,.8,lt)*(1-smooth(14.2,15,lt)));
    // 步骤标题（左上）
    const steps={head:'01 水头',guide:'02 引水与导叶',runner:'03 水轮机转轮',shaft:'04 主轴传动',gen:'05 发电机',grid:'06 升压送出',tail:'07 尾水回河'};
    if(steps[s.id]){const a=smooth(0,.8,lt)*(1-smooth(s.d-.6,s.d,lt));panel(70,60,420,78,.85*a,10);text(steps[s.id],100,114,{size:38,weight:600,alpha:a});}
    const d=model.detailed,A=k=>model.anchor(k);
    const fadeIn=(t0,t1=s.d-.6)=>smooth(t0,t0+.7,lt)*(1-smooth(t1,t1+.6,lt));
    if(s.id==='guide'){callout(A('spiral'),'蜗壳','#8edfea',fadeIn(1),70,-70);callout(A('gate'),'活动导叶','#ffd27a',fadeIn(2.5),-80,-90);callout(A('intake'),'压力管道来水','#8edfea',fadeIn(3.5),80,60);gateInset(lt,o);}
    if(s.id==='runner'){callout(A('runner'),'混流式转轮 Ø8.6 m','#cfe1e6',fadeIn(.8),90,-90);
      const c=project(local(0,4,0));const r=170,ph=lt*2.2;const a=fadeIn(6.5);
      if(c.ok&&a>0){g.save();g.globalAlpha=a;g.strokeStyle='#ffd27a';g.lineWidth=6;g.beginPath();g.ellipse(c.x,c.y,r,r*.34,0,ph,ph+Math.PI*1.3);g.stroke();
        const ex=c.x+r*Math.cos(ph+Math.PI*1.3),ey=c.y+r*.34*Math.sin(ph+Math.PI*1.3);arrow(ex-12*Math.cos(ph+Math.PI*1.3+1.57),ey,ex,ey,'#ffd27a',6,22);g.restore();g.save();g.globalAlpha=a*.85;g.fillStyle='#0b1c26';g.beginPath();g.roundRect(c.x-150,c.y+r*.34+26,300,50,8);g.fill();g.restore();text('额定转矩约 86 MN·m',c.x,c.y+r*.34+60,{size:30,color:'#ffd27a',align:'center',alpha:a});}}
    if(s.id==='shaft'){callout(A('shaft'),'同一根立轴','#cfe1e6',fadeIn(.6),90,-40);callout(A('bearing'),'推力轴承：托住转动部分','#cfe1e6',fadeIn(3),90,-60);callout(A('runner'),'转轮','#cfe1e6',fadeIn(1.5),-90,40);}
    if(s.id==='gen'){callout(A('rotor'),'转子 · 54 个磁极','#ff8b74',fadeIn(1),-90,-80);callout(A('stator'),'定子 · 三相绕组','#ffd27a',fadeIn(2.5),-60,90);callout(A('exciter'),'励磁装置','#cfe1e6',fadeIn(.6,6),80,-40);inductionInset(lt);}
    if(s.id==='grid'){gridInset(lt);callout(A('transformer'),'主变压器 24→500 kV','#ffd27a',fadeIn(2),70,90);}
    if(s.id==='tail'){surgeInset(lt);}
    if(s.id==='summary')summaryCard(lt,o);
    // 字幕
    for(const [id,a,b,str] of SUBS)if(id===s.id&&lt>=a&&lt<b)subtitle(str,smooth(a,a+.4,lt)*(1-smooth(b-.4,b,lt)));
    // 场景之间的短暂淡变
    const fade=1-smooth(0,.5,lt);if(fade>0&&s.id!=='title'){g.save();g.globalAlpha=fade*.8;g.fillStyle='#0b1820';g.fillRect(0,0,W,H);g.restore();}
  }

  return {
    W,H,FPS,duration:DURATION,tourEnd:TOUR_END,mergeStats:mergeStats.map(m=>({merged:m.merged,meshes:m.meshes})),
    prepare(){window.__cineActive=true;
      // 合并后不再需要逐构件的地形遮挡；它会把已合并的原构件重新设为可见。
      reflections.setOcclusion(null);for(const m of mergeStats)for(const o of m.hidden)o.visible=false;
      renderer.shadowMap.type=THREE.PCFShadowMap;renderer.setPixelRatio(1);renderer.setSize(RW,RH,false);camera.aspect=W/H;camera.zoom=1;camera.updateProjectionMatrix();renderer.shadowMap.autoUpdate=false;},
    /** 从中途开始分段渲染时，先把泄洪、水面等随时间累积的状态推进到 t。 */
    seek(t){lastT=t;simTime=Math.min(t,TOUR_END);effects.setEnabled(true);for(let x=0;x<Math.min(t,TOUR_END);x+=.1)effects.update(.1);},
    /** 渲染第 t 秒的画面，返回 JPEG dataURL。按时间顺序调用。 */
    frame(t,quality=.9){
      const dt=lastT===null?1/FPS:Math.max(0,t-lastT);lastT=t;
      g.clearRect(0,0,W,H);
      if(t<E0){renderTour(Math.min(t,TOUR_END),dt);g.imageSmoothingQuality='high';g.drawImage(renderer.domElement,0,0,W,H);overlayTour(t);if(t>TOUR_END){g.fillStyle='#0b1820';g.fillRect(0,0,W,H);}}
      else{const info=renderExplain(t,dt);g.imageSmoothingQuality='high';g.drawImage(renderer.domElement,0,0,W,H);overlayExplain(t,info);}
      return out.toDataURL('image/jpeg',quality);
    },
  };
}
