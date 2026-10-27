import * as THREE from 'three';
import {mesh,box} from './geometry.js';
import {member,pipe,railPath} from './detail-geometry.js';
import {PARAMS as P} from './config.js';
export function createGantry(parent,m,position,rotation=0,scale=1,dimensions={}){
  const g=new THREE.Group();g.name='Red portal hoist — independent steel members';g.position.set(...position);g.rotation.y=rotation;g.scale.setScalar(scale);parent.add(g);
  const {span,depth,height}={...P.details.gantry,...dimensions},s=span/2,d=depth/2,h=height;
  // Four tapered portal legs. Every flange, brace, truck and wheel stays editable.
  for(const x of [-s,s])for(const z of [-d,d]){
    member(g,m.red,[x,2,z],[x*.79,h-3,z*.68],1.35,1.6,'Gantry tapered leg');
    box(g,m.red,[4.8,1.6,2.5],[x,1.5,z]).name='Travel bogie';
    for(const dx of [-1.55,1.55]){const wheel=mesh(new THREE.CylinderGeometry(.75,.75,.42,24),m.gate,g);wheel.rotation.x=Math.PI/2;wheel.position.set(x+dx,.72,z);wheel.name='Independent flanged wheel';}
  }
  for(const z of [-d*.68,d*.68]){
    // Three separate meshes describe an I-shaped main girder.
    for(const y of [h-3,h])box(g,m.red,[span+7,.3,2.0],[0,y,z]).name='Main girder flange';
    box(g,m.red,[span+7,2.7,.25],[0,h-1.5,z]).name='Main girder web';
    for(const x of [-s-1,-s/2,0,s/2,s+1])box(g,m.red,[.15,2.7,1.8],[x,h-1.5,z]).name='Girder stiffener';
    member(g,m.red,[-s,5,z],[-s*.79,h-4,z],.25,.25,'Portal diagonal');
    member(g,m.red,[s,5,z],[s*.79,h-4,z],.25,.25,'Portal diagonal');
  }
  for(const x of [-s*.87,s*.87]){
    member(g,m.red,[x,7,-d*.85],[x,h-4,d*.72],.32,.32,'X cross brace');
    member(g,m.red,[x,7,d*.85],[x,h-4,-d*.72],.32,.32,'X cross brace');
    member(g,m.red,[x,13,-d*.85],[x,13,d*.85],.4,.45,'Leg tie');
  }
  box(g,m.red,[10,1,depth*.75],[-2,h+.8,0]).name='Hoist trolley';
  box(g,m.red,[9,5.6,7.5],[-3,h+4,0]).name='Hoist machinery cabin';
  box(g,m.red,[10,.4,8.5],[-3,h+7,0]);
  for(let x=-6.8;x<.8;x+=.7)box(g,m.gate,[.15,2.4,.08],[x,h+4,-3.79]).name='Machinery cabin ventilation louvre';
  for(const x of [-s,s])for(const z of [-d,d]){
    box(g,m.yellow,[4.5,.32,.06],[x,2.35,z+1.29]).name='Bogie safety stripe';
    for(const dx of [-.8,.8])for(const dy of [0,.8,1.6]){
      const bolt=mesh(new THREE.CylinderGeometry(.13,.13,.14,6),m.rail,g);
      bolt.rotation.x=Math.PI/2;bolt.position.set(x*.96+dx,3+dy,z*.96+Math.sign(z)*.8);bolt.name='Separate portal connection bolt';
    }
  }
  for(let x=-6;x<=0;x+=2)box(g,m.glass,[1.2,1.8,.12],[x,h+4.8,3.81]).name='Cabin window';
  box(g,m.glass,[.12,2.3,3],[-7.55,h+4,0]);
  const drum=mesh(new THREE.CylinderGeometry(1.2,1.2,4.8,32),m.gate,g);drum.rotation.z=Math.PI/2;drum.position.set(4,h+1.8,0);drum.name='Hoist rope drum';
  for(const x of [3.4,4.6])for(const z of [-1,1])pipe(g,m.cable,[x,h-2,z],[x,6,z],.07,8,'Hoisting wire rope');
  box(g,m.gate,[3,1.8,3],[4,5.5,0]).name='Hook pulley block';
  const hook=mesh(new THREE.TorusGeometry(.85,.18,12,32,Math.PI*1.6),m.rail,g);hook.position.set(4,3.9,0);hook.name='Lifting hook';
  // Access ladder and its cage, retained rung by rung.
  for(const z of [-.55,.55])member(g,m.red,[-s-1,2,z],[-s-1,h+1,z],.14,.14,'Ladder rail');
  for(let y=2;y<h+1;y+=.6)member(g,m.rail,[-s-1,y,-.55],[-s-1,y,.55],.09,.09,'Ladder rung');
  for(let y=5;y<h;y+=3){const ring=mesh(new THREE.TorusGeometry(.85,.05,6,24,Math.PI*1.5),m.red,g);ring.rotation.x=Math.PI/2;ring.position.set(-s-1.4,y,0);ring.name='Ladder safety cage hoop';}
  // Supported maintenance catwalks connect the access ladder to the machinery.
  // Decks, cantilever brackets and rails are distinct solids, never a merged proxy.
  for(const z of [-d,d]){
    box(g,m.gate,[span+7,.22,1.25],[0,h+.48,z]).name='Gantry maintenance catwalk deck';
    for(let x=-s-2;x<=s+2;x+=3.5){
      member(g,m.red,[x,h-2,z*.68],[x,h+.35,z],.16,.22,'Catwalk cantilever bracket');
      box(g,m.gate,[.12,.05,1.20],[x,h+.615,z]).name='Catwalk anti-slip transverse strip';
    }
  }
  for(const x of [-s-3,s+3])box(g,m.gate,[1.25,.22,depth],[x,h+.48,0]).name='Gantry transverse access deck';
  railPath(g,m.rail,[[-s-3,h+.6,-d],[-s-3,h+.6,d],[s+3,h+.6,d],[s+3,h+.6,-d]]);
  return g;
}
