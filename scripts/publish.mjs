// 首次创建公开仓库；以后从当前工程提交并推送 main，触发 Pages 自动部署。
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {githubCLI} from './gh-path.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo='Handi888/baihetan-3d',remote='https://github.com/'+repo+'.git';
function execute(command,args,options={}){
  // 仅重试 GitHub 的只读请求；创建仓库、提交和发布操作不盲目重复。
  const readOnly=/(?:^|[\\/])gh(?:\.exe)?$/.test(command)&&((args[0]==='auth'&&args[1]==='status')||(args[0]==='api'&&!args.includes('--method')&&!args.includes('-X')));
  for(let attempt=0;attempt<3;attempt++){
    const result=spawnSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true,...options});
    if(attempt<2&&readOnly&&result.status!==0&&/\bEOF\b|connection reset|timed out|TLS handshake timeout|HTTP 50[234]/i.test(result.stderr||'')){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1500);continue;}
    return result;
  }
}
function run(command,args,options={}){
  const result=execute(command,args,options);
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error((result.stderr||result.stdout||command+' failed').trim());
  return result.stdout.trim();
}
try{
  for(const script of ['check-walking.mjs','check-creatures.mjs','check-powerhouse.mjs','build-site.mjs','check-public.mjs'])console.log(run(process.execPath,['scripts/'+script]));
  if(!existsSync(path.join(root,'.git')))run('git',['init','-b','main']);
  if(run('git',['branch','--show-current'])!=='main')throw new Error('请先切回 main 分支，再发布。');
  run('git',['add','--all']);
  // .gitignore 是允许清单，再检查实际跟踪内容，防止以后误加私人文件。
  const files=run('git',['ls-files','-z']).split('\0').filter(Boolean);
  const allowed=/^(?:index\.html|style\.css|README\.md|package(?:-lock)?\.json|server\.mjs|(?:启动预览|更新网站|登录GitHub)\.cmd|白鹤滩-(?:坝库一体场景|高精度场景)\.html|\.gitignore|\.gitattributes|\.github\/workflows\/pages\.yml|src\/[\w/-]+\.js|vendor\/(?:three\.module\.js|OrbitControls\.js|README\.md|THREE-LICENSE\.txt)|assets\/creature\/runtime\/(?:creature\.mesh|color\.jpg|roughness\.jpg|metallic\.jpg)|references\/(?:bank-detail-20261015|canyon-20261015|park|rock-bank|panorama)\.jpg|reservoir-landscape\/index\.html|scripts\/(?:build-site|build-entry|check-public|check-creatures|check-walking|check-powerhouse|check-unified|publish|github-login|gh-path)\.mjs)$/;
  for(const file of files){
    if(!allowed.test(file))throw new Error('阻止上传未列入允许清单的文件：'+file);
    if(/\.(?:js|mjs|html|css|md|json|yml|cmd)$/.test(file)){
      const text=readFileSync(path.join(root,file),'utf8');
      if(/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [\w ]*PRIVATE KEY-----|[A-Z]:[\\/]Users[\\/]|wxid_[a-z0-9]{8,}|xwechat_files[\\/])/.test(text))throw new Error('疑似敏感信息，停止发布：'+file);
    }
  }
  const gh=githubCLI();
  try{run(gh,['auth','status','--hostname','github.com']);}catch(error){throw new Error('GitHub 授权检查未通过：'+error.message+'\n如果尚未登录，请双击“登录GitHub.cmd”完成官方网页登录后重试。');}
  const login=JSON.parse(run(gh,['api','user']));
  if(login.login.toLowerCase()!=='handi888')throw new Error('当前 GitHub 登录账号不是 Handi888，请切换账号后继续。');
  const currentRemote=spawnSync('git',['remote','get-url','origin'],{cwd:root,encoding:'utf8'});
  if(currentRemote.status===0&&currentRemote.stdout.trim()!==remote)throw new Error('已有不同 origin，保留现有仓库配置并停止。');
  const repository=execute(gh,['api','repos/'+repo]);
  if(repository.status!==0){
    if(!repository.stderr.includes('404'))throw new Error(repository.stderr);
    console.log(run(gh,['repo','create',repo,'--public','--description','Interactive Baihetan dam and reservoir landscape in Three.js']));
  }else if(JSON.parse(repository.stdout).private)throw new Error('同名仓库已存在且为私有；不自动改变它的可见性。');
  if(currentRemote.status!==0)run('git',['remote','add','origin',remote]);
  // 仅本仓库使用 GitHub 的 noreply 邮箱，不写入用户私人邮箱。
  run('git',['config','user.name',login.login]);run('git',['config','user.email',login.id+'+'+login.login+'@users.noreply.github.com']);
  if(spawnSync('git',['diff','--cached','--quiet'],{cwd:root}).status!==0)console.log(run('git',['commit','-m','Update Baihetan interactive website']));
  // 仅这一次 Git 调用使用已登录的 gh 凭据助手，不更改系统 Git 配置。
  const helper='!"'+gh.replaceAll('\\','/')+'" auth git-credential';
  console.log(run('git',['-c','credential.helper=','-c','credential.helper='+helper,'push','--set-upstream','origin','main']));
  const pages=execute(gh,['api','repos/'+repo+'/pages']);
  let pagesChanged=false;
  if(pages.status!==0){
    if(!pages.stderr.includes('404'))throw new Error(pages.stderr);
    run(gh,['api','--method','POST','repos/'+repo+'/pages','--input','-'],{input:JSON.stringify({build_type:'workflow'})});
    pagesChanged=true;
  }else if(JSON.parse(pages.stdout).build_type!=='workflow'){
    run(gh,['api','--method','PUT','repos/'+repo+'/pages','--input','-'],{input:JSON.stringify({build_type:'workflow'})});pagesChanged=true;
  }
  // 首次 push 可能先于 Pages 设置触发工作流；设置完成后显式启动一次。
  if(pagesChanged){
    for(let attempt=0;attempt<3;attempt++){
      try{run(gh,['workflow','run','pages.yml','--repo',repo,'--ref','main']);break;}
      catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,2000));}
    }
  }
  console.log('已推送；GitHub Actions 完成后发布到 https://handi888.github.io/baihetan-3d/');
  console.log('部署进度：https://github.com/'+repo+'/actions');
}catch(error){console.error(error.message);process.exitCode=1;}
