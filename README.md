ChessMater is a puzzle game that combines classic chess movement with platformer-style mechanics. Each chess piece moves according to its normal rules, but gravity, obstacles, and special tiles completely change how you approach the board. Guide your pieces through shifting puzzles, avoid traps, unlock objectives, and reach the goal before your moves run out.

Features:

♟️ Authentic Chess Movement – every piece moves just like in real chess.

🌍 Gravity & Physics – pieces fall and interact with the board environment.

🟩 Special Blocks – transformer tiles, objectives, and counter goals add unique challenges.

🎯 Puzzles & Levels – solve creative boards where strategy meets spatial reasoning.

✨ Win Conditions – only one piece needs to reach the goal, but planning your path is everything.

---

## 前端整改说明（当前版本）

已将静态 HTML/JS 页面迁移为 **Vite + React** 技术栈，方便后续改 UI/UX，同时保留玩法与后端逻辑。

### 现在可以怎么改

- **设计和样式**：主要改 `src/components/`（页面组件）和 `src/styles/`（按区块拆分的 CSS）
- **贴图 / 音效等素材**：放在 `public/assets/`（棋子、砖块、UI、音效等子目录已预留），路径集中在 `public/js/game/00-assets-config.js`
- **玩法引擎**（走子、重力、绘制等）：仍在 `public/js/game/00–07-*.js`，改皮肤，设计，样式一般不用动这里
- **关卡数据**：仍在 `public/js/levels.js`
- **`public/js/game.js`**：由小模块拼接生成，主要给关卡编辑器兼容；日常开发请改 `public/js/game/` 下的分文件，改完可运行 `node scripts/concat-game.mjs`

当前版本可以运行：页面已组件化；棋盘引擎仍是原逻辑（已拆文件），不必为改样式去重写引擎或后端，除非涉及到

### 本地怎么跑

在项目根目录：

```bash
npm install
npm run dev
```

浏览器打开终端提示的地址（一般是 http://localhost:5173/ ）。

本地开发会自动使用测试用户（`dev_user`），一般不用先登录 portal。如果需要的话，再集成game_main_page.

可选：

```bash
npm run build    # 打生产包到 dist/
npm start        # 用 Express 托管 dist/（默认端口 8080）
```

日常改样式用 `npm run dev` 即可，保存后会热更新。
