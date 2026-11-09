// 只复制上线所需文件；不会把整个工作目录上传到网站。
import {readdir,readFile,writeFile,mkdir,copyFile,lstat,rm,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build,transform} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.resolve(root,'dist'),marker=path.join(dist,'.baihetan-generated');
if(path.dirname(dist)!==root||path.basename(dist)!=='dist')throw new Error('Unsafe output directory');
try{
  const info=await lstat(dist);if(info.isSymbolicLink())throw new Error('Output directory cannot be a symlink');
  await access(marker);console.log('Rebuild generated directory: '+dist);await rm(dist,{recursive:true});
}catch(error){if(error.code!=='ENOENT')throw error;else if(await lstat(dist).catch(()=>null))throw new Error('dist exists without build marker; preserve it and choose another directory');}
await mkdir(dist,{recursive:true});await writeFile(marker,'Generated only by scripts/build-site.mjs\n');
const files=['index.html','style.css','README.md','reservoir-landscape/index.html',
  'vendor/three.module.js','vendor/THREE-LICENSE.txt',
  ...['creature.mesh','color.jpg','roughness.jpg','metallic.jpg'].map(f=>'assets/creature/runtime/'+f)];
// 先检查源码目录，仍拒绝把链接指向的工作区外文件带入发布包。
async function checkSources(relative){for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
  const file=relative+'/'+entry.name;if(entry.isSymbolicLink())throw new Error('Symlink not allowed: '+file);
  if(entry.isDirectory())await checkSources(file);
}}
await checkSources('src');
if((await lstat(path.join(root,'vendor/OrbitControls.js'))).isSymbolicLink())throw new Error('Symlink: OrbitControls');
for(const file of files){const source=path.join(root,file);if((await lstat(source)).isSymbolicLink())throw new Error('Symlink: '+file);const target=path.join(dist,file);await mkdir(path.dirname(target),{recursive:true});
  // 源码保留全部注释，只有发布副本压缩。资源路径和模块目录不变，适配 Pages 子路径。
  if(/\.(?:js|css)$/.test(file)){const result=await transform(await readFile(source,'utf8'),{loader:file.endsWith('.css')?'css':'js',minify:true,target:'es2020',legalComments:'inline'});await writeFile(target,result.code);}
  else await copyFile(source,target);
}
// 发布版将场景模块与 OrbitControls 合为一个入口，避免多层 import 请求瀑布。
// Three.js 仍独立缓存且全站只有一个实例；动态 import 保持异步语义，机组仍按需构建。
// 本地 src/ 源码、注释和开发入口保持原样，不输出含本地路径的 source map / metafile。
await build({absWorkingDir:root,entryPoints:['src/main.js'],outfile:path.join(dist,'src/main.js'),
  bundle:true,format:'esm',platform:'browser',external:['three'],minify:true,target:'es2020',legalComments:'inline'});
files.push('src/main.js');
const entry=path.join(dist,'index.html');
await writeFile(entry,(await readFile(entry,'utf8')).replace('</head>',
  '  <link rel="modulepreload" href="./vendor/three.module.js">\n'+
  '  <link rel="modulepreload" href="./src/main.js">\n</head>'));
// 在线兼容入口永远相对于网站目录跳转，不请求访问者的 localhost。
const alias='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>白鹤滩三维场景</title><a href="./index.html">进入场景</a><script>location.replace("./index.html"+location.search+location.hash);</script></html>';
for(const name of ['白鹤滩-坝库一体场景.html','白鹤滩-高精度场景.html']){await writeFile(path.join(dist,name),alias);files.push(name);}
await writeFile(path.join(dist,'.nojekyll'),'');files.push('.nojekyll');
const bytes=(await Promise.all(files.map(f=>lstat(path.join(dist,f))))).reduce((sum,s)=>sum+s.size,0);
console.log(JSON.stringify({directory:'dist',files:files.length,MiB:Number((bytes/1048576).toFixed(2))}));
