import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {damPoint,makeOpenings,section} from './math.js';
import {groundHeight,groundShoreline} from './ground-surface.js';
import {mesh,box,ribbon,MeshBuilder} from './geometry.js';
import {member,hollowCylinder,tunnelMouth,railPath} from './detail-geometry.js';
import {createGantry} from './gantry.js';
import {smallBuilding} from './crest.js';
import {portalSpecs} from './portals.js';
import {intakeLayout} from './intake-layout.js';
export function createHydraulics(m){
  const g=new THREE.Group();g.name='Intakes, hollow shafts, outlet basin and permanent operation plazas';const H=P.dam.height;
  for(const [bank,spec] of P.details.intakes.entries()){
    const {side,z,length}=spec,root=new THREE.Group();root.name=`${side} bank intake gallery`;g.add(root);
    const {level}=intakeLayout(bank),front=[],back=[];
    for(let i=0;i<=48;i++){const zz=z-length/2+length*i/48,x=groundShoreline(zz,P.water.upstream,side)-side*10;front.push([x-side*12,level,zz]);back.push([x+side*9,level,zz]);}
    ribbon(root,front,5.5,m.concrete).name='Intake front operation deck';ribbon(root,back,5,m.concrete).name='Intake rear deck';
    for(let i=0;i<=8;i++){
      const zz=z-length/2+length*i/8,x=groundShoreline(zz,P.water.upstream,side)-side*10;
      box(root,m.concrete,[27,52,3.5],[x,level-26,zz]).name='Intake gate pier';box(root,m.concrete,[28,2,4.3],[x,level-1,zz]).name='Intake transverse deck';
      // 视频近景中的闸墩迎水鼻端为圆头，沿水面连续落到水下。
      const nose=mesh(new THREE.CylinderGeometry(1.75,1.75,52,24),m.concrete,root);nose.position.set(x-side*13.5,level-26,zz);nose.name='Rounded intake pier nose';
      if(i<8){
        const mid=zz+length/16,edge=groundShoreline(mid,P.water.upstream,side)-side*23;
        box(root,m.recess,[.5,47,length/8-4],[edge+side*2,level-26,mid]).name='Recessed intake opening';
        for(let j=0;j<10;j++){const dz=-(length/8-5)/2+(length/8-5)*j/9;member(root,m.rail,[edge,level-48,mid+dz],[edge,level-3,mid+dz],.18,.18,'Separate intake trash-rack bar');}
        for(const y of [level-44,level-25,level-5])box(root,m.rail,[.4,.3,length/8-4],[edge-side*.1,y,mid]).name='Rack transverse member';
      }
    }
    railPath(root,m.rail,front.filter((_,i)=>i%4===0));
    for(const strip of [front,back])ribbon(root,strip.map(p=>[p[0],p[1]+.12,p[2]]),.25,m.rail).name='Bank gantry rail';
    // Both ends of the bank galleries carry a red travelling hoist in the references.
    for(const offset of [-.34,.34]){const zz=z+length*offset,x=groundShoreline(zz,P.water.upstream,side)-side*11.5;createGantry(root,m,[x,level,zz],Math.PI/2,.62,{depth:34});}
  }
  for(const [bank,p] of P.details.platforms.entries()){
    const spec=intakeLayout(bank),side=spec.side,level=p.y;
    const lining=m.concrete.clone();lining.roughness=.96;
    const sourceCompile=m.concrete.onBeforeCompile;
    lining.onBeforeCompile=shader=>{
      sourceCompile.call(lining,shader);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vShaftHeight;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>\nvShaftHeight=(modelMatrix*vec4(transformed,1.)).y-${level.toFixed(1)};`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vShaftHeight;').replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=.16+.7*smoothstep(0.,${bank===0?'15.':'18.'},vShaftHeight);`);
    };
    lining.customProgramCacheKey=()=>`shaft-inner-wall-${bank}`;
    const root=new THREE.Group();root.name='Shore-keyed abutment operating terrace';g.add(root);
    // 平台顺岸坡收进山体，前缘弯折，不再是独立悬在水边的大矩形板。
    const front=[],back=[],z0=Math.min(p.z-p.length*.42,spec.z+spec.length/2-8),z1=p.z+p.length*.42;
    for(let i=0;i<=36;i++){const z=z0+(z1-z0)*i/36,x=groundShoreline(z,level-2,side)-side*4;front.push([x,level,z]);back.push([x+side*28,level,z]);}
    const outline=[...front,...back.slice().reverse()],shape=new THREE.Shape();shape.moveTo(outline[0][0],-outline[0][2]);for(const p of outline.slice(1))shape.lineTo(p[0],-p[2]);shape.closePath();
    // 视频约 10 分钟的斜视近景可见厚壁、抬高的方形井筒，而非薄板上的三个黑方块。
    // 只据画面重建外形；不把用途和未展示的地下深度臆定为实际工程参数。
    for(let i=0;i<3;i++){
      const z=p.z-29+i*29,x=groundShoreline(z,level-2,side)+side*15,w=10,d=14,hole=new THREE.Path();
      hole.moveTo(x-w/2,-z-d/2);hole.lineTo(x+w/2,-z-d/2);hole.lineTo(x+w/2,-z+d/2);hole.lineTo(x-w/2,-z+d/2);hole.closePath();shape.holes.push(hole);
      const rise=bank===0?15:18,tower=new THREE.Group();tower.name='Raised rectangular bank shaft';tower.position.set(x,level,z);root.add(tower);
      tower.userData={bank,index:i,clearWidth:w,clearLength:d,rise,reference:'video preview: thick open-topped shaft, dimensions visually estimated'};
      // 四面独立厚墙，底板高于实际岩面，俯视时孔内不会被未开挖地形填平。
      for(const dx of [-6,6])box(tower,m.concrete,[2,rise+1,18],[dx,rise/2-.5,0]).name='Raised shaft side wall';
      for(const dz of [-8,8])box(tower,m.concrete,[10,rise+1,2],[0,rise/2-.5,dz]).name='Raised shaft end wall';
      for(const dx of [-6,6])box(tower,m.darkConcrete,[2.35,.5,18.6],[dx,rise+.1,0]).name='Shaft coping';
      for(const dz of [-8,8])box(tower,m.darkConcrete,[10,.5,2.35],[0,rise+.1,dz]).name='Shaft coping';
      box(tower,m.recess,[10,.45,14],[0,.25,0]).name='Visible shaft recess floor';
      // 内壁的间接光遮蔽与外露混凝土分开，斜视井口也能读出深度。
      for(const dx of [-4.98,4.98])box(tower,lining,[.045,rise-.35,14],[dx,rise/2-.1,0]).name='Shaded shaft inner wall';
      for(const dz of [-6.98,6.98])box(tower,lining,[10,rise-.35,.045],[0,rise/2-.1,dz]).name='Shaded shaft inner wall';
      // 上下导轨与内壁分缝强化深度，墙体不是一块贴图。
      for(const dz of [-6,6])box(tower,m.rail,[.22,rise-1,.25],[-side*4.75,rise/2,dz]).name='Shaft internal guide';
      for(let yy=3;yy<rise;yy+=3)for(const dx of [-7.02,7.02])box(tower,m.joint,[.035,.045,18],[dx,yy,0]).name='Shaft concrete lift joint';
    }
    const top=mesh(new THREE.ExtrudeGeometry(shape,{depth:3,bevelEnabled:false,curveSegments:1}),m.concrete,root);top.rotation.x=-Math.PI/2;top.position.y=level-3;top.name='Contoured operating deck with actual shaft openings';
    const support=new MeshBuilder();
    for(let i=0;i<front.length-1;i++){
      const a=front[i],b=front[i+1],base=q=>[q[0],Math.min(level-8,groundHeight(q[0],q[2])-.8),q[2]];
      support.quad(base(a),base(b),b,a,side<0);
      if(i%4===0)box(root,m.concrete,[.65,1.05,4],[a[0]-side*.35,level+.525,a[2]]).name='Separate terrace parapet';
    }
    mesh(support.geometry(),m.darkConcrete,root).name='Rock-founded abutment terrace front';
    const gallery=spec.station(spec.z+spec.length/2),first=front[0];
    ribbon(root,[[gallery.x,spec.level,gallery.z],[gallery.x+side*5,level-1,gallery.z+9],[first[0]+side*6,level,first[2]+12]],7,m.concrete).name='Intake-to-abutment maintenance connection';
    const end=front.at(-1),crest=damPoint(side*.99,H),connection=[];
    for(let i=0;i<=24;i++){const t=i/24;connection.push([end[0]+side*6+(crest[0]-end[0]-side*6)*t,level+(H+1-level)*t,end[2]+(crest[2]-end[2])*t]);}
    ribbon(root,connection,6,m.concrete).name='Connected dam-abutment access deck';
  }
  const s=P.details.shafts,sx=s.x,sy=s.level,foundationBottom=Math.min(...[-18,18].flatMap(dx=>[-17,17].map(dz=>groundHeight(sx+dx,s.z+dz))))-1;
  box(g,m.darkConcrete,[37,sy-foundationBottom,35],[sx,(sy+foundationBottom)/2,s.z]).name='Circular shaft support terrace';
  for(let i=0;i<s.count;i++){
    const x=sx+(i%3-1)*11.7,z=s.z+(Math.floor(i/3)-.5)*12.5;
    hollowCylinder(g,m.concrete,s.radius,.75,s.height,[x,sy,z]);
    const lining=hollowCylinder(g,m.rusty,s.radius-.76,.12,s.height-.45,[x,sy,z]);lining.name='Visible inner lining of circular structure';
    const floor=mesh(new THREE.CircleGeometry(s.radius-.9,64),m.recess,g);floor.rotation.x=-Math.PI/2;floor.position.set(x,sy+.1,z);
    for(let k=0;k<12;k++){const a=k*Math.PI/6;box(g,m.concrete,[.48,s.height,.48],[x+Math.cos(a)*(s.radius+.05),sy+s.height/2,z+Math.sin(a)*(s.radius+.05)],-a).name='Circular shaft exterior rib';}
  }
  for(const o of makeOpenings().filter(o=>o.kind==='deep')){
    const b=new MeshBuilder(),a=damPoint(o.u0-.004,o.y0-2,-1,-1),c=damPoint(o.u1+.004,o.y0-2,-1,-1),ae=[a[0]*.985,a[1]-8,a[2]+17],ce=[c[0]*.985,c[1]-8,c[2]+17];
    b.quad(a,ae,ce,c);b.quad([a[0]-1,a[1]+6,a[2]],a,ae,[ae[0]-1,ae[1]+3,ae[2]]);b.quad(c,[c[0]+1,c[1]+6,c[2]],[ce[0]+1,ce[1]+3,ce[2]],ce);
    mesh(b.geometry(),m.darkConcrete,g).name='Independent deep-outlet deflector';
  }
  // Baihetan plunge / water-cushion basin, downstream sill and retaining walls.
  const basinBottom=new MeshBuilder();
  for(let z=0;z<436;z+=4){const a=groundShoreline(z,21,-1),b=groundShoreline(z,21,1),c=groundShoreline(z+4,21,-1),d=groundShoreline(z+4,21,1);basinBottom.quad([a,4,z],[c,4,z+4],[d,4,z+4],[b,4,z]);}
  mesh(basinBottom.geometry(),m.darkConcrete,g).name='Submerged water-cushion basin floor';
  for(const side of [-1,1]){
    const path=[],wall=new MeshBuilder();
    for(let z=5;z<=525;z+=5)path.push([groundShoreline(z,31,side)-side*1.5,31,z]);
    ribbon(g,path,7,m.concrete).name='Basin maintenance walkway';
    for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1];wall.quad([a[0],3,a[2]],[b[0],3,b[2]],[b[0],40,b[2]],[a[0],40,a[2]],side<0);}
    mesh(wall.geometry(),m.concrete,g).name='Continuous basin retaining wall';
    railPath(g,m.rail,path.filter((_,i)=>i%5===0));
    tunnelMouth(g,m,portalSpecs().find(s=>s.side===side&&s.name==='Bank diversion-tunnel outlet'));
    // Varying-depth solid buttress ribs run down the excavated face, separate per rib.
    if(side===1)for(let z=50;z<=485;z+=43){
      const b=new MeshBuilder();for(let y=40;y<333;y+=4){const p=(h,dz,inset)=>[groundShoreline(z+dz,h,side)-inset,h,z+dz];
        b.quad(p(y,-1.8,3),p(y,1.8,3),p(y+4,1.8,3),p(y+4,-1.8,3));b.quad(p(y,-1.8,3),p(y,-1.8,-1),p(y+4,-1.8,-1),p(y+4,-1.8,3));b.quad(p(y,1.8,-1),p(y,1.8,3),p(y+4,1.8,3),p(y+4,1.8,-1));}
      mesh(b.geometry(),m.darkConcrete,g).name='Individual downstream buttress rib';
    }
    const bx=side*(section(H).halfWidth+48),bz=12,by=groundHeight(bx,bz)+1;
    box(g,m.darkConcrete,[52,7,33],[bx,by-3.5,bz]);smallBuilding(g,m,[bx,by,bz],[44,12,25],'Bank management building');
  }
  const z=435,left=groundShoreline(z,25,-1),right=groundShoreline(z,25,1);
  box(g,m.concrete,[right-left+4,11,9],[(left+right)/2,22,z]).name='Downstream secondary sill';box(g,m.darkConcrete,[right-left+6,.55,7],[(left+right)/2,27.8,z]).name='Secondary sill crest';
  g.userData={intakes:2,circularShafts:s.count,platforms:2,diversionOutlets:2};return g;
}
