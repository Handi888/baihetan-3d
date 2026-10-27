import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const rootId=createHash('sha256').update(root).digest('hex').slice(0,16);
const previewURL=`http://127.0.0.1:${port}/index.html?view=downstream`;
const autoOpen=process.argv.includes('--open');
function openPreview(){
  // 仅打开本机预览地址，不安装软件、不修改浏览器设置。
  const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['url.dll,FileProtocolHandler',previewURL]:[previewURL];
  execFile(command,args,{windowsHide:true},error=>{if(error)console.log('请在浏览器中打开：'+previewURL);});
}
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.webm':'video/webm'};
const server=http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(pathname==='/__baihetan/health'){
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({app:'baihetan-local-preview',rootId}));return;
    }
    if(pathname==='/__baihetan/ready.js'){
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}).end('window.__BAIHETAN_PREVIEW_READY__ = true;');return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
    res.end(await readFile(file));
  } catch { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('文件不存在'); }
});
server.on('error',async error=>{
  if(error.code==='EADDRINUSE'){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/__baihetan/health`,{signal:AbortSignal.timeout(2000)}),info=await response.json();
      if(info.app==='baihetan-local-preview'&&info.rootId===rootId){console.log('预览已在运行：'+previewURL);if(autoOpen)openPreview();return;}
    }catch{}
    console.error(`端口 ${port} 被其他程序占用，无法启动本工程。`);
  }else console.error('预览启动失败：'+error.message);
  process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>{
  console.log('白鹤滩预览已启动：'+previewURL);
  console.log('浏览期间请保留此窗口；关闭窗口或按 Ctrl+C 将停止预览。');
  if(autoOpen)openPreview();
});
