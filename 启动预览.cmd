@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo 白鹤滩三维场景 - 一键启动
set "BHT_NODE="
where node >nul 2>nul
if not errorlevel 1 set "BHT_NODE=node"
if not defined BHT_NODE set "BHT_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if "%BHT_NODE%"=="node" goto run
if exist "%BHT_NODE%" goto run
echo 未找到 Node.js。请安装 Node.js 18 或更高版本，再双击此文件。
pause
exit /b 1
:run
"%BHT_NODE%" server.mjs --open
if errorlevel 1 pause
