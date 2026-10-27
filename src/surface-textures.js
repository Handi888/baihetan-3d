import * as THREE from 'three';
// Offline, repeatable PBR rock maps. No photo is pasted onto the terrain.
let cache;
export function rockTextures(){
  if(cache)return cache;const size=512,albedo=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4);
  // 可平铺的分形噪声 + 非规则裂隙。色图和高度图共享同一个岩石场，
  // 避免旧版正弦波纹呈现布料状条带；不把参考照片直接贴在模型上。
  const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const wrap=(x,n)=>(x%n+n)%n;
  function noise(u,v,n){const x=u*n,y=v*n,i=Math.floor(x),j=Math.floor(y);let a=x-i,b=y-j;a=a*a*(3-2*a);b=b*b*(3-2*b);const h=(dx,dy)=>hash(wrap(i+dx,n),wrap(j+dy,n));return (h(0,0)*(1-a)+h(1,0)*a)*(1-b)+(h(0,1)*(1-a)+h(1,1)*a)*b;}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,warp=noise(u,v,4)-.5;
    const n=noise(u,v,8)*.45+noise(u,v,32)*.3+noise(u,v,128)*.16+noise(u,v,256)*.09;
    const sx=(u+warp*.035)*14,sy=(v+warp*.02)*14,ix=Math.floor(sx),iy=Math.floor(sy);
    let first=100,second=100,block=0;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
      const cx=ix+i,cy=iy+j,hh=hash(wrap(cx,14),wrap(cy,14));
      const dx=cx+.15+hh*.7-sx,dy=cy+.15+hash(wrap(cx,14)+31,wrap(cy,14))*.7-sy,d=dx*dx+dy*dy;
      if(d<first){second=first;first=d;block=hh;}else if(d<second)second=d;
    }
    const fracture=Math.exp(-(Math.sqrt(second)-Math.sqrt(first))*60);
    const strata=Math.pow(Math.max(0,Math.cos((v*6+u*2+warp*.45)*Math.PI*2)),28);
    const grain=hash(x+913,y)-.5,vein=fracture*.8+strata*.2;
    const h=Math.max(0,Math.min(1,.36+n*.35+(block-.5)*.18-vein*.18+grain*.035)),k=(y*size+x)*4;
    const tone=99+n*99+(block-.5)*32-vein*62+grain*15;
    albedo[k]=Math.max(0,Math.min(255,tone+7));albedo[k+1]=Math.max(0,Math.min(255,tone+2));albedo[k+2]=Math.max(0,Math.min(255,tone-5));albedo[k+3]=255;
    height[k]=height[k+1]=height[k+2]=h*255;height[k+3]=255;
  }
  function texture(data,color){const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t;}
  cache={color:texture(albedo,true),height:texture(height,false)};return cache;
}
