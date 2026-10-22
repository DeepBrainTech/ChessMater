# ChessMater

棋类重力解谜游戏，使用 React + Vite + Canvas，后端使用 Express + PostgreSQL。源码使用 UTF-8。

自动测试、GitHub Actions 检查范围及合并门禁设置见 [CI 说明](docs/ci.md)。

## 开发与构建

```bash
npm install
npm run dev
```

开发服务器同时提供游戏 `/` 和关卡编辑器 `/editor.html`。游戏统一使用主站登录，不再自动创建用户或解锁全部关卡。编辑器可离线编辑关卡，服务端接口仍需认证。

```bash
npm run build
npm start
```

Vite 同时构建两个 HTML 入口到 `dist/`。根目录的 `server.js` 托管构建结果，默认端口为 8080。

直接运行 `npm run dev` 时，Vite 也会读取根目录 `.env` 的 `PORTAL_URL` 和 `PORTAL_API_URL`，分别用于主站链接和主站 API；对应的 `VITE_*` 配置优先。游戏 API 单独通过 `VITE_API_BASE_URL` 配置。修改这些地址或 `vite.config.js` 后重启开发服务器。

API 服务位于 `backend/`，默认端口为 3000；上述 Docker 联调使用 3001，单独启动时也应设置 `PORT=3001`：

```bash
npm --prefix backend install
npm --prefix backend start
```

API 服务需要数据库和 Portal JWT 环境变量，具体读取位置见 `backend/db.js` 和 `backend/server.js`。

## Docker 开发环境与主站联调

`docker-compose.dev.yml` 用于开发联调，`docker-compose.yml` 用于生产部署。两份配置独立使用，不需要合并。

需要 Docker Desktop（Linux containers），并先启动现有主站。开发配置仅启动 ChessMater 的前端、API 和游戏数据库，统一连接现有主站，不创建主站服务、主站数据库或 Redis。

根目录 `.env` 中设置 `PORTAL_URL=http://localhost:3000`、`PORTAL_API_URL=http://localhost:8000`，并将 `LOCAL_CHESSMATER_JWT_SECRET`（或 `CHESSMATER_JWT_SECRET`）设置为现有主站签发 ChessMater 令牌使用的密钥。

```powershell
cd D:\DeepBrainTech\ChessMater
docker compose -f docker-compose.dev.yml up -d --build
```

首次启动会安装依赖，查看启动状态：

```powershell
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f game-web game-api
```

- 现有主站：`http://localhost:3000/zh/login`
- 现有主站 API：`http://localhost:8000`
- ChessMater：`http://localhost:5173`
- 游戏 API：`http://localhost:3001`

先在主站登录，然后从 Brain Games 点击 ChessMater。主站签发短期 JWT，通过 URL hash 传入游戏；游戏后端校验后创建用户和 HttpOnly 会话。刷新游戏时从主站 Cookie 恢复令牌，过期后重新获取。所有环境统一要求主站认证；未登录直接访问游戏会跳转主站登录页。地址统一使用 `localhost`，不要混用 `127.0.0.1`，否则主站 Cookie 不共享。

登录和资产统一使用现有主站账号；游戏进度保存在 ChessMater 自己的数据库中。

主站 `frontend/main_page/config/game-launch.ts` 中的 ChessMater 入口需要支持以下配置，本次已在本地主站添加：

```typescript
gameUrl:
  process.env.NEXT_PUBLIC_CHESSMATER_URL || "",
```

源码已挂载并启用热重载。修改依赖后执行 `docker compose -f docker-compose.dev.yml exec game-web npm install --no-package-lock`（后端改为 `game-api`），再重启对应服务。

现有主站前端设置 `NEXT_PUBLIC_CHESSMATER_URL=http://localhost:5173/`；修改后重启或重建其前端以加载配置。此入口不回退到线上地址；生产主站也必须显式配置 `NEXT_PUBLIC_CHESSMATER_URL`。

```powershell
# 停止联调，保留账号与游戏进度
docker compose -f docker-compose.dev.yml down
```

本配置仅用于本机开发。游戏端口为 5173/3001，游戏数据库仅映射到本机 `127.0.0.1:5433`。数据库客户端选择 PostgreSQL，Host 填 `127.0.0.1`，Port 填 `5433`，Username 和 Password 均填 `postgres`，Database 填 `chessmater`，关闭 SSL。修改端口映射后执行 `docker compose -f docker-compose.dev.yml up -d game-db` 使其生效。上述停止命令仅管理游戏服务，主站由自己的项目管理。

## Docker 生产环境

生产配置部署 ChessMater 前端、API 和独立 PostgreSQL，连接已部署的主站。前端使用 Vite 构建产物，后端使用 Node 直接启动；均不挂载源码、不启用热重载，并配置自动重启和健康检查。开发与生产使用不同的项目名及数据库卷。

