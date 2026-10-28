// 检查静态子路径下的模块、图片、模型及隐私；可以在 CI 中独立执行。
import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const base=new URL('https://example.github.io/baihetan-3d/');
let checked=0;const files=[];
async function walk(dir=''){for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){const name=path.posix.join(dir,entry.name);assert(!entry.isSymbolicLink(),'No symlinks');if(entry.isDirectory())await walk(name);else files.push(name);}}
await walk();
async function reference(ref,from='index.html'){
  if(/^(?:data:|#|https:\/\/)/.test(ref))return;
  assert(!/^(?:\/|file:|http:)/.test(ref),'Absolute local/root URL: '+from);
  const url=new URL(ref,new URL(from,base));assert(url.href.startsWith(base.href),'Reference escapes repository: '+from);
  const name=decodeURIComponent(url.pathname.slice(base.pathname.length));assert(files.includes(name),'Missing resource: '+name+' from '+from);checked++;
}
for(const name of files){
  assert(!/(?:^|\/)(?:node_modules|archive|docs|\.git|\.env)(?:\/|$)/.test(name),'Private directory included');
  if(/\.(js|html|css|md)$/.test(name)){
    const text=await readFile(path.join(root,name),'utf8');
    assert(!/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [\w ]*PRIVATE KEY-----|[A-Z]:[\\/]Users[\\/]|wxid_[a-z0-9]{8,}|xwechat_files[\\/])/.test(text),'Potential sensitive content: '+name);
    if(/\.(js|html|css)$/.test(name))assert(!/https?:\/\/(127\.0\.0\.1|localhost)/.test(text),'Published page depends on local service: '+name);
    if(name.endsWith('.js'))for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\()(['"])([^'"\n]+)\1/g))await reference(match[2]==='three'?'./vendor/three.module.js':match[2],match[2]==='three'?'index.html':name);
    if(name.endsWith('.html'))for(const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))await reference(match[1],name);
    if(name.endsWith('.css'))for(const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))await reference(match[1],name);
  }
  if(name.endsWith('.jpg')){const data=await readFile(path.join(root,name));assert(!data.includes(Buffer.from('Exif\0\0')),'EXIF remains: '+name);}
}
for(const f of ['creature.mesh','color.jpg','roughness.jpg','metallic.jpg'])await reference('assets/creature/runtime/'+f);
assert((await lstat(path.join(root,'assets/creature/runtime/creature.mesh'))).size>400000,'Model must be complete');
assert(!files.includes('assets/creature/runtime/model-info.json'),'Local source path must not be published');
console.log(JSON.stringify({passed:true,files:files.length,references:checked,basePath:base.pathname,privateFilesExcluded:true}));
