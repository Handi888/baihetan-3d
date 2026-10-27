import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
export function githubCLI(){
  if(spawnSync('gh',['--version'],{stdio:'ignore',windowsHide:true}).status===0)return 'gh';
  const portable=path.join(process.env.LOCALAPPDATA||'','BaihetanTools','gh-2.103.3','bin','gh.exe');
  if(process.platform==='win32'&&existsSync(portable))return portable;
  throw new Error('请先安装官方 GitHub CLI：https://cli.github.com/');
}