```powershell
Copy-Item .env.example .env
```

编辑根目录 `.env`（Docker Compose 会自动读取），填写：

- `POSTGRES_PASSWORD`：生产游戏数据库密码。
- `CHESSMATER_JWT_SECRET`：与主站签发 ChessMater 令牌使用的密钥一致。
- `CHESSMATER_SESSION_JWT_SECRET`：独立的游戏会话签名密钥。
- `CHESSMATER_API_URL`：浏览器可访问的游戏 API HTTPS 地址。
- `PORTAL_URL`、`PORTAL_API_URL`：生产主站及其 API 地址，默认使用当前线上域名。

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f game-web game-api
```

通过服务器的 HTTPS 反向代理将游戏域名指向 `127.0.0.1:8080`，将游戏 API 域名指向 `127.0.0.1:3002`。代理需要传递原始 `Host` 和 `X-Forwarded-Proto: https`，以正确设置登录 Cookie。生产主站的 `NEXT_PUBLIC_CHESSMATER_URL` 应指向游戏域名。游戏页面与 API 使用项目允许的 `deepbraintechnology.com` 子域名。

前端 URL 配置在镜像构建时写入，修改后需要重新执行带 `--build` 的启动命令。签名密钥和数据库密码仅传入后端运行环境；`.env` 已被 Git 和 Docker 构建上下文忽略。

```powershell
# 停止生产容器，保留数据库
docker compose down
```

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

## Hint 次数

Hint 按钮显示剩余次数。首次进入并创建 ChessMater 进度时，账号获得一次 3 Hint、2 Undo、1 AntiGravity 初始礼包；再次登录不会重复领取。300 金币兑换 1 次 Hint；首次查看攻略消耗 1 次，本轮关卡内可无限查看，按钮显示 ON。重新开始、切换关卡或刷新页面后需要再次消耗。没有可用攻略时不扣次数，Level Tips 保持免费。

Hint、Undo、AntiGravity 次数为 0 且本轮尚未使用时，点击会打开统一的 Power-Ups 兑换框。单次价格依次为 300、400、600 金币；5 次包为 1300、1700、2500 金币。1900 金币的 Utility Pack 发放 3 Hint + 2 Undo + 1 AntiGravity。主站 `config/shop_items.py` 保存价格与发放配置；`services/chessmater_inventory.py` 扣除主站金币并保存可恢复的购买凭证。ChessMater 验证签名后，在自己的数据库中增加次数；重复请求不会重复扣款或入库。

三种道具的全部余额都保存在 ChessMater 的 `user_progress.hint_credits`、`undo_credits`、`antigravity_credits`。主站只保留金币、钻石、鲜花和购买/发放流水。游戏不再从主站背包读取或消耗道具；`chess_mater_reply` 仅作为 Hint 商品标识保留。每轮 Hint 消耗使用独立请求编号，网络重试不会重复扣次数。

每个账号首次通过当前最新解锁关卡时，奖励 200 主站金币；历史关卡不补发，重复通关不再奖励。游戏后台在保存通关进度的同一事务中记录待发奖励，主站以账号和关卡去重入账；到账后在 `Level Complete!` 下方显示金币图标和 `+200`。网络失败时保留待发记录，在重试、重新进入或页面恢复焦点时补发。此功能需要同时部署主站的 `routes/game_reward_routes.py`、`services/game_rewards.py`、`config/game_rewards.py` 和路由注册。两边使用相同的 `CHESSMATER_JWT_SECRET`；游戏后台通过 `PORTAL_API_URL` 访问主站，Docker 本地开发使用 `PORTAL_INTERNAL_API_URL`。游戏启动时自动创建奖励记录表。新增官方关卡时须同步两边奖励校验的关卡上限（目前为 105）。
已有数据库的旧永久解锁表使用 `backend/migrations/20261019_drop_permanent_replay_unlocks.sql` 删除；新数据库不再创建这张表。迁移不影响库存、购买流水、关卡进度或最佳路线。

主站与 ChessMater 后端、前端需要一起部署。ChessMater 启动时自动确保库存接收表，也可执行 `backend/migrations/20261019_local_inventory_deliveries.sql`。旧主站库存会在用户进入游戏时自动迁移并删除对应 ChessMater 记录；共享的 `user_item_inventories` 表和其他游戏记录保留。

批量迁移已有账号时，在 `backend` 目录显式设置 `PORTAL_DATABASE_URL`、`CHESSMATER_DATABASE_URL`、`CHESSMATER_JWT_SECRET`，然后运行 `node scripts/migrate-portal-inventory.cjs` 预览，确认后加 `--apply` 执行。需要 TLS 的连接分别设置 `PORTAL_DATABASE_SSL=true`、`CHESSMATER_DATABASE_SSL=true`。脚本只迁移三种 ChessMater 库存，保留购买流水；中断后可安全重跑，不重复入库。请先部署两边代码，再运行迁移，避免旧版本继续使用主站库存。主站测试使用独立内存数据库，游戏库存事务测试使用临时 PostgreSQL schema。

## 排行榜头像

本地排行榜测试数据：执行 `docker compose -f docker-compose.dev.yml exec -T game-api node scripts/seed-leaderboard.cjs` 添加 30 名 `TEST_` 玩家及 497 条关卡成绩；重复运行会重置这些测试记录。加 `--append` 参数仅补充缺少的测试玩家，保留已有数据。前 5 关均有步数成绩。清理命令为 `docker compose -f docker-compose.dev.yml exec -T game-api node scripts/seed-leaderboard.cjs --remove`。脚本仅允许本地开发数据库，不创建主站账号或发放奖励。

排行榜前三名领奖台固定，仅第 4 名及之后的列表滚动。渐淡效果提示仍有数据的方向：顶部仅淡化下缘，中间淡化上下一侧，到底后仅淡化上缘，最后两行正常显示；不足一屏时不淡化。上缘约一行、下缘约两行使用连续渐变，并在接近边界时逐渐恢复正常；尚有未加载分页时保留对应方向的提示。滚动条仅在滚动期间显示。本人已位于前 9 名时不重复显示“Your Rank”跳转条，自己的榜单行保持高亮；第 10 名起才显示跳转条。本人实际排名行进入列表可见区域时（包括点击跳转后），跳转条隐藏且不留空行；滚离自己的排名后再显示，显隐时保持可见排名的位置。跳转条固定在滚动列表下方，不参与滚动；点击后在列表内定位到自己的排名附近，前三名保持原位。接口支持分页继续加载及按当前用户定位，百名之外也可跳转，并可加载前后排名或返回榜首。

排行榜前三名头像通过游戏后端从主站批量获取，使用主站现有的上传头像 / Google 头像解析逻辑；无头像或图片失效时使用主站接口返回的主站默认头像地址。游戏不内置默认头像，也不自行指定默认头像地址；主站不可用时仍显示成绩。此功能需要同步部署主站的 `services/avatars.py`、`services/game_avatars.py`、`routes/game_avatar_routes.py` 和 `routes/games.py` 中的路由注册。主站默认头像使用 `PUBLIC_APP_URL`（兼容 `PORTAL_URL`，未配置时使用线上主站域名）下的 `/dashboard/default.png`。服务端请求复用 `PORTAL_API_URL`、`CHESSMATER_JWT_SECRET` 和 `CHESSMATER_JWT_ALG`，使用独立用途的短期令牌，每次仅查询前三名的头像，不返回其他个人资料。

## Portal 语言

从主页打开游戏时可传入 `?locale=zn` 或 `?locale=en`，登录链接也支持 `#token=...&locale=zn`。同时提供时优先使用 hash 中的有效语言；`zh`、`zh-CN` 兼容为 `zn`。

