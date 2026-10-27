import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {damPoint,section,crestGateLayout} from './math.js';
import {MeshBuilder,mesh,box} from './geometry.js';
import {member,cable} from './detail-geometry.js';
import {createGantry} from './gantry.js';
export function archBand(group,material,{u0=-1,u1=1,y,width,offset=0,thickness=.3}){
  const b=new MeshBuilder(),n=Math.ceil((u1-u0)*180);
  const p=(u,r,dy=0)=>{const v=damPoint(u,P.dam.height,0,r);v[1]=y+dy;return v;};
  for(let i=0;i<n;i++){
    const a=u0+(u1-u0)*i/n,c=u0+(u1-u0)*(i+1)/n;
    b.quad(p(a,offset+width/2),p(c,offset+width/2),p(c,offset-width/2),p(a,offset-width/2),true);
    if(thickness>0){
      b.quad(p(a,offset-width/2,-thickness),p(c,offset-width/2,-thickness),p(c,offset+width/2,-thickness),p(a,offset+width/2,-thickness),true);
      for(const edge of [-1,1])b.quad(p(a,offset+edge*width/2,-thickness),p(c,offset+edge*width/2,-thickness),p(c,offset+edge*width/2),p(a,offset+edge*width/2),edge===1);
    }
  }
  if(thickness>0)for(const u of [u0,u1])b.quad(p(u,offset-width/2,-thickness),p(u,offset+width/2,-thickness),p(u,offset+width/2),p(u,offset-width/2),u===u1);
  return mesh(b.geometry(),material,group);
}
export function smallBuilding(group,m,pos,size,name='Control building'){
  const root=new THREE.Group();root.position.set(...pos);root.name=name;group.add(root);const [w,h,d]=size;
  box(root,m.concrete,[w,h,d],[0,h/2,0]);box(root,m.darkConcrete,[w+1.2,.6,d+1.2],[0,h+.3,0]);
  for(let x=-w/2+2.5;x<w/2-1;x+=4.5)for(let y=3;y<h-1;y+=4.5)for(const sign of [-1,1])box(root,m.glass,[2.3,1.8,.16],[x,y,sign*(d/2+.08)]).name='Window';
  box(root,m.gate,[1.7,2.6,.18],[0,1.3,d/2+.1]).name='Access door';
  for(const side of [-1,1])box(root,m.white,[.35,h+.6,d+1.3],[side*(w/2+.35),h/2+.3,0]);return root;
}
export function createCrest(m){
  const g=new THREE.Group();g.name='Crest road and six open gate wells';const H=P.dam.height;
  const layout=crestGateLayout(),extent=layout.halfDeck;
  archBand(g,m.asphalt,{y:H+.18,width:9.5}).name='709 m arc crest roadway';
  for(const r of [-6,6])archBand(g,m.concrete,{y:H+1,width:.75,offset:r,thickness:1.0});
  for(const r of [-4.2,4.2])archBand(g,m.white,{y:H+.21,width:.14,offset:r,thickness:0});
  for(let u=-.985;u<.97;u+=.024)archBand(g,m.white,{u0:u,u1:u+.010,y:H+.22,width:.14,thickness:0});
  for(let u=-.97;u<=.97;u+=.025)for(const r of [-6.2,6.2]){
    const p=damPoint(u,H,0,r);member(g,m.rail,[p[0],H+1,p[2]],[p[0],H+2,p[2]],.08,.08,'Crest railing post');
  }
  for(const r of [-6.2,6.2])cable(g,m.rail,Array.from({length:145},(_,i)=>{const p=damPoint(-1+i/72,H,0,r);p[1]=H+2;return p;}),.065).name='Curved crest handrail';
  // Longitudinal deck strips leave six actual openings between seven cross piers.
  for(const [offset,width] of [[7.6,3.4],[12,2.8],[31,9]])archBand(g,m.concrete,{u0:-extent,u1:extent,y:H-1.5,width,offset,thickness:3.2});
  for(const [i,pier] of layout.piers.entries()){
    const {u,width}=pier,angle=-u*P.dam.halfAngle,p=damPoint(u,H,0,19);
    const root=new THREE.Group();root.position.set(p[0],0,p[2]);root.rotation.y=angle;root.name=`Rounded upstream pier ${i+1}`;g.add(root);
    root.userData={u,matchingSurfaceBay:true};
    // One D-shaped pier, with an actual semicircular upstream nose and a flat
    // downstream back. A profile extrusion avoids intersecting box/cylinder skins.
    const r=width/2,profile=new THREE.Shape();
    profile.moveTo(-r,-8.5);profile.lineTo(r,-8.5);profile.lineTo(r,8.5);
    profile.absarc(0,8.5,r,0,Math.PI,false);profile.closePath();
    const solid=new THREE.ExtrudeGeometry(profile,{depth:39,bevelEnabled:false,curveSegments:64});solid.rotateX(-Math.PI/2);
    const cap=mesh(solid,m.concrete,root);cap.position.y=H-43.5;cap.name='Solid D-profile upstream pier';
    archBand(g,m.darkConcrete,{u0:pier.u0,u1:pier.u1,y:H-1.5,width:22,offset:18,thickness:8}).name='Individual gate crossbeam';
    archBand(g,m.concrete,{u0:u-.0048,u1:u+.0048,y:H+2.2,width:9,offset:18,thickness:3.7}).name='Gate hoist base and coping';
    // The aerial close-up shows compact housings on the seven well separators.
    const kiosk=smallBuilding(g,m,damPoint(u,H+2.2,0,18),[4.5,3.0,5.2],'Individual gate-drive housing');
    kiosk.rotation.y=angle;
  }
  for(const [i,o] of layout.wells.entries()){
    const u=o.u,p=damPoint(u,H,0,18),root=new THREE.Group();root.position.set(p[0],H-1.5,p[2]);root.rotation.y=-u*P.dam.halfAngle;g.add(root);root.name=`Open gate well ${i+1}`;
    const half=(section(H).radius+18)*Math.sin((o.u1-o.u0)*P.dam.halfAngle/2),width=half*2;
    root.userData={u,surfaceOpening:i+1,clearWidth:width};
    for(const z of [-8.5,8.5])box(root,m.darkConcrete,[width,8,.75],[0,-4,z]).name='Well lining';
    box(root,m.gate,[width-.5,.55,15],[0,-8,0]).name='Recessed gate and stoplogs';
    for(let x=-half+1;x<=half-1;x+=2.4)box(root,m.rail,[.26,.35,14],[x,-7.6,0]).name='Gate stiffener';
    for(const x of [-half+.2,half-.2])box(root,m.rail,[.28,9,.4],[x,-3.5,7.6]).name='Vertical gate guide';
    for(const x of [-half+.4,half-.4])for(const z of [-7.7,7.7])box(root,m.rail,[.2,1.05,.2],[x,.55,z]).name='Well corner safety post';
    for(const z of [-8,8])member(root,m.rail,[-half+.4,1.05,z],[half-.4,1.05,z],.07,.07,'Well safety rail');
    // Faded rectangular markings on the wide upstream service apron.
    archBand(g,m.bluePaint,{u0:u-.014,u1:u+.014,y:H-1.486,width:4.7,offset:30.5,thickness:0}).name='Weathered service apron marking';
  }
  for(const r of [12,32]){
    archBand(g,m.rail,{u0:-extent+.008,u1:extent-.008,y:H-1.1,width:.32,offset:r,thickness:.25}).name='Gantry travel rail';
    // Bolted sleepers and rail clips are retained as individually editable solids.
    for(let u=-extent+.012;u<extent-.01;u+=.012){
      const p=damPoint(u,H,0,r),a=-u*P.dam.halfAngle;
      box(g,m.darkConcrete,[1.0,.16,1.1],[p[0],H-1.42,p[2]],a).name='Individual rail bearing plate';
      for(const dr of [-.28,.28]){const q=damPoint(u,H,0,r+dr);box(g,m.rail,[.3,.12,.18],[q[0],H-1.23,q[2]],a).name='Individual rail fastening clip';}
    }
    for(const u of [-extent+.012,extent-.012]){
      const p=damPoint(u,H,0,r);box(g,m.red,[1.2,.9,.6],[p[0],H-.75,p[2]],-u*P.dam.halfAngle).name='Rail end travel stop';
    }
  }
  for(const r of [35.3]){
    const edge=Array.from({length:65},(_,i)=>{const p=damPoint(-extent+.003+(2*extent-.006)*i/64,H,0,r);p[1]=H-1.45;return p;});
    for(const p of edge)member(g,m.rail,p,[p[0],p[1]+1.1,p[2]],.075,.075,'Upstream apron handrail post');
    for(const h of [.55,1.1])cable(g,m.rail,edge.map(p=>[p[0],p[1]+h,p[2]]),.055).name='Upstream apron continuous handrail';
  }
  const craneU=layout.wells[0].u,gp=damPoint(craneU,H,0,22);
  createGantry(g,m,[gp[0],H-1.45,gp[2]],-craneU*P.dam.halfAngle).userData.surfaceOpening=1;
  // Solid end abutments carry the access towers and level gauges, rather than
  // leaving the gauge floating beyond the outermost rounded pier.
  for(const sign of [-1,1]){
    const u=sign*(extent-.012);
    archBand(g,m.concrete,{u0:u-.012,u1:u+.012,y:H-1.5,width:28,offset:21,thickness:37}).name='Crest apron end abutment';
    const p=damPoint(u,H,0,12);smallBuilding(g,m,[p[0],H-1,p[2]],[10,10,13],'Crest control / access tower').rotation.y=-u*P.dam.halfAngle;
  }
  const accessU=extent-.01;
  for(let i=0;i<8;i++){const p=damPoint(accessU,H,0,5+i*.7);box(g,m.concrete,[3,.27,.7],[p[0],H-.25-i*.25,p[2]],-accessU*P.dam.halfAngle).name='Platform access stair tread';}
  const marks=mesh(new THREE.PlaneGeometry(1.0,23),m.white,g);const mp=damPoint(accessU,H,0,35.04);marks.position.set(mp[0],H-15,mp[2]);marks.rotation.y=Math.PI-accessU*P.dam.halfAngle;marks.name='Water gauge background';
  for(let i=0;i<24;i++){const p=damPoint(accessU,H,0,35.08);box(g,i%5===0?m.red:m.gate,[i%5===0?1.3:.7,.08,.09],[p[0],H-4-i*.9,p[2]],-accessU*P.dam.halfAngle).name='Water gauge tick';}
  g.userData={surfaceWellCount:layout.wells.length,pierCount:layout.piers.length,alignedWithSurfaceOutlets:true};
  return g;
}
