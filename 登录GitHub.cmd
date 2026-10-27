@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "BHT_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "BHT_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%BHT_NODE%" scripts/github-login.mjs
pause
