# 白鹤滩 · 坝库一体三维场景

HTML、CSS、JavaScript 与 Three.js 构建的互动场景。大坝、完整水岸、分层支护、库区公园、两岸地下厂房、91 个活动模型与第一人称漫游共用一个场景。外观依据照片和视频画面调整；地下设备用于发电原理讲解，模型不是工程测绘数据或 BIM。

## 公开网站

公开网站由 GitHub Pages 托管，`main` 分支更新后由 GitHub Actions 自动部署。每次发布的结果和日志可在下方部署记录中查看。

- [公开网站](https://handi888.github.io/baihetan-3d/)
- [GitHub 源码](https://github.com/Handi888/baihetan-3d)
- [部署记录](https://github.com/Handi888/baihetan-3d/actions)

公开站点是纯静态网站，不需要访问者安装软件，也不依赖开发者电脑开机。需要支持 ES Modules、Import Maps 和 WebGL 2 的现代浏览器；旧浏览器和低内存手机可能无法运行这个精细场景。

## 操作

- 电脑：拖动旋转、滚轮缩放；面板保留电站全景、上游水库、滨水公园、坝顶俯瞰四个主要视角。
- 手机 / 平板：单指旋转、双指缩放和平移；右上角“控制”打开面板。
- 点击“进入电站内部”，在整体透视、厂房和机组剖视间切换。选择两岸厂房及机组，可查看共 16 台机组的位置；剖视中可调导叶、观察水流与电能方向、分解设备、暂停演示。
- “泄洪”控制渐进启闭。水柱沿重力轨迹落入下游，落水后飞溅和水雾逐渐增强；关闭后已经流出的水继续下落，水雾延迟消散。这是视觉演示，不是 CFD 或工程水力计算。
- 第一人称：点选起点，确认光点后出发。电脑用方向键 / WASD 移动，鼠标转头，Shift 奔跑，Space 跳跃 / 上浮，Ctrl 下潜，Esc 退出。Shift＋左键暂时固定视角。
- 触屏漫游：屏幕方向键移动，拖动画面转头，右侧按钮跳跃、奔跑和下潜。
- H 切换净览；非漫游模式下 Space 暂停动画。“截图”保存当前三维画面到访问者本机。

## 模型范围与参考

地图外圈从 12,400 × 16,800 米收紧为 7,800 × 12,200 米，保留河道、公园与沿岸山脊。坝址及公园的精细采样步长不变，分层挡墙继续保留独立构件；乔灌草和零散野花集中布置在可游览的岸坡与林缘。水面保留完整索引网格，由地形深度遮挡形成岸线，不通过删除岸边三角形形成轮廓。

地下厂房、引水管道、机组和尾水系统使用同一套场景坐标，详细机组嵌在所选厂房内。转轮、主轴、转子同轴运动，定子保持静止；水路与电路分开。洞室位置、尺寸、槽极数、叶片细节和演示速度含教学近似，不能用于设备设计或运行判断。

- [参考视频《白鹤滩工程简介》](https://www.bilibili.com/video/BV1Xz4y1m7Zn/)：本轮对照其官方预览提供的 153 张关键帧，检查坝肩、进水建筑、厂房及地下水路画面；这不等同于逐秒观看完整视频或核验全部音轨。
- [《金沙江白鹤滩水电站工程》](https://www.engineering.org.cn/engi/CN/1159990400712761986)：用于核对两岸各八台机组及地下工程系统的基本关系。

## 本地开发与一键更新

本地双击 `启动预览.cmd`，并保留服务窗口；或使用 Node.js 24 执行 `node server.mjs`。直接双击 HTML 只能显示本地启动指引。

本机已经完成 GitHub 登录。换电脑或登录过期时，双击 `登录GitHub.cmd`，在 GitHub 官方页面登录 Handi888 并完成授权；不需要向任何人发送密码或访问令牌。然后双击 `更新网站.cmd`。

以后直接修改本目录中的源码，再双击 `更新网站.cmd`。脚本检查动作、漫游、机组与泄洪逻辑、资源及发布文件清单，提交并推送 `main`；GitHub Actions 自动生成 `dist/` 并部署 GitHub Pages。脚本不会强制推送或覆盖远程历史，遇到冲突会停止并提示处理。推送不等于部署完成，应以对应提交的 Actions 结果和线上检查为准。

也可手动运行：

```sh
npm ci
node scripts/check-walking.mjs
node scripts/check-creatures.mjs
node scripts/check-powerhouse.mjs
node scripts/check-unified.mjs
node scripts/build-site.mjs
node scripts/check-public.mjs
node scripts/publish.mjs
```

GitHub 仓库的 Settings → Pages 使用 **GitHub Actions** 作为部署来源。首次发布脚本自动配置；部署失败可查看 Actions 日志，修复后重新运行更新脚本。

## 文件与隐私

`src/` 是模型和交互源码，`assets/creature/runtime/` 是共享网格与贴图，`vendor/` 是离线 Three.js 依赖。照片面板移除后，构建不再将五张参考照片复制到 `dist/`；本地 `references/` 中的源文件仍保留供核对。`dist/` 由构建生成，所有运行资源使用相对路径，支持 GitHub Pages 仓库子路径。

Git 使用允许清单：不上传本地历史备份、开发缓存、原始大模型 ZIP、视频分析素材、QA 图片、完整工作目录、账号凭据或含本地来源路径的资产记录。完整的原工程说明和改动前文件保存在本地 `archive/`，不进入公开仓库。

Three.js 与 OrbitControls 的 MIT 声明见 `vendor/THREE-LICENSE.txt`。模型和参考照片保留各自原有权利，公开浏览不等于授予再分发许可。

部署流程依据 [GitHub Pages 官方工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

Created by 段茜媛 · 蒋寒狄 · 刘子涵 · 罗惟伊 · 彭钰绚 · 王晨熙 · 王金涛 · 温子萱
