import {spatialTiles} from './spatial-tiles.js';
import * as THREE from 'three';
import {PARAMS as P} from './config.js';
import {mesh,box,MeshBuilder,ribbon} from './geometry.js';
import {groundShoreline,groundHeight} from './ground-surface.js';
import {excavatedGroundGeometry} from './rock-openings.js';
import {portalSpecs} from './portals.js';
import {member,cable,tunnelMouth,pipe} from './detail-geometry.js';
import {retainingWallSpecs} from './bank-layout.js';
import {bankEnvelopeX} from './bank-surface.js';
import {createRetainingWalls,createShoreRocks} from './retaining-walls.js';
import {instanceRepeatedDetails} from './render-optimization.js';
export function createTerrain(m){
  const group=new THREE.Group();group.name='Rock canyon with excavated benches';
  const rock=mesh(excavatedGroundGeometry(),m.rock,group);rock.name='Shared high resolution terrain surface';
  const walls=createRetainingWalls(m),shoreRocks=createShoreRocks(m);group.add(walls,shoreRocks);
  let terraces=0,anchors=0,galleries=0,stairTreads=0,inclinedTendons=0;
  for(const side of [-1,1]){
    // Each bench is a solid strip with a top, riser and underside, not a painted line.
    for(let y=48;y<=432;y+=P.terrain.benchRise){
      // New retaining courses own their solid berms. Keep remaining rock paths
      // as separate continuous intervals, rather than draping a rail across gaps.
      let intervals=[[-460,640]];
      for(const w of retainingWallSpecs().filter(w=>w.side===side&&w.top===y))intervals=intervals.flatMap(([a,b])=>w.z1<=a||w.z0>=b?[[a,b]]:[[a,Math.max(a,w.z0)],[Math.min(b,w.z1),b]].filter(([c,d])=>d-c>1));
      for(const [begin,end] of intervals){
      const b=new MeshBuilder(),edge=[];
      for(let z=begin;z<end;z+=4){
        const next=Math.min(end,z+4);
        const points=zz=>{const outer=groundShoreline(zz,y+.18,side)+side*.5,inner=groundShoreline(zz,y-.18,side)-side*2.8;return [[inner,y+.3,zz],[outer,y+.3,zz]];};
        const [a,b0]=points(z),[d,c]=points(next);b.quad(a,d,c,b0,side<0);b.quad([a[0],y-1.5,z],[d[0],y-1.5,next],d,a,side>0);
        if((z-begin)%24===0)edge.push(a);
      }
      const berm=mesh(b.geometry(),m.darkConcrete,group);berm.name=`${side} bank concrete berm at ${y} m`;terraces++;
      if(y%48===0&&edge.length>1){
        for(const p of edge)member(group,m.rail,p,[p[0],p[1]+1.05,p[2]],.09,.09,'Berm guardrail post');
        cable(group,m.rail,edge.map(p=>[p[0],p[1]+1.05,p[2]]),.07).name='Continuous berm guardrail';
      }
      }
    }
    // Anchor heads and their bearing plates remain separate meshes.
    for(let y=76;y<418;y+=18)for(let z=-250;z<540;z+=38){
      const x=bankEnvelopeX(z,y,side)-side*.34;
      const plate=box(group,m.concrete,[.32,1.0,1.0],[x,y,z]);plate.name='Rock anchor bearing plate';
      // The head and inclined tendon are distinct geometry; the embedded end
      // inclines down into the rock rather than appearing as a surface decal.
      pipe(group,m.rail,[x-side*.7,y+.45,z],[x+side*1.1,y-.7,z+.12],.13,12,'Inclined rock anchor rod');
      box(group,m.rail,[.45,.25,.25],[x-side*.25,y,z]).name='Independent anchor head';anchors++;
      if(y>=202&&((y-76)/18)%3===1&&((z+250)/38)%3===1){
        const end=[bankEnvelopeX(z+7,y+6,side)-side*.85,y+6,z+7];
        member(group,m.rail,[x-side*.65,y,z],end,.13,.13,'Independent diagonal rock reinforcement tendon');inclinedTendons++;
      }
    }
    for(const spec of portalSpecs().filter(s=>s.side===side&&s.name==='Arched bank drainage gallery')){tunnelMouth(group,m,spec);galleries++;}
    // 近照上部裸岩的密集锚固阵列。每块承压板、斜杆、锚头保持独立，
    // 仅在露岩区布设，避免将同一锚头重复叠在已有混凝土墙体上。
    for(let y=246;y<=414;y+=8)for(let z=210;z<=510;z+=12){
      if(retainingWallSpecs().some(w=>w.side===side&&z>=w.z0&&z<=w.z1&&y>=w.bottom-1&&y<=w.top+1))continue;
      const x=groundShoreline(z,y,side)-side*.45;
      box(group,m.concrete,[.45,.95,.95],[x,y,z]).name='Independent exposed-rock anchor bearing plate';
      pipe(group,m.rail,[x-side*.58,y+.28,z],[x+side*1.3,y-1,z+.22],.10,12,'Independent inclined exposed-rock tendon');
      box(group,m.rail,[.3,.22,.22],[x-side*.34,y,z]).name='Independent exposed-rock anchor nut';anchors++;
    }
    // Narrow switchback inspection stairs, 0.25 m risers. Each tread is a separate
    // solid mesh; they follow the actual triangulated face instead of floating.
    for(let flight=0;flight<4;flight++){
      const y0=96+flight*24,z0=flight%2?286:246,z1=flight%2?246:286;
      const path=[];
      for(let i=0;i<=96;i++){
        const t=i/96,y=y0+t*24,z=z0+(z1-z0)*t;
        path.push([bankEnvelopeX(z,y,side)-side*1.05,y+.45,z]);
      }
      for(let i=0;i<96;i++){
        const a=path[i],b=path[i+1],dx=b[0]-a[0],dz=b[2]-a[2];
        box(group,m.concrete,[1.65,.26,Math.hypot(dx,dz)+.12],[(a[0]+b[0])/2,b[1]-.13,(a[2]+b[2])/2],Math.atan2(dx,dz)).name='Separate bank inspection stair tread';stairTreads++;
        if(i%8===0)member(group,m.rail,[a[0]-side*.9,a[1],a[2]],[a[0]-side*.9,a[1]+1.1,a[2]],.06,.06,'Inspection stair handrail post');
      }
      cable(group,m.rail,path.filter((_,i)=>i%4===0).map(p=>[p[0]-side*.9,p[1]+1.1,p[2]]),.055).name='Inspection stair handrail';
    }
    // Open U-shaped surface drains: three distinct strips, no painted black line.
    for(const z of [-180,170,480])for(const dz of [-.55,0,.55]){
      // 排水槽沿立面 Y/Z 参数化，不能用水平道路的 X/Z 转角框架。
      // 原算法在退台折返处抵消相邻三角法线，产生零法线。
      const strip=new MeshBuilder(),half=dz===0?.35:.11;
      const p=(y,d)=>[bankEnvelopeX(z+dz+d,y,side)-side*(dz===0?.3:.65),y,z+dz+d];
      for(let y=54;y<405;y+=2)strip.quad(p(y,-half),p(y,half),p(Math.min(y+2,405),half),p(Math.min(y+2,405),-half),side<0);
      mesh(strip.geometry(),dz===0?m.darkConcrete:m.concrete,group).name='Bank stepped surface drainage channel';
    }
    const road=[];
    for(let i=0;i<=280;i++){const t=i/280,z=80-570*Math.cos(t*Math.PI*3),y=343+t*170,x=groundShoreline(z,y,side);road.push([x,groundHeight(x,z)+.4,z]);}
    const roadMesh=ribbon(group,road,7,m.asphalt);roadMesh.name='Winding mountain access road';
    // Fill the downhill road edge down to the actual triangulated rock; a road
    // is a supported slab, not a paper ribbon hovering over the switchback.
    const support=new MeshBuilder(),stations=roadMesh.userData.edgeStations;
    for(let i=0;i<stations.length-1;i++)for(const edge of [0,1]){
      const a=stations[i][edge],b=stations[i+1][edge];
      const base=p=>[p[0],Math.min(p[1]-.35,groundHeight(p[0],p[2])-.2),p[2]];
      support.quad(base(a),base(b),b,a,edge===1);
    }
    mesh(support.geometry(),m.darkConcrete,group).name='Continuous switchback road retaining foundation';
    for(let i=0;i<road.length;i+=4){const p=road[i];box(group,m.concrete,[.8,.8,2.3],[p[0]-side*3.0,p[1]+.4,p[2]]).name='Road concrete barrier';}
  }
  group.userData={terraces,anchors,galleries,stairTreads,inclinedTendons,retaining: walls.userData,shoreRocks:shoreRocks.userData.rocks,...rock.geometry.userData};const tiles=spatialTiles(rock.geometry,rock.material,rock.name);group.remove(rock);group.add(tiles);instanceRepeatedDetails(group);return group;
}
