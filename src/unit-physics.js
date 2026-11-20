// 白鹤滩单台机组的教学运行模型。只用公开参数与基本物理关系：
//   水能功率 P = ρ·g·Q·H·η，同步转速 n = 60·f / p（p 为极对数）。
// 效率曲线、水头损失和流量-开度关系为平滑近似，用于讲解趋势，不用于运行调度。
export const UNIT_SPEC={
  ratedPowerMW:1000,          // 单机额定容量 100 万 kW（16 台，总装机 1600 万 kW）
  ratedSpeed:111.1,           // 额定转速 r/min
  frequency:50,               // 电网频率 Hz
  poles:54,                   // 磁极数 = 2 × 60f/n = 54（27 对极）
  voltageKV:24,               // 发电机额定电压，水电行业最高电压等级
  powerFactor:.9,             // 额定功率因数（教学取值）
  ratedHead:202,              // 额定水头 m
  ratedFlow:545,              // 额定工况单机流量约 545 m³/s（由 P=ρgQHη 反算，近似）
  runnerDiameter:{left:8.62,right:8.9}, // 左岸东方电气 8.62 m；右岸哈电长短叶片转轮约 8.9 m
  turbinePeakEfficiency:.967, // 水轮机最优效率 96.7%
  generatorEfficiency:.99,    // 发电机额定效率 > 99%
  transformerEfficiency:.997, // 主变压器效率（典型值）
  stepUpKV:500,               // 主变升压至 500 kV
  dcKV:800,                   // 经 ±800 kV 特高压直流送往江苏、浙江
  units:16, annualTWh:62.443, // 多年平均年发电量 624.43 亿 kW·h
};
export const LEVELS={normal:825,dead:765,floodLimit:785,crest:834,foundation:545,tailwater:590};
const RHO=1000,G=9.81;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// 无负荷开度：低于此开度时水流只够克服摩擦与通风损失，机组不能带负荷。
export const NO_LOAD_OPENING=.08;
const FULL_FLOW=600; // 额定水头下导叶全开流量（m³/s），使额定水头下约 1000 MW

/** 由上游水位、尾水位和导叶开度求运行点。返回值均为 SI 或工程常用单位。 */
export function operatingPoint({upstream=LEVELS.normal,tailwater=LEVELS.tailwater,gate=.72}={}){
  gate=clamp(gate,0,1);
  const gross=Math.max(0,upstream-tailwater);
  // 流量近似随开度线性、随水头平方根变化；引水系统损失与 Q² 成正比（满流约 4%）。
  let flow=FULL_FLOW*gate*Math.sqrt(Math.max(gross,1)/(LEVELS.normal-LEVELS.tailwater));
  const loss=.038*gross*(flow/FULL_FLOW)**2;
  const net=Math.max(0,gross-loss);
  flow=FULL_FLOW*gate*Math.sqrt(Math.max(net,1)/UNIT_SPEC.ratedHead)*.97;
  // 效率曲线：最优点在约 80% 开度，偏离越远越低；无负荷开度以下有效出力为 0。
  const shape=1-((gate-.8)/.82)**2;
  const turbineEff=gate<=NO_LOAD_OPENING?0:clamp(UNIT_SPEC.turbinePeakEfficiency*shape,0,UNIT_SPEC.turbinePeakEfficiency)*clamp((gate-NO_LOAD_OPENING)/.12,0,1);
  const hydraulicMW=RHO*G*flow*gross/1e6;        // 以毛水头计的水流功率
  const netHydraulicMW=RHO*G*flow*net/1e6;       // 到达水轮机的水流功率
  const turbineMW=netHydraulicMW*turbineEff;
  const generatorMW=turbineMW*UNIT_SPEC.generatorEfficiency;
  const gridMW=generatorMW*UNIT_SPEC.transformerEfficiency;
  const currentKA=generatorMW*1e6/(Math.sqrt(3)*UNIT_SPEC.voltageKV*1e3*UNIT_SPEC.powerFactor)/1e3;
  const torqueMNm=turbineMW*1e6/(UNIT_SPEC.ratedSpeed*2*Math.PI/60)/1e6;
  // 每立方米水可发电量 kWh/m³。
  const kwhPerM3=flow>0?gridMW*1e3/(flow*3600):0;
  const state=gate<=.005?'stopped':gate<=NO_LOAD_OPENING?'no-load':generatorMW>UNIT_SPEC.ratedPowerMW*1.005?'over':'online';
  return {gate,upstream,tailwater,gross,loss,net,flow,turbineEff,hydraulicMW,netHydraulicMW,turbineMW,generatorMW,gridMW,currentKA,torqueMNm,kwhPerM3,state,
    speed:state==='stopped'?0:UNIT_SPEC.ratedSpeed,frequency:state==='stopped'?0:UNIT_SPEC.frequency};
}
/** 同步电机：f = p·n / 60，p 为极对数。 */
export function synchronousFrequency(poles=UNIT_SPEC.poles,rpm=UNIT_SPEC.ratedSpeed){return poles/2*rpm/60;}

/** 转速随时间的过渡：并网后转速被电网频率“锁定”；停机时依靠转动惯量缓慢下降。 */
export function createSpeedGovernor(){
  let speed=UNIT_SPEC.ratedSpeed;
  return {
    get speed(){return speed;},
    reset(value=UNIT_SPEC.ratedSpeed){speed=value;},
    // 机组惯性时间常数取约 9 s（教学取值）。
    update(dt,gate){const target=gate>.005?UNIT_SPEC.ratedSpeed:0;speed+=(target-speed)*(1-Math.exp(-dt/(target>speed?6:9)));if(Math.abs(target-speed)<.5)speed=target;return speed;},
  };
}
