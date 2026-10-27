/** 两岸支护的照片比例布局。仅定义尺寸与折线，不依赖 Three.js 或地形缓存。
 * 挡墙、岩坡和水面共同使用这些站点，禁止在画质切换时删减分层或折点。
 */
const left=[[-900,0],[-800,5],[-740,20],[-670,-8],[-590,14],[-500,0],[-180,0],[0,0],
  [40,0],[120,-10],[200,14],[280,-18],[350,-25],[414,12],[474,4],[536,-28],[590,10],[660,18],[732,-18],[800,-23],[888,8],[980,0],[1060,0]];
const right=[[-900,0],[-800,-8],[-726,13],[-646,-15],[-570,8],[-500,0],[-180,0],[0,0],
  [40,0],[116,8],[184,-18],[260,15],[340,-6],[408,-22],[468,12],[526,20],[588,-12],[660,-26],[740,8],[820,-9],[920,10],[1020,0],[1060,0]];
const interpolate=(list,z)=>{
  if(z<=list[0][0]||z>=list.at(-1)[0])return 0;
  const i=list.findIndex(p=>p[0]>=z),a=list[i-1],b=list[i];
  return a[1]+(b[1]-a[1])*(z-a[0])/(b[0]-a[0]);
};
export function bankContourOffset(z,side){
  const points=side<0?left:right;
  // 8 m corner shoulders retain the plan's bends without sharp mathematical cusps.
  return (interpolate(points,z-4)+2*interpolate(points,z)+interpolate(points,z+4))/4;
}
let cached;
export function retainingWallSpecs(){
  if(cached)return cached;
  cached=[];
  for(const side of [-1,1]){
    for(let i=0;i<15;i++){
      const top=48+i*24;
      // 保留 15 层及所有平面转折。下部厚墙、上部较矮挡墙与裸岩交替，
      // 对应近照的“下部层叠混凝土 / 上部锚固岩坡”，而非满铺混凝土。
      const heights=side<0?[42,20,18,20,16,17,14,11,10,9,8,7,7,6,6]:[42,18,21,16,19,15,12,13,10,9,9,8,7,7,6];
      cached.push({id:`${side}-down-${i}`,side,layer:i,zone:'downstream',
        bottom:top-heights[i],top,z0:40+Math.max(0,i-8)*12,
        z1:1000-i*32+(side>0?-16:0),thickness:2.1,projection:1.45});
    }
    for(let i=0;i<5;i++){
      const top=288+i*24;
      cached.push({id:`${side}-up-${i}`,side,layer:i,zone:'upstream',
        bottom:i===0?246:top-(17-i),top,z0:-800+i*8,z1:-560-i*8,
        thickness:2.2,projection:1.45});
    }
  }
  return cached;
}
export function bankMandatoryStations(){
  return [...new Set([...left,...right].flatMap(p=>[p[0]-4,p[0],p[0]+4])
    .concat(retainingWallSpecs().flatMap(w=>[w.z0,w.z1])))];
}