游戏保存该参数，返回 Portal 和登录跳转时沿用语言。未传参数时沿用上次记录，首次默认 `en`。此参数不改变游戏界面语言。

### Shared portal avatar and asset services

ChessMater calls the shared `POST /api/games/{api_slug}/leaderboard/avatars` endpoint with `api_slug=chessmater`. The portal registers the game in `config/game_auth.py`; no ChessMater-specific avatar route or service is required. Avatar requests use a server-signed token with `purpose=leaderboard-avatars`, `aud=chessmater-leaderboard-avatars`, `iss=chessmater-game`, and a 60-second expiry. The request contains at most three portal user IDs.

Asset reads use the shared `GET /api/user/assets` endpoint with the portal login cookie. Portal assets remain authoritative; game-specific reward and inventory rules remain separate. Deploy the shared portal modules and this game together.

### Shared portal level rewards

The game backend calls `POST /api/games/{api_slug}/level-rewards/claim` with `api_slug=chessmater`. The token contains `user_id` (a portal account ID string), `level`, `purpose=first-clear-reward`, `aud=chessmater-level-reward`, `iss=chessmater-game`, and a 60-second expiry. Signing uses `CHESSMATER_REWARD_SECRET` when set, otherwise `CHESSMATER_JWT_SECRET`, with `CHESSMATER_JWT_ALG` (HS256 by default).

The portal determines amounts from `config/game_rewards.py` and returns `data.game_key`, `data.level`, `data.rewards`, `data.already_claimed`, and `data.assets`. The game acknowledges a pending record only after the matching game/level and `rewards.coins=200` are confirmed. Portal claim identities remain unchanged so previously paid levels cannot pay again. Deploy both backends together; the old `first-clear-coins` token purpose and flat `data.coins` response are retired.
