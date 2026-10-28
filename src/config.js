// Model metres, Y up; +Z downstream. Only height and crest arc length are scale anchors.
export const PARAMS = {
  dam: {
    height: 289, crestArcLength: 709,
    halfAngle: 1.05, // radians: approximate horizontal curvature, NOT a surveyed angle
    topThickness: 14, bottomThickness: 64,
    baseHalfWidth: 82, verticalLean: 100, verticalBow: 18,
    thicknessExponent: 1.45, spanExponent: 0.86,
    horizontalSegments: 360, verticalSegments: 144,
  },
  water: {
    upstream: 259, downstream: 24, // relative to model base, NOT sea level; mesh follows terrain triangulation
    // Visual approximation from water-detail-01.jpg; colours are sRGB inputs.
    appearance: {
      deepColor: '#0d6372', shallowColor: '#4b9180',
      downstreamColor: '#137b78', downstreamShallow: '#60a69a',
      horizonColor: '#8fc6ee', zenithColor: '#70acd3', bankColor: '#365b4b',
      roughness: 0.19, ior: 1.333, brightness: 1.0, skyIntensity: 1.25,
      waveSlope: 0.18, wavelengthScale: 1.1, speed: 0.6, absorptionDepth: 13,
      reflectionSize: 1536,
    },
  },
  terrain: {
    // 收紧地图外圈，保留坝址、河道、公园和沿岸完整山脊；精细区步长不变。
    halfExtent: 3900, upstreamExtent: 10000, downstreamExtent: 2200,
    nearStep: 4, farStep: 24, nearHalfWidth: 580, nearZMin: -850, nearZMax: 1050,
    benchRise: 24, benchFraction: 0.29,
  },
  // Photo-constrained placement, not surveyed dimensions. Geometry never changes with quality mode.
  details: {
    castingLift: 3.2, drainRows: [50,106,164,190,242], drainSpacing: 0.08,
    gantry: { span: 18, depth: 20, height: 25 },
    intakes: [{side:-1,z:-365,length:170},{side:1,z:-455,length:190}],
    platforms: [{x:-289,z:-190,y:286,width:95,length:135},{x:272,z:-310,y:285,width:85,length:135}],
    shafts: {side:-1,x:-342,z:-175,level:322,count:6,radius:5.3,height:10.5},
    towers: [{x:-590,z:330,height:66},{x:580,z:400,height:69},{x:-630,z:1040,height:63},{x:650,z:1120,height:67}],
  },
  outlets: {
    surface: { count: 6, spacing: 0.077, halfWidth: 0.024, bottom: 257, top: 282 },
    deep: { count: 7, spacing: 0.071, halfWidth: 0.014, bottom: 204, top: 219 },
    sealed: { count: 6, spacing: 0.083, halfWidth: 0.014, bottom: 61, top: 76 },
  },
  camera: { fov: 43, near: 1, far: 30000, filmSeconds: 26, clearance: 35 },
  quality: { low: {dpr: .8, shadow: 0}, medium: {dpr: 1, shadow: 1024}, high: {dpr: 1.5, shadow: 2048} },
};
export const PRESETS = {
  engineering: {title:'电站工程全景',subtitle:'双曲拱坝 · 两岸高边坡 · 上游进水口与林覆山脊',eye:[-95,825,1430],target:[0,230,-65]},
  unified: {title:'坝库一体总览',subtitle:'同一模型 · 大坝、峡谷、库区与滨水公园',eye:[1600,5500,4100],target:[400,259,-2400]},
  reservoir: {title:'上游湖湾',subtitle:'连通坝前的蓝绿湖面 · 梯田 · 远山与村落',eye:[135,363,-4100],target:[-110,339,-6400]},
  park: {title:'滨水公园',subtitle:'库区岸线的一部分 · 白色廊架与乔灌草',eye:[-70,317,-4430],target:[-280,268,-4680]},
  rockshore: {title:'库区岩岸',subtitle:'裸岩与植被入水 · 水面完整连续网格',eye:[-500,399,-5100],target:[-1400,419,-5660]},
  downstream: { title:'下游全景', subtitle:'双曲拱坝 · 曲折支护挡墙 · 蓝绿河谷', eye:[110,620,1120], target:[0,210,-55] },
  upstream: { title:'上游视角', subtitle:'绿水 · 红色门机 · 阶梯开挖边坡', eye:[-285,640,-855], target:[0,224,-35] },
  overhead: { title:'坝顶俯瞰', subtitle:'709 米弧线与上下游落差', eye:[60,1070,270], target:[0,165,-75] },
  side: { title:'侧面观察', subtitle:'竖向曲率与厚度渐变', eye:[570,555,430], target:[0,164,-85] },
  gantry: { title:'坝顶门机', subtitle:'独立钢架 · 敞口闸门井 · 迎水墩柱', eye:[-165,391,-430], target:[-20,279,-165] },
  bank: { title:'左侧层叠挡墙', subtitle:'弯折墙身 · 方形模板缝 · 圆形排水洞', eye:[65,365,890], target:[-165,160,455] },
  rightbank: { title:'右侧层叠挡墙', subtitle:'曲折马道 · 斜向锚固 · 岩滩交界', eye:[-75,380,940], target:[220,190,470] },
  shoreline: { title:'水岸接缝', subtitle:'保留湿区网格 · 墙脚与破碎岩滩', eye:[120,160,1040], target:[-30,48,730] },
  intake: { title:'进水口平台', subtitle:'进水栅栏 · 圆筒构筑物 · 操作平台', eye:[-80,450,-490], target:[-265,292,-260] },
  portal: { title:'排水隧洞', subtitle:'真实岩坡开口 · 拱形衬砌 · 独立锚索头', eye:[-40,228,215], target:[-198,154,115] },
  reference1: { title:'参考一 · 上游航拍', subtitle:'弧形坝顶与两岸进水设施', eye:[-285,640,-855], target:[0,224,-35] },
  reference2: { title:'参考二 · 坝顶近景', subtitle:'六井七墩 · 红色门机 · 弧形道路', eye:[175,510,-580], target:[0,254,-135] },
  reference3: { title:'参考三 · 高位斜俯视', subtitle:'两岸平台、开挖退台与下游水垫塘', eye:[-740,1250,-545], target:[0,230,-70] },
  reference4: { title:'参考四 · 下游俯视', subtitle:'完整拱线与上游库区 · 泄洪可单独开启', eye:[90,1030,470], target:[0,245,-180] },
  reference5: { title:'新增参考 · 峡谷全景', subtitle:'坝体与两岸多层支护结构', eye:[110,620,1120], target:[0,210,-55] },
  reference6: { title:'参考一 · 挡墙近景', subtitle:'曲线折返、退台、圆洞与墙脚岩滩', eye:[65,365,890], target:[-165,160,455] },
};
