import {spawn} from 'node:child_process';
import {githubCLI} from './gh-path.mjs';
// 凭据仅由 GitHub CLI 和系统凭据管理器保存，项目不接收密码或令牌。
const child=spawn(githubCLI(),['auth','login','--hostname','github.com','--git-protocol','https','--web','--scopes','workflow'],{stdio:'inherit'});
child.on('exit',code=>process.exitCode=code??1);
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
