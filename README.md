# 白鹤滩 · 坝库一体三维场景

HTML、CSS、JavaScript 与 Three.js 构建的互动场景。保留大坝、完整水岸、分层支护、库区公园、91 个活动模型、第一人称漫游与录制功能。照片用于外观参考，模型不是工程测绘数据。

## 公开网站

公开网站由 GitHub Pages 托管，`main` 分支更新后由 GitHub Actions 自动部署。每次发布的结果和日志可在下方部署记录中查看。

- 网站：https://handi888.github.io/baihetan-3d/
- 源码：https://github.com/Handi888/baihetan-3d
- 部署记录：https://github.com/Handi888/baihetan-3d/actions

公开站点是纯静态网站，不需要访问者安装软件，也不依赖开发者电脑开机。需要支持 ES Modules、Import Maps 和 WebGL 2 的现代浏览器；旧浏览器和低内存手机可能无法运行这个精细场景。

## 操作

- 电脑：拖动旋转、滚轮缩放；面板切换大坝、公园和库区视角。
- 手机 / 平板：单指旋转、双指缩放和平移；右上角“控制”打开面板。
- 第一人称：点选起点，确认光点后出发。电脑用方向键 / WASD 移动，鼠标转头，Shift 奔跑，Space 跳跃 / 上浮，Ctrl 下潜，Esc 退出。Shift＋左键暂时固定视角。
- 触屏漫游：屏幕方向键移动，拖动画面转头，右侧按钮跳跃、奔跑和下潜。
- H 切换净览；非漫游模式下 Space 暂停动画。截图和 WebM 录制下载到访问者本机，无音轨；录制支持程度取决于浏览器。

## 本地开发与一键更新

本地双击 `启动预览.cmd`，并保留服务窗口；或使用 Node.js 24 执行 `node server.mjs`。直接双击 HTML 只能显示本地启动指引。

本机已经完成 GitHub 登录。换电脑或登录过期时，双击 `登录GitHub.cmd`，在 GitHub 官方页面登录 Handi888 并完成授权；不需要向任何人发送密码或访问令牌。然后双击 `更新网站.cmd`。

以后直接修改本目录中的源码，再双击 `更新网站.cmd`。脚本检查动作、漫游、资源与发布文件清单，提交并推送 `main`；GitHub Actions 自动生成 `dist/` 并部署 GitHub Pages。脚本不会强制推送或覆盖远程历史，遇到冲突会停止并提示处理。

也可手动运行：

```sh
npm ci
node scripts/check-walking.mjs
node scripts/check-creatures.mjs
node scripts/build-site.mjs
node scripts/check-public.mjs
node scripts/publish.mjs
```

GitHub 仓库的 Settings → Pages 使用 **GitHub Actions** 作为部署来源。首次发布脚本自动配置；部署失败可查看 Actions 日志，修复后重新运行更新脚本。

## 文件与隐私

`src/` 是模型和交互源码，`assets/creature/runtime/` 是共享网格与贴图，`vendor/` 是离线 Three.js 依赖，`references/` 中只发布界面所需的五张照片。`dist/` 由构建生成，所有链接使用相对路径，支持 GitHub Pages 仓库子路径。

Git 使用允许清单：不上传本地历史备份、开发缓存、原始大模型 ZIP、QA 图片、完整工作目录、账号凭据或含本地来源路径的资产记录。发布照片去除 EXIF 等附加元数据，图像像素不重新编码。完整的原工程说明和改动前文件保存在本地 `archive/`，不进入公开仓库。

Three.js 与 OrbitControls 的 MIT 声明见 `vendor/THREE-LICENSE.txt`。模型和参考照片保留各自原有权利，公开浏览不等于授予再分发许可。

部署流程依据 [GitHub Pages 官方工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
