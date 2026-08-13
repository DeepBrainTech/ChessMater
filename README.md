ChessMater is a puzzle game that combines classic chess movement with platformer-style mechanics. Each chess piece moves according to its normal rules, but gravity, obstacles, and special tiles completely change how you approach the board. Guide your pieces through shifting puzzles, avoid traps, unlock objectives, and reach the goal before your moves run out.

Features:

♟️ Authentic Chess Movement – every piece moves just like in real chess.

🌍 Gravity & Physics – pieces fall and interact with the board environment.

🟩 Special Blocks – transformer tiles, objectives, and counter goals add unique challenges.

🎯 Puzzles & Levels – solve creative boards where strategy meets spatial reasoning.

✨ Win Conditions – only one piece needs to reach the goal, but planning your path is everything.

---

## 前端整改说明（当前版本）

已将静态 HTML/JS 页面迁移为 **Vite + React**。目标是：改 UI/样式走组件；改关卡 / 玩法仍走原来的 JS。

### 先看你要改什么（分工表）

| 你想做的事 | 改哪里 | 不要改 |
|---|---|---|
| 页面布局、按钮、弹窗、颜色、字体、开始页 | `src/components/` + `src/styles/` | `public/js/game.js`、关卡逻辑 |
| 棋子 / 砖块贴图、音效、图标 | `public/assets/` + `public/js/game/00-assets-config.js` | 整份 `game.js` |
| **只改关卡内容**（棋盘、棋子放置、关卡名） | `public/js/levels.js` 或关卡编辑器 | React 组件、引擎分文件 |
| 玩法规则（重力、激光、走子、胜负） | `public/js/game/01–07-*.js`（见下） | 直接手改拼接后的 `public/js/game.js` |
| 排行榜 / 开始流程 / 关卡列表交互 | `src/page/` | 旧的 `page-ui.legacy.js` |

主站运行时：**React 壳** + **分文件引擎** `public/js/game/00–07-*.js`。  
`public/js/game.js` 是拼接产物，主要给 **`/editor.html` 编辑器** 兼容用。

---

### 本地怎么跑

```bash
npm install
npm run dev
```

浏览器打开终端提示的地址（一般是 http://localhost:5173/ ）。

本地开发会自动使用测试用户（`dev_user`），一般不用先登录 portal。

```bash
npm run build    # 打生产包到 dist/
npm start        # Express 托管 dist/（默认 8080）
```

日常改样式用 `npm run dev`，保存后热更新。

关卡编辑器（静态页）：开发服务器下打开 http://localhost:5173/editor.html

---

### 改关卡（levels）——最不容易和 React 冲突

1. **推荐**：用编辑器 `editor.html` 设计关卡，再导出 / 拷贝进 `public/js/levels.js` 的 `LEVELS` 数组。
2. **或直接编辑** `public/js/levels.js`（只动关卡 JSON 数据）。
3. 文件末尾保持有：`window.LEVELS = LEVELS;`（给 React 页读取）。
4. **不要**为了改关卡去改 `src/components/`；关卡列表 UI 会自动读 `LEVELS`。

这样和 UI 重构几乎零冲突：你改数据，别人改组件，各改各的。

---

### 改玩法引擎（game）——请改分文件，不要改大文件

**源文件（请改这些）：**

| 文件 | 内容 |
|---|---|
| `public/js/game/00-assets-config.js` | 贴图 / 音效 URL |
| `public/js/game/01-state.js` | DOM 引用、常量、状态 |
| `public/js/game/02-api-shop-exchange.js` | API、积分、兑换弹窗 |
| `public/js/game/03-audio-canvas-hud-replay.js` | HUD、回放、目标等 |
| `public/js/game/04-level-rules.js` | 加载关卡、走子、重力、胜负 |
| `public/js/game/05-vision-render.js` | 视野 / fog、画布绘制 |
| `public/js/game/06-effects-bombs.js` | 炸弹、鸭子、平台、激光碰撞等 |
| `public/js/game/07-input-loop.js` | 输入、循环、启动 |

改完后执行（更新编辑器用的大文件）：

```bash
node scripts/concat-game.mjs
```

**不要**长时间直接编辑 `public/js/game.js`：它会被上面的脚本覆盖，也容易和别人的分文件改动冲突。

若从 `main` 拉来一整份新的 `game.js`：

1. 把它存成 `public/js/game.monolith.js`
2. `node scripts/split-game.mjs` 重新切开
3. 再按需补 `00-assets-config.js` / UI bridge 等前端钩子
4. `node scripts/concat-game.mjs`

---

### 改设计和样式（用 React 组件）

页面结构在 `src/components/`，例如：

- `StartScreen.jsx` — 开始页
- `GameShell.jsx` / `GameTopControls.jsx` / `LevelSidePanel.jsx` — 游戏内布局与 HUD
- `modals/` — 排行榜、指南、通关、Hint、兑换等弹窗

样式在 `src/styles/`（按区块拆分，`app.css` 只做 `@import`）。

约定：

- 尽量保持现有 **元素 `id`**（如 `gameCanvas`、`levelGrid`、`moveCount`），引擎还在用 `getElementById`。
- 新 UI 优先加组件 + CSS，而不是往 `index.html` 或大 `game.js` 里塞。
- 贴图放到 `public/assets/images/...`，在 `00-assets-config.js` 改路径即可换皮。

---

### 和 main 合并时怎么少冲突

1. **只改关卡**：只提交 `levels.js` → 几乎不会和 frontend/React 冲突。
2. **只改 UI**：只动 `src/`、`src/styles/`、`public/assets/` → 不要动 `game.js` 拼接大文件。
3. **main 更新了引擎**：在 frontend 分支上 merge 后，若 `game.js` 冲突，优先采用 main 的引擎逻辑，再按上面「monolith → split → concat」流程，而不是手工揉两个巨型文件。
4. 合并后本地跑一遍：`npm run dev`，确认选关、新机制关卡（laser / fog 等）正常。

---

### 目录速查

```
src/                    React 页面与样式（改设计从这里）
src/components/         UI 组件
src/styles/             CSS
src/page/               开始流程、关卡列表、排行榜等页面逻辑
public/assets/          素材（pieces / blocks / ui / audio / fonts）
public/js/levels.js     关卡数据
public/js/game/*.js     玩法引擎分文件（改逻辑从这里）
public/js/game.js       拼接产物（给编辑器；勿长期手改）
public/editor.html      关卡编辑器
scripts/concat-game.mjs 分文件 → game.js
scripts/split-game.mjs  monolith → 分文件
```
