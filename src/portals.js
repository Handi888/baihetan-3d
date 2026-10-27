/** Visible tunnel mouths, in model metres. The same profiles drive the rock cut
 * and the independent concrete lining, so the rock cannot seal the opening.
 * Underground alignment is deliberately limited to a short blind gallery.
 */
import {groundShoreline} from './ground-surface.js';
import {retainingPortalSpecs,bankEnvelopeX} from './bank-surface.js';

export function portalSpecs(){
  const specs=[];
  for(const side of [-1,1]){
    for(const [y,z] of [[92,290],[150,115],[210,365],[270,-110],[330,180],[390,-285]]){
      specs.push({side,position:[bankEnvelopeX(z,y+3.8,side)-side*1.8,y,z],rotation:-side*Math.PI/2,width:5.4,height:7.6,depth:24,name:'Arched bank drainage gallery'});
    }
    specs.push({side,position:[bankEnvelopeX(710,42,side)-side*3,34,710],rotation:-side*Math.PI/2,width:13,height:16,depth:32,name:'Bank diversion-tunnel outlet'});
  }
  return [...specs,...retainingPortalSpecs()];
}

// Counter-clockwise convex arch in the world Z/Y projection.
export function portalProfile(spec){
  const [,y,z]=spec.position,r=spec.width/2,spring=spec.height-r;
  if(spec.shape==='circle')return Array.from({length:48},(_,i)=>{const a=i*Math.PI/24;return [z+r*Math.cos(a),y+r+r*Math.sin(a)];});
  const profile=[[z-r,y+.08],[z+r,y+.08],[z+r,y+spring]];
  for(let i=1;i<=24;i++){const a=Math.PI*i/24;profile.push([z+r*Math.cos(a),y+spring+r*Math.sin(a)]);}
  return profile;
}

function halfPlane(poly,a,b,inside){
  const output=[],field=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[2]-a[0]);
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],fp=field(p),fq=field(q),pin=inside?fp>=0:fp<=0,qin=inside?fq>=0:fq<=0;
    if(pin)output.push(p);
    if(pin!==qin){const t=fp/(fp-fq);output.push(p.map((v,k)=>v+(q[k]-v)*t));}
  }
  return output;
}

/** Subtract a convex opening without dropping whole intersecting rock faces.
 * Each emitted polygon lies outside one profile edge. The remainder progresses
 * into the opening and is discarded only after all profile edges have clipped it.
 */
export function subtractPortal(triangle,profile){
  const outside=[];let remainder=triangle;
  for(let i=0;i<profile.length&&remainder.length>=3;i++){
    const a=profile[i],b=profile[(i+1)%profile.length];
    const piece=halfPlane(remainder,a,b,false);
    if(piece.length>=3)outside.push(piece);
    remainder=halfPlane(remainder,a,b,true);
  }
  return outside;
}
