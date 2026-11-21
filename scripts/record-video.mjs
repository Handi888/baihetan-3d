// 逐帧录制白鹤滩讲解视频：浏览器内确定性渲染（?cine=1），帧经 JPEG 管道交给 ffmpeg。
// 需要本机已安装 Chromium/Playwright 与 ffmpeg；不进入 CI。
// 用法：node scripts/record-video.mjs --out video.mp4 [--from 0 --to 30] [--stills 10,50,120]
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
// 每次录制自带一个本地静态服务（独立端口），录制结束即关闭。
const port=Number(process.env.PORT||4300+Math.floor(Math.random()*500)),base=`http://127.0.0.1:${port}`;
const root=new URL('..',import.meta.url).pathname;
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
process.on('exit',()=>server.kill());
for(let i=0;i<100;i++){try{if((await fetch(base+'/index.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
const out=arg('out','baihetan.mp4'),stills=arg('stills','');
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});page.setDefaultTimeout(900000);
page.on('pageerror',e=>console.error('PAGEERR',e.message));
await page.goto(`${base}/index.html?view=engineering&cine=1&qa=1`);
await page.waitForFunction(()=>window.__APP_READY__&&window.baihetanCine,null,{timeout:900000});
await page.evaluate(()=>{window.baihetan.setQuality('high');window.baihetanCine.prepare();});
const {duration,FPS}=await page.evaluate(()=>({duration:window.baihetanCine.duration,FPS:window.baihetanCine.FPS}));
const frameOf=async t=>Buffer.from((await page.evaluate(t=>window.baihetanCine.frame(t,.92),t)).split(',')[1],'base64');
if(stills){
  for(const t of stills.split(',').map(Number)){await page.evaluate(t=>window.baihetanCine.seek(t),t);await writeFile(`${out}-${t}.jpg`,await frameOf(t));console.log('still',t);}
}else{
  const from=Number(arg('from',0)),to=Math.min(duration,Number(arg('to',duration)));
  const first=Math.round(from*FPS),last=Math.round(to*FPS);
  if(first>0)await page.evaluate(t=>window.baihetanCine.seek(t),(first-1)/FPS);
  const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
  const started=Date.now();
  for(let i=first;i<last;i++){
    const buf=await frameOf(i/FPS);
    if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
    if(i%25===0)console.log(`frame ${i}/${last} t=${(i/FPS).toFixed(1)}s  ${((Date.now()-started)/(i-first+1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log('wrote',out);
}
await browser.close();server.kill();
