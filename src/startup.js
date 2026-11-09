// 在几何构建批次之间归还主线程，让手机能绘制进度并处理浏览器事件。
// 不降低网格密度，不改变任何模型参数。
export async function yieldToBrowser(){
  if(globalThis.scheduler?.yield)await scheduler.yield();
  else await new Promise(resolve=>setTimeout(resolve,0));
}
export async function runCooperatively(iterator,onProgress=()=>{}){
  let start=performance.now();
  while(true){
    const next=iterator.next();if(next.done)return next.value;
    if(performance.now()-start>=12){onProgress(next.value);await yieldToBrowser();start=performance.now();}
  }
}
export async function loadingStage(label,task){
  const el=document.querySelector('#loading strong');if(el)el.textContent=label;
  document.querySelector('#scene').dataset.loadingStage=label;
  await yieldToBrowser();
  const start=performance.now(),result=await task();
  const canvas=document.querySelector('#scene');
  const timings=JSON.parse(canvas.dataset.startupTimings||'{}');timings[label]=Math.round(performance.now()-start);canvas.dataset.startupTimings=JSON.stringify(timings);
  return result;
}
