# GitHub Actions 测试

工作流：`.github/workflows/tests.yml`。PR、推送到 `main`/`master`、Actions 页面手动运行都会触发。
使用 Ubuntu 24.04、Node 22 和 PostgreSQL 16，依赖通过随源码提交的锁文件安装。

## 检查范围

- **Game rules and build**：根目录 `npm test` 和 `npm run build`，覆盖移动规则、重力/反重力、撤销、回放、Guide 和图片层。
- **Backend unit tests**：`npm --prefix backend test`，覆盖账户认证、道具授权、奖励、排行榜和头像。此任务跳过数据库集成用例，由独立数据库任务执行。
- **PostgreSQL integration tests**：临时数据库服务，覆盖库存并发与幂等、主站库存迁移、真实 SQL 排名/分页/同分排序、最佳回放、首次奖励和重复数据库迁移。
- **Browser (development/production)**：分别运行开发服务器和生产构建，覆盖 Guide、排行榜、游戏进入与退出、开始时音乐重播及静音保持、响应式布局和页面异常。开发模式额外验证全部现有关卡加载、撤销/回放、编辑器导出和引擎销毁重建。

浏览器接口使用测试数据，不访问真实主站或付费账户。数据库任务使用独立测试服务，不能配置为生产数据库。
关卡加载检查不等于关卡可解性证明；主站与游戏的真实跨服务联动也不属于当前浏览器测试范围。

## 合并门禁

提交工作流并在 GitHub 成功运行一次后，在仓库的分支保护规则或 Ruleset 中，将 **CI passed** 设为必须通过的状态检查。
它汇总所有测试任务；任何任务失败、取消或跳过，汇总检查均不会通过。
工作流文件本身不会修改仓库的分支保护设置。

## 本地运行

```bash
npm ci
npm --prefix backend ci
npm test
npm --prefix backend test
npm run build
npm run test:browser
npm run test:browser:production
```

浏览器脚本支持 Windows、Linux 和 macOS 的常用 Chrome/Chromium 安装路径，也可以通过 `CHESSMATER_BROWSER` 指定浏览器可执行文件。

数据库集成测试需要一个允许创建临时数据库的测试账户。迁移测试会创建独立数据库验证显式指向 `public` 的 SQL，结束后删除。
例如，启动与开发数据库分开的 PostgreSQL：

```bash
docker run --rm --name chessmater-ci-postgres -e POSTGRES_USER=chessmater_test -e POSTGRES_PASSWORD=ci-only-password -e POSTGRES_DB=chessmater_test -p 127.0.0.1:55439:5432 -d postgres:16-alpine
```

等待数据库就绪后，PowerShell 中运行：

```powershell
$env:CHESSMATER_INVENTORY_DB_TEST = '1'
$env:CHESSMATER_TEST_DATABASE_URL = 'postgresql://chessmater_test:ci-only-password@127.0.0.1:55439/chessmater_test'
node --test backend/tests/inventory.test.cjs backend/tests/portal-migration.test.cjs backend/tests/database-integration.test.cjs
docker stop chessmater-ci-postgres
```

## 失败排查

浏览器任务上传名为 `browser-development` / `browser-production` 的 artifact，保留 7 天。
失败时包含错误堆栈、截图和页面 HTML；服务器日志、浏览器日志和页面异常列表无论成功或失败都会保存。
如果浏览器在连接调试端口前失败，只能保存启动日志，无法截图。

本地可设置 `CHESSMATER_TEST_ARTIFACTS=artifacts/browser-local` 保存同样的诊断文件；`artifacts/` 已被 Git 忽略。
浏览器单条调试命令、启动等待和整个测试均有超时，避免失败后长期挂起。
