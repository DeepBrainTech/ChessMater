# ChessMater

棋类重力解谜游戏，使用 React + Vite + Canvas，后端使用 Express + PostgreSQL。源码使用 UTF-8。

## 开发与构建

```bash
npm install
npm run dev
```

开发服务器同时提供游戏 `/` 和关卡编辑器 `/editor.html`。本地开发使用测试用户 `dev_user`。

```bash
npm run build
npm start
```

Vite 同时构建两个 HTML 入口到 `dist/`。根目录的 `server.js` 托管构建结果，默认端口为 8080。

API 服务位于 `backend/`，本地默认端口为 3000：

```bash
npm --prefix backend install
npm --prefix backend start
```

API 服务需要数据库和 Portal JWT 环境变量，具体读取位置见 `backend/db.js`、`backend/server.js` 和 `backend/portal-grants.js`。

## 文件职责

- `src/components/`：React 页面布局、HUD 和弹窗。
- `src/styles/`：按界面区域拆分的 CSS；`app.css` 是样式入口。
- `src/page/`：开始流程、选关、排行榜、音乐和横屏提醒。
- `src/boot/`：登录初始化及 Portal 语言参数。
- `src/services/session.js`：登录状态与 API 配置。
- `src/services/portalCommerce.js`：Portal 兑换、库存与重试处理。
- `src/game/levels.js`：关卡数据，导出 `levels` 数组。
- `src/game/assets.js`：贴图、音频与图标地址。
- `src/game/initialize.js`：游戏启动与资源回收。
- `src/game/runtime.js`：当前棋盘的显式运行状态。
- `src/game/uiBridge.js`：引擎向 React 发送 UI 更新事件。
- `src/game/engine/`：玩法与 Canvas 引擎模块。
- `src/editor/`：编辑器入口、编辑操作、导入和导出。
- `editor.html`：编辑器 HTML 入口，和主游戏一起构建。
- `public/assets/`：图片、音频和字体等静态资源。
- `backend/routes/`：认证、进度、积分、关卡和排行榜接口。
- `backend/server.js`：API 服务配置、认证辅助函数、数据库初始化及路由注册。

## 修改游戏

界面和样式从 `src/components/`、`src/styles/` 修改。React 负责 HUD 文字和数字；引擎通过 `uiBridge` 发送变化，主游戏不再由引擎重复修改这些显示内容。Canvas 绘制和编辑器保留直接操作 DOM 的方式，部分弹窗交互也仍通过明确的元素引用实现。

引擎按职责划分：

- `state.js`：棋盘状态、常量和 DOM 引用初始化。
- `rules.js`：加载关卡、重力、合法移动、胜负和进度。
- `moves.js`：撤销、传送与棋子转换。
- `tiles.js`：特殊砖块数据、激光判断和移动平台配置。
- `render.js`、`sprites.js`：主棋盘与元素绘制。
- `replay.js`：走棋记录、回放绘制和导航。
- `presentation.js`：HUD 通知、提示和通关交互。
- `commerce.js`：积分、兑换窗口和登录重试。
- `effects.js`：特效、炸弹与动态障碍。
- `input.js`：输入事件、游戏循环和启动。

这些模块接收显式 `game` 上下文，初始化顺序由 `engine/modules.js` 管理。新增监听器、定时器、动画帧和 MutationObserver 时使用 `game.lifecycle`，确保卸载时清理。登录状态通过导入 `session` 获取，不再挂到 `window`。

编辑器和主游戏导入同一个引擎。编辑关卡后，将导出的关卡对象加入 `src/game/levels.js` 的 `levels` 数组。不再需要拼接、拆分或维护另一份引擎文件。

## 验证

```bash
npm test
npm --prefix backend test
npm run build
npm run test:browser
npm run test:browser:production
```

浏览器检查默认寻找 Windows 上的 Chrome 或 Edge；其他环境可设置 `CHESSMATER_BROWSER` 为 Chromium 浏览器的可执行文件路径。检查在隐藏浏览器中运行，本地 API 使用测试响应，不连接数据库、不执行真实兑换。

开发模式检查全部关卡加载和回放绘制，以及走棋、撤销、重启、提示、返回首页、编辑器加载与引擎重新挂载。生产模式检查构建后的游戏和编辑器入口。

## Portal 语言

从主页打开游戏时可传入 `?locale=zn` 或 `?locale=en`，登录链接也支持 `#token=...&locale=zn`。同时提供时优先使用 hash 中的有效语言；`zh`、`zh-CN` 兼容为 `zn`。

游戏保存该参数，返回 Portal 和登录跳转时沿用语言。未传参数时沿用上次记录，首次默认 `en`。此参数不改变游戏界面语言。
