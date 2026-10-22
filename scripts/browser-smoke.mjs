import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const executable = process.env.CHESSMATER_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(file => fs.existsSync(file));
if (!executable) throw new Error('Set CHESSMATER_BROWSER to a Chromium browser executable.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chessmater-browser-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const production = process.argv.includes('--production');
const artifactDir = process.env.CHESSMATER_TEST_ARTIFACTS;
if (artifactDir) fs.mkdirSync(artifactDir, { recursive: true });
const port = Number(process.env.CHESSMATER_SMOKE_PORT) || (production ? 5284 : 5283);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, production ? ['server.js'] : ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  windowsHide: true, stdio: 'pipe', env: { ...process.env, PORT: String(port),
    VITE_API_BASE_URL: 'http://127.0.0.1:3001', VITE_PORTAL_API_BASE_URL: 'http://127.0.0.1:8000' },
});
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let browserOutput = '', launchError;
browser.stderr.on('data', data => { browserOutput = (browserOutput + data).slice(-65536); });
browser.on('error', error => { launchError = error; });
server.on('error', error => { launchError = error; });
let socket, command;
const pending = new Map(), errors = [];
const deadline = setTimeout(() => {
  errors.push('Browser smoke test exceeded 4 minutes.');
  socket?.close(); browser.kill(); server.kill();
}, 240000);
try {
  let ready = false;
  const startupDeadline = Date.now() + 30000;
  while (Date.now() < startupDeadline) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok && fs.existsSync(path.join(profile, 'DevToolsActivePort'))) { ready = true; break; } } catch {}
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error(serverOutput);
    if (browser.exitCode !== null) throw new Error(`Browser exited before startup: ${browserOutput}`);
    await delay(100);
  }
  if (!ready) throw new Error('Server or browser did not become ready within 30 seconds.');
  const debugPort = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser debugger connection timed out.')), 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Browser debugger connection failed.')); }, { once: true });
  });
  socket.addEventListener('close', () => {
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('Browser debugger disconnected.')); }
    pending.clear();
  });
  let sequence = 0;
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject, timer } = pending.get(data.id);
      clearTimeout(timer);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error))); else resolve(data.result);
    }
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      errors.push(data.params.args.map(arg => arg.description || arg.value || '').join(' '));
    }
  });
  command = (method, params = {}) => new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) { reject(new Error('Browser debugger is not connected.')); return; }
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
    throw new Error('Timed out: ' + expression + '\n' + errors.join('\n'));
  };
  await command('Runtime.enable');
  await command('Page.enable');
  // Serve a fixture at the main-site URL supplied by the mocked avatar API.
  const portalAvatarFixture = fs.readFileSync('public/assets/images/home/shield-primary.png').toString('base64');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') void command('Fetch.fulfillRequest', {
      requestId: message.params.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: portalAvatarFixture,
    }).catch(error => errors.push(error.message));
  });
  await command('Fetch.enable', { patterns: [{ urlPattern: base + '/__portal__/*' }] });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    // Keep smoke checks deterministic without a running database or paid Portal session.
    const originalFetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      const requestUrl = String(url);
      const user = { id: 42, user_id: 42, portal_user_id: '42', username: 'browser-smoke' };
      const target = new URL(requestUrl, location.href);
      const local = ['localhost', '127.0.0.1'].includes(target.hostname);
      if (local && ['3001', '3002'].includes(target.port) && target.pathname === '/leaderboard') {
        const level = target.searchParams.get('mode') === 'level';
        const scenario = window.__leaderboardScenario;
        const personalRank = { podium: 2, front: 6, compact: 6, edge: 9, outside: 10, nearby: 11 }[scenario] || 328;
        const total = scenario === 'empty' ? 0 : scenario === 'short' ? 1 : scenario === 'compact' ? 6 : scenario === 'nearby' ? 12 : 450;
        const start = target.searchParams.get('aroundMe') === '1' ? 303 : Number(target.searchParams.get('startRank') || 1);
        const entries = Array.from({ length: Math.min(100, Math.max(0, total - start + 1)) }, (_, offset) => {
          const index = start + offset - 1;
          return {
          user_id: index + 1 === personalRank ? 42 : index + 100, rank: index + 1,
          username: index === 3 ? '<img src=x onerror=alert(1)>' : 'cassandraxxx',
          avatar_url: index === 0 ? location.origin + '/assets/images/home/shield-primary.png'
            : index === 1 ? 'data:image/png;base64,invalid' : location.origin + '/__portal__/dashboard/default.png',
          avatar_fallback_url: location.origin + '/__portal__/dashboard/default.png',
          completed_levels: Math.max(1, 105 - index), best_moves: index,
        }; });
        const payload = { entries: scenario === 'empty' ? [] : entries,
          start_rank: start, total, next_rank: start + 100 <= total ? start + 100 : null,
          previous_rank: start > 1 ? Math.max(1, start - 100) : null,
          current_user: scenario === 'empty' ? null : { user_id: 42, rank: personalRank, username: 'browser-smoke', completed_levels: 80, best_moves: 12 } };
        return new Promise(resolve => setTimeout(() => resolve(new Response(JSON.stringify(payload), {
          status: scenario === 'error' ? 500 : 200, headers: { 'Content-Type': 'application/json' }
        })), scenario === 'page-delay' && start > 1 ? 400 : scenario === 'race' && level ? 300 : 0));
      }
      if (local && ['8000', '8100'].includes(target.port)) return Promise.resolve(new Response(JSON.stringify({
        success: true, data: { user, game_token: 'browser-smoke-token', deliveries: [], migrated: false }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      if (local && ['3001', '3002'].includes(target.port)) return Promise.resolve(new Response(JSON.stringify({
        user,
        success: true, maxUnlocked: 999, hintCredits: 10, undoCredits: 10, antigravityCredits: 10, best_moves: null, best_path: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return originalFetch(url, options);
    };
  ` });
  await command('Page.navigate', { url: base });
  await until('document.querySelectorAll(".level-button").length > 0');
  await command('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.getElementById("leaderboardButton").focus(); document.getElementById("leaderboardButton").click()');
  await until('document.querySelector(".lb-personal")?.textContent.includes("328")');
  assert.equal(await evaluate('document.querySelectorAll(".lb-winner").length'), 3);
  assert.equal(await evaluate('document.querySelectorAll(".lb-list > .lb-row").length'), 97);
  assert.equal(await evaluate('document.querySelector(".lb-list .lb-name").textContent'), '<img src=x onerror=alert(1)>');
  assert.equal(await evaluate('document.querySelector(".lb-list .lb-name img")'), null);
  assert.ok(await evaluate('document.querySelector(".lb-winner--1").textContent.includes("105 levels")'));
  await until('document.querySelector(".lb-winner--1 .lb-avatar")?.naturalWidth > 0 && document.querySelector(".lb-winner--2 .lb-avatar")?.src.endsWith("/__portal__/dashboard/default.png")');
  assert.ok(await evaluate('document.querySelector(".lb-winner--1 .lb-avatar").src.endsWith("/assets/images/home/shield-primary.png")'), 'Portal avatar should be rendered');
  assert.equal(await evaluate('document.querySelector(".lb-avatar").referrerPolicy'), 'no-referrer');
  assert.ok(await evaluate(`(() => {
    const tint = getComputedStyle(document.querySelector('.lb-scroll-frame'), '::after');
    return tint.opacity === '1' && tint.backgroundImage.includes('77.546%') && tint.backgroundImage.includes('rgb(251, 242, 233)');
  })()`), 'The lower edge should use the Figma paper tint and gradient stop');
  assert.deepEqual(await evaluate('[document.querySelector(".lb-scroll").dataset.fadeTop, document.querySelector(".lb-scroll").dataset.fadeBottom]'), ['false', 'true']);
  assert.ok(await evaluate('!document.querySelector(".lb-scroll").classList.contains("lb-scroll--active")'));
  const personalTop = await evaluate('document.querySelector(".lb-personal").getBoundingClientRect().top');
  const podiumBeforeScroll = await evaluate('[...document.querySelectorAll(".lb-winner")].map(node => node.getBoundingClientRect().top)');
  await evaluate('document.querySelector(".lb-scroll").scrollTop = 200');
  await until('document.querySelector(".lb-scroll").classList.contains("lb-scroll--active")');
  assert.ok(Math.abs(await evaluate('document.querySelector(".lb-personal").getBoundingClientRect().top') - personalTop) < 1, 'Your Rank must stay fixed below the scrolling rankings');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".lb-winner")].map(node => node.getBoundingClientRect().top)'), podiumBeforeScroll, 'First three places must stay fixed while the list scrolls');
  assert.equal(await evaluate('document.querySelector("[data-rank=\\"9\\"]").style.maskImage'), '', 'The tint must not use an opacity mask on ranking rows');
  assert.deepEqual(await evaluate('[document.querySelector(".lb-scroll").dataset.fadeTop, document.querySelector(".lb-scroll").dataset.fadeBottom]'), ['true', 'true']);
  await until('!document.querySelector(".lb-scroll").classList.contains("lb-scroll--active")');
  const tabsBeforeModeChange = await evaluate('({ left: document.querySelector(".lb-tabs").getBoundingClientRect().left, top: document.querySelector(".lb-tabs").getBoundingClientRect().top })');
  await evaluate('document.querySelectorAll(".lb-tabs button")[1].click()');
  await until('document.getElementById("leaderboardModeSelect") && document.querySelector(".lb-winner--1")?.textContent.includes("0 moves")');
  assert.deepEqual(await evaluate('({ left: document.querySelector(".lb-tabs").getBoundingClientRect().left, top: document.querySelector(".lb-tabs").getBoundingClientRect().top })'), tabsBeforeModeChange, 'Ranking tabs must stay in place when the level selector appears');
  await evaluate('document.getElementById("leaderboardModeSelect").value = "3"; document.getElementById("leaderboardModeSelect").dispatchEvent(new Event("change", { bubbles: true }))');
  await until('document.querySelector(".lb-personal")?.textContent.includes("12 moves")');
  assert.equal(await evaluate('document.getElementById("leaderboardModeSelect").value'), '3');
  for (const [width, height] of [[1920, 1080], [1024, 576], [390, 844], [844, 390]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate('document.querySelector(".lb-scroll").scrollTop = 0');
    await delay(100);
    const geometry = await evaluate(`(() => {
      const content = document.querySelector('.lb-content').getBoundingClientRect();
      const list = document.querySelector('.lb-scroll');
      return { contentFits: content.left >= 0 && content.right <= innerWidth && content.top >= 0 && content.bottom <= innerHeight,
        personalOutsideScroller: !list.contains(document.querySelector('.lb-personal')), canScroll: list.scrollHeight > list.clientHeight,
        assetsLoaded: [...document.querySelectorAll('.lb-screen img')].every(img => img.complete && img.naturalWidth > 0) };
    })()`);
    assert.deepEqual(geometry, { contentFits: true, personalOutsideScroller: true, canScroll: true, assetsLoaded: true }, `Leaderboard layout ${width}x${height}`);
    if (process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS) {
      const screenshot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS, `${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  const podiumBeforeJump = await evaluate('({ top: document.querySelector(".lb-podium").getBoundingClientRect().top, text: document.querySelector(".lb-podium").textContent })');
  await evaluate('document.querySelector(".lb-personal").click()');
  await until('document.querySelector("[data-rank=\\"328\\"]") && document.activeElement.dataset.rank === "328"');
  const rankPosition = await evaluate(`(() => {
    const viewport = document.querySelector('.lb-scroll').getBoundingClientRect();
    const row = document.querySelector('[data-rank="328"]').getBoundingClientRect();
    return Math.abs((row.top + row.bottom - viewport.top - viewport.bottom) / 2);
  })()`);
  assert.ok(rankPosition < 5, 'Personal ranking should be centered in its surrounding ranks');
  assert.ok(await evaluate('document.querySelector(".lb-personal").hidden'), 'The shortcut must hide after jumping to the actual ranking row');
  assert.deepEqual(await evaluate('({ top: document.querySelector(".lb-podium").getBoundingClientRect().top, text: document.querySelector(".lb-podium").textContent })'), podiumBeforeJump, 'Jumping to a remote rank must preserve the fixed podium');
  assert.ok(await evaluate('document.querySelector("[data-rank=\\"327\\"]") && !!document.querySelector("[data-rank=\\"329\\"]")'));
  await evaluate('document.querySelectorAll(".lb-page-actions button")[1].click()');
  await until('document.querySelector("[data-rank=\\"203\\"]") && !document.querySelector(".lb-page-actions button").disabled');
  assert.ok(await evaluate(`(() => {
    const viewport = document.querySelector('.lb-scroll').getBoundingClientRect();
    const row = document.querySelector('[data-rank="328"]').getBoundingClientRect();
    return Math.abs((row.top + row.bottom - viewport.top - viewport.bottom) / 2) < 5;
  })()`), 'Loading previous rankings should preserve the visible rank position');
  await evaluate('document.querySelector(".lb-page-actions button").click()');
  await until('document.querySelector(".lb-winner--1") && document.querySelector(".lb-scroll").scrollTop === 0');
  await evaluate('window.__leaderboardScenario = "page-delay"; document.querySelector(".lb-scroll").scrollTop = document.querySelector(".lb-scroll").scrollHeight');
  await until('document.querySelector(".lb-results").getAttribute("aria-busy") === "true"');
  assert.equal(await evaluate('document.querySelector(".lb-scroll").dataset.fadeBottom'), 'true', 'More unloaded rankings should retain the downward hint');
  await until('document.querySelector("[data-rank=\\"200\\"]")');
  await evaluate('window.__leaderboardScenario = ""');
  await evaluate('document.querySelector(".lb-scroll").scrollTop = 0');
  await evaluate('window.__leaderboardScenario = "error"; document.querySelector(".lb-personal").click()');
  await until('document.querySelector(".lb-page-error")');
  assert.ok(await evaluate('!!document.querySelector("[data-rank=\\"4\\"]")'), 'A failed jump must preserve the current leaderboard');
  await evaluate('window.__leaderboardScenario = ""; document.querySelector(".lb-personal").click()');
  await until('document.activeElement.dataset.rank === "328"');
  await evaluate('document.querySelector(".lb-page-actions button").click()');
  await until('document.querySelector(".lb-winner--1") && document.querySelector(".lb-scroll").scrollTop === 0 && document.querySelector(".lb-results").getAttribute("aria-busy") === "false"');
  await evaluate('window.__leaderboardScenario = "race"; document.querySelectorAll(".lb-tabs button")[0].click()');
  await until('document.querySelector(".lb-winner--1")?.textContent.includes("105 levels")');
  await evaluate('document.querySelectorAll(".lb-tabs button")[1].click()');
  await delay(40);
  assert.ok(await evaluate('document.querySelector(".lb-winner--1")?.textContent.includes("105 levels") && !!document.querySelector(".lb-scroll") && !document.querySelector(".lb-message[role=status]")'), 'Keep the existing leaderboard and score units visible while the next tab loads');
  await evaluate('document.querySelectorAll(".lb-tabs button")[0].click()');
  await delay(400);
  assert.ok(await evaluate('document.querySelector(".lb-winner--1")?.textContent.includes("105 levels")'), 'Stale request must not overwrite the active mode');
  for (const scenario of ['empty', 'short', 'error']) {
    await evaluate(`window.__leaderboardScenario = '${scenario}'; document.querySelectorAll('.lb-tabs button')[1].click()`);
    await until('document.querySelector(".lb-results").getAttribute("aria-busy") === "false"');
    if (scenario === 'empty') assert.equal(await evaluate('!!document.querySelector(".lb-personal")'), false);
    if (scenario === 'short') assert.equal(await evaluate('document.querySelectorAll(".lb-vacant").length'), 2);
    if (scenario === 'error') {
      assert.ok(await evaluate('!!document.querySelector(".lb-message[role=alert]")'));
      await evaluate('window.__leaderboardScenario = ""; document.querySelector(".lb-message button").click()');
      await until('document.querySelector(".lb-personal")?.textContent.includes("328")');
    }
    await evaluate('document.querySelectorAll(".lb-tabs button")[0].click()');
    await until('document.querySelector(".lb-results").getAttribute("aria-busy") === "false"');
  }
  for (const scenario of ['podium', 'front', 'compact', 'edge', 'outside', 'nearby']) {
    await evaluate(`window.__leaderboardScenario = '${scenario}'; document.querySelectorAll('.lb-tabs button')[1].click()`);
    await until('document.querySelector(".lb-results").getAttribute("aria-busy") === "false"');
    assert.equal(await evaluate('!!document.querySelector(".lb-personal:not([hidden])")'), ['outside', 'nearby'].includes(scenario), 'Personal shortcut visibility: ' + scenario);
    if (scenario === 'front') assert.ok(await evaluate('document.querySelector(\'[data-rank="6"]\').classList.contains("lb-row--me")'), 'The actual row stays highlighted');
    if (scenario === 'compact') {
      assert.deepEqual(await evaluate('[document.querySelector(".lb-scroll").dataset.fadeTop, document.querySelector(".lb-scroll").dataset.fadeBottom]'), ['false', 'false']);
      assert.ok(await evaluate('["::before", "::after"].every(side => getComputedStyle(document.querySelector(".lb-scroll-frame"), side).opacity === "0")'), 'A list that fits should have no fading');
    }
    if (scenario === 'nearby') {
      await command('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
      await delay(100);
      await evaluate('document.querySelector(".lb-scroll").scrollTop = document.querySelector(".lb-scroll").scrollHeight');
      await until('document.querySelector(".lb-personal").hidden');
      assert.deepEqual(await evaluate('[document.querySelector(".lb-scroll").dataset.fadeTop, document.querySelector(".lb-scroll").dataset.fadeBottom]'), ['true', 'false']);
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".lb-scroll-frame"), "::after").opacity'), '0', 'The last two rows must not be tinted at the end');
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".lb-scroll-frame"), "::before").opacity'), '1', 'The top edge should hint at earlier rankings');
      if (process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS) {
        const screenshot = await command('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS, 'bottom.png'), Buffer.from(screenshot.data, 'base64'));
      }
      assert.ok(await evaluate('document.querySelector(\'[data-rank="11"]\').classList.contains("lb-row--me")'));
      await evaluate('document.querySelector(".lb-scroll").scrollTop = 0');
      await until('!document.querySelector(".lb-personal").hidden');
      await evaluate('document.querySelector(".lb-personal").click()');
      await until('document.querySelector(".lb-personal").hidden && document.activeElement.dataset.rank === "11"');
      await until('!document.querySelector(".lb-scroll").classList.contains("lb-scroll--active")');
      assert.ok(await evaluate(`(() => {
        const viewport = document.querySelector('.lb-scroll').getBoundingClientRect();
        const row = document.querySelector('[data-rank="11"]').getBoundingClientRect();
        return row.top >= viewport.top && row.bottom <= viewport.bottom;
      })()`), 'The actual row must remain visible after the shortcut collapses');
    }
    await evaluate('document.querySelectorAll(".lb-tabs button")[0].click()');
    await until('document.querySelector(".lb-results").getAttribute("aria-busy") === "false"');
  }
  await evaluate('document.getElementById("leaderboardModal").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
  await until('!document.getElementById("leaderboardModal").classList.contains("active")');
  assert.equal(await evaluate('document.activeElement.id'), 'leaderboardButton');
  await command('Emulation.clearDeviceMetricsOverride');
  console.log('Leaderboard modes, fading, transient scrollbars, personal-rank jumps, pagination, responsive layouts and error/race checks passed.');
  await command('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.getElementById("instructionsButton").focus(); document.getElementById("instructionsButton").click()');
  await until('document.querySelector("#guideModal.active .beginner-board--0")');
  assert.equal(await evaluate('document.querySelectorAll(".beginner-pagination button").length'), 4);
  assert.equal(await evaluate('document.querySelectorAll(".beginner-step").length'), 2);
  await evaluate('document.querySelector(".beginner-step--next").click()');
  await until('!!document.querySelector(".beginner-board--1")');
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), 'Next step', 'Arrow navigation preserves keyboard focus');
  await evaluate('document.querySelector(".beginner-step--previous").click()');
  await until('!!document.querySelector(".beginner-board--0")');
  const guideFirstTransform = await evaluate('getComputedStyle(document.querySelector(".beginner-piece")).transform');
  await delay(2300);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".beginner-piece")).transform'), guideFirstTransform, 'The first guide page must wait for player input');
  for (const piece of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
    await evaluate(`document.querySelector('.beginner-piece-picker [data-piece="${piece}"]').click()`);
    assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.piece'), piece);
    assert.ok(await evaluate('!!document.querySelector(".beginner-tile[data-available=true]")'), `Available moves for ${piece}`);
    assert.deepEqual(await evaluate('(() => { const s = getComputedStyle(document.querySelector(".beginner-move-dot")); return [s.backgroundColor, s.borderTopColor]; })()'), ['rgba(41, 128, 185, 0.5)', 'rgba(21, 67, 96, 0.8)'], 'Guide must use the game move-marker colors');
    const position = await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col');
    await evaluate('document.querySelector(".beginner-tile[data-cell=\\"15\\"]").click()');
    assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col'), position, 'A platform must reject moves');
    await evaluate('document.querySelector(".beginner-tile[data-available=true]").click()');
    assert.notEqual(await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col'), position, 'Clicking a valid destination must move the piece');
    assert.equal(await evaluate('document.querySelectorAll(".beginner-tile[data-available=true]").length'), 0, 'Move markers must hide while moving and falling');
    const destination = await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col');
    await evaluate('document.querySelector(".beginner-tile[data-cell=\\"13\\"]").click()');
    assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col'), destination, 'Input must be ignored during motion');
    await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
    assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '2', 'Every piece must fall back onto the floor');
    assert.ok(await evaluate('!!document.querySelector(".beginner-tile[data-available=true]")'), 'Moves must refresh after landing');
  }
  const manualPosition = await evaluate('document.querySelector(".beginner-piece").dataset.row');
  await delay(1600);
  assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), manualPosition, 'Manual play must cancel the automatic demo');
  assert.equal(await evaluate('!!document.querySelector(".beginner-replay, .beginner-description")'), false, 'Movement page omits replay and redundant instructions');
  for (let index = 0; index < 4; index++) {
    await evaluate(`document.querySelectorAll('.beginner-pagination button')[${index}].click()`);
    assert.equal(await evaluate('document.querySelector(".beginner-step-number").textContent'), String(index + 1), 'The title number matches the current step');
    assert.equal(await evaluate('document.querySelectorAll(".beginner-piece-picker button").length'), 6, 'All four guide pages must show six piece choices');
    assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.piece'), 'pawn', 'The selected piece must persist across guide pages');
    if (index === 3) {
      await evaluate('window.__guideAudioPlays = 0; window.__guideOriginalPlay = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__guideAudioPlays++; return Promise.resolve(); }');
      const initialTargetPosition = await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col');
      await delay(1700);
      assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col'), initialTargetPosition, 'The target page must wait for player input');
      assert.equal(await evaluate('document.querySelector(".beginner-board").classList.contains("beginner-board--complete")'), false, 'The target page must not complete automatically');
    }
    for (const piece of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
      await evaluate(`document.querySelector('.beginner-piece-picker [data-piece="${piece}"]').click()`);
      if (index === 3) assert.equal(await evaluate('document.querySelectorAll(".confetti-container--contained").length'), 0, 'Switching pieces clears the previous celebration');
      assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.piece'), piece, `Switching to ${piece} on guide page ${index + 1}`);
      assert.equal(await evaluate('document.querySelector(".beginner-piece-picker [aria-pressed=true]").dataset.piece'), piece);
      if (index > 0) assert.ok(await evaluate('!document.querySelector(".beginner-piece-explanation").textContent.includes("The pawn moves") && !document.querySelector(".beginner-piece-explanation").textContent.includes("The king moves")'), 'Later pages show the step hint instead of piece movement instructions');
      if (index === 3) {
        assert.equal(await evaluate('document.querySelector(".beginner-piece-explanation").textContent'), 'Move onto the black king’s square to capture it.', 'Switching pieces resets the completion hint');
        await evaluate('document.querySelector(".beginner-target-open").closest("button").click()');
        await until('document.querySelector(".beginner-board").classList.contains("beginner-board--complete")');
        assert.equal(await evaluate('!!document.querySelector(".beginner-target-open")'), false, 'Reaching the target removes its piece instead of stacking it under the player');
        await until('!!document.querySelector(".beginner-goal-glow") && !!document.querySelector(".confetti-container--contained")');
        assert.ok(await evaluate('document.querySelector(".beginner-piece-explanation").textContent.includes("Well done!")'), 'Completion message stays in the hint position');
        assert.equal(await evaluate('!!document.querySelector(".beginner-unlocked")'), false, 'The old checkmark is removed');
        assert.equal(await evaluate('document.querySelectorAll(".confetti-container--contained").length'), 1, 'One celebration per completion');
        assert.equal(await evaluate('window.__guideAudioPlays'), 0, 'Guide celebrations never play audio');
        if (piece === 'pawn' && process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS) {
          await delay(200);
          const screenshot = await command('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS, 'guide-celebration.png'), Buffer.from(screenshot.data, 'base64'));
        }
        assert.equal(await evaluate('document.querySelectorAll(".beginner-tile[data-available=true]").length'), 0, 'Reaching the target ends the practice');
      }
      if (index === 1) {
        const initialPosition = await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col');
        await delay(1400);
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col'), initialPosition, 'Gravity practice waits for player input');
        const landing = await evaluate('document.querySelector(".beginner-landing-preview").dataset.row + "," + document.querySelector(".beginner-landing-preview").dataset.col');
        await evaluate(`(() => {
          const preview = document.querySelector('.beginner-landing-preview');
          const col = Number(preview.dataset.col), row = Number(preview.dataset.row);
          const tile = [...document.querySelectorAll('.beginner-tile[data-available=true]')].find(tile => Number(tile.dataset.cell) % 5 === col && Math.floor(Number(tile.dataset.cell) / 5) < row);
          tile.click();
        })()`);
        assert.equal(await evaluate('document.querySelector(".beginner-board").dataset.motion'), 'moving');
        await until('document.querySelector(".beginner-board").dataset.motion === "falling"');
        await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row + "," + document.querySelector(".beginner-piece").dataset.col'), landing, 'The piece falls to the previewed landing square');
      }
      if (index === 2) {
        assert.equal(await evaluate('document.querySelector(".beginner-antigravity button").getAttribute("aria-pressed")'), 'false', 'Anti-Gravity starts OFF after switching pieces');
        await delay(1400);
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '2', 'The antigravity page waits for player input');
        await evaluate('document.querySelector(".beginner-antigravity button").click()');
        assert.equal(await evaluate('document.querySelector(".beginner-antigravity .game-credit").textContent'), 'ON');
        assert.equal(await evaluate('document.querySelector(".beginner-board").dataset.motion'), 'rising', 'Turning ON immediately raises the piece');
        await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '0', 'ON raises the piece to the ceiling');
        await evaluate('document.querySelector(".beginner-antigravity button").click()');
        assert.equal(await evaluate('document.querySelector(".beginner-antigravity .game-credit").textContent'), 'OFF');
        await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '2', 'OFF immediately restores downward gravity');
        await evaluate(`(() => {
          const tile = document.querySelector('.beginner-tile[data-available=true]');
          tile.click();
        })()`);
        await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '2', 'Moves with OFF fall to the floor');
        await evaluate('document.querySelector(".beginner-antigravity button").click()');
        await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '0');
        if (piece !== 'pawn') {
          await evaluate(`(() => {
            const tile = [...document.querySelectorAll('.beginner-tile[data-available=true]')].find(tile => Number(tile.dataset.cell) >= 5);
            tile.click();
          })()`);
          await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
          assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '0', 'Moves with ON rise back to the ceiling');
        }
        await evaluate('document.querySelector(".beginner-antigravity button").click()');
        assert.equal(await evaluate('document.querySelector(".beginner-antigravity .game-credit").textContent'), 'OFF');
        await until('document.querySelector(".beginner-board").dataset.motion === "idle"');
        assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '2', 'OFF makes the piece fall onto the floor');
      }
    }
    if (index > 0) {
      await delay(1900);
      if (index === 3) assert.ok(await evaluate('document.querySelector(".beginner-board").classList.contains("beginner-board--complete")'), 'The manually reached target stays complete');
      if (index === 1) assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '1', 'The pawn lands back on its elevated platform');
      if (index === 2) assert.equal(await evaluate('document.querySelector(".beginner-piece").dataset.row'), '2', 'Manual practice stays at its final position');
    }
    if (index === 3) {
      await until('!document.querySelector(".confetti-container--contained") && !document.querySelector(".beginner-goal-glow")');
      assert.equal(await evaluate('document.querySelector(".beginner-piece-explanation").textContent'), 'Well done! You captured the black king.', 'The success hint persists after the celebration until the board resets');
      await evaluate('HTMLMediaElement.prototype.play = window.__guideOriginalPlay; delete window.__guideOriginalPlay');
    }
    await until('[...document.querySelectorAll("#guideModal img")].every(img => img.complete && img.naturalWidth > 0)');
    assert.equal(await evaluate('document.querySelectorAll(".beginner-demo > .beginner-piece-explanation").length'), 1, 'Each page has one hint directly below the board');
    assert.equal(await evaluate('!!document.querySelector(".beginner-caption .beginner-description")'), false, 'No duplicate hint below the main hint');
    assert.equal(await evaluate('document.querySelector(".beginner-pagination [aria-current]").getAttribute("aria-label")'), `Page ${index + 1}: ${['Learn the Moves', 'Watch Your Landing', 'Use Antigravity', 'Capture the Black King'][index]}`);
    if (process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS) {
      const screenshot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS, `guide-${index}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  for (const [width, height] of [[390, 844], [844, 390], [1024, 576]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (let index = 0; index < 4; index++) {
    await evaluate(`document.querySelectorAll('.beginner-pagination button')[${index}].click()`);
    assert.ok(await evaluate(`(() => {
      const r = document.querySelector('.beginner-content').getBoundingClientRect();
      const arrows = [...document.querySelectorAll('.beginner-step, .beginner-antigravity button')].map(button => button.getBoundingClientRect());
      return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
        && arrows.every(a => a.left >= 0 && a.right <= innerWidth && a.top >= 0 && a.bottom <= innerHeight);
    })()`), `Guide must fit ${width}x${height}`);
    if (index === 0 && process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS) {
      const screenshot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS, `guide-movement-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
    }
  }
  await evaluate('document.getElementById("guideModal").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))');
  assert.ok(await evaluate('!!document.querySelector(".beginner-board--2")'));
  const guideTransition = await evaluate('getComputedStyle(document.querySelector(".beginner-piece")).transitionDuration');
  assert.ok(guideTransition.split(',').some(duration => parseFloat(duration) > 0), 'Guide movement must have an animated transition');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".beginner-piece")).transitionDuration'), guideTransition, 'System reduced motion preserves guide movement transitions');
  await evaluate('document.querySelectorAll(".beginner-pagination button")[3].click()');
  await until('!!document.querySelector(".beginner-board--3 .beginner-target-open")');
  await evaluate('document.querySelector(".beginner-target-open").closest("button").click()');
  assert.equal(await evaluate('document.querySelector(".beginner-board").dataset.motion'), 'moving', 'System reduced motion preserves the movement animation before completion');
  await until('document.querySelector(".beginner-board").classList.contains("beginner-board--complete")');
  await until('!!document.querySelector(".confetti-container--contained") && !!document.querySelector(".beginner-goal-glow")');
  assert.equal(await evaluate('document.querySelectorAll(".confetti-container--contained").length'), 1, 'System reduced motion preserves the guide celebration');
  assert.ok(await evaluate('document.querySelector(".beginner-piece-explanation").textContent.includes("Well done!")'), 'System reduced motion keeps completion feedback');
  await command('Emulation.setEmulatedMedia', { features: [] });
  await evaluate('document.getElementById("closeGuideModal").click()');
  await until('!document.querySelector("#guideModal.active")');
  assert.equal(await evaluate('document.activeElement.id'), 'instructionsButton');
  assert.equal(await evaluate('!!document.querySelector(".beginner-board")'), false, 'Closing the guide removes its animations');
  assert.equal(await evaluate('document.querySelectorAll(".confetti-container--contained, .beginner-goal-glow").length'), 0, 'Closing the guide clears the celebration');
  await evaluate('document.getElementById("instructionsButton").click()');
  await until('!!document.querySelector(".beginner-board--0")');
  // Record playback requests without requiring a CI audio device or autoplay permission.
  // Use the real media currentTime property to verify seeking, not a mocked clock.
  await evaluate(`(() => {
    const music = document.getElementById('bgMusic');
    window.__musicStarts = [];
    music.currentTime = 12;
    music.play = function () { window.__musicStarts.push(this.currentTime); return Promise.resolve(); };
  })()`);
  await evaluate('document.querySelector(".beginner-actions button").click()');
  await command('Emulation.clearDeviceMetricsOverride');
  await until('document.body.classList.contains("in-game")');
  assert.deepEqual(await evaluate('window.__musicStarts'), [0], 'Starting from Guide restarts the music');
  await until('[...document.querySelectorAll(".game-piece-sprite:not([hidden]) > img")].length > 0 && [...document.querySelectorAll(".game-piece-sprite:not([hidden]) > img")].every(img => img.complete && img.naturalWidth > 0)');
  assert.ok(await evaluate('[...document.querySelectorAll(".game-piece-sprite:not([hidden]) > img")].every(img => getComputedStyle(img).objectFit === "contain")'), 'All live chess pieces preserve their image proportions');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".game-piece-image-layer")).pointerEvents'), 'none', 'Image layer does not block board input');
  assert.ok(await evaluate(`(() => {
    const canvas = document.querySelector('#gameCanvas').getBoundingClientRect();
    const layer = document.querySelector('.game-piece-image-layer').getBoundingClientRect();
    return Math.abs(canvas.left - layer.left) < 1 && Math.abs(canvas.top - layer.top) < 1
      && Math.abs(canvas.width - layer.width) < 1 && Math.abs(canvas.height - layer.height) < 1;
  })()`), 'Piece image layer must align with the rendered board');
  if (process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.CHESSMATER_LEADERBOARD_SCREENSHOTS, 'game-image-pieces.png'), Buffer.from(screenshot.data, 'base64'));
  }
  console.log('Beginner guide pages, animation, responsive layouts, reduced motion, focus and start flow passed.');
  if (!production) {
    const result = await evaluate(`(async () => {
      const { game } = await import('/src/game/runtime.js');
      const loaded = game.currentPuzzleData?.name;
      // Exercise every shipped level, including special tiles and replay drawing.
      const originalLevels = JSON.stringify(game.LEVELS);
      for (const level of game.LEVELS) {
        game.loadPuzzle(level);
        if (!game.currentPuzzleData || game.board.length !== level.rows) throw new Error('Level failed: ' + level.name);
        if (game.players.length && game.selectedPlayerIndex !== 0) throw new Error('Level did not auto-select its first piece: ' + level.name);
        game.drawBoard();
        const snapshot = game.buildCurrentReplaySnapshot();
        game.fewestOtherMovesReplayPath = [snapshot];
        game.fewestOtherMovesReplayMoveCounts = [0];
        game.drawLevelCompleteReplaySnapshot(0);
        game.drawInGameWalkthroughSnapshot(0);
      }
      await game.fetchFewestOtherMovesForCurrentLevel();
      const initial = game.buildCurrentReplaySnapshot();
      const counterPath = [initial,
        { ...initial, move: { systemEvent: 'toggle_antigravity', antigravityApplied: true } },
        { ...initial, move: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } } },
      ];
      game.hintUnlockedThisRun = true;
      game.updateFewestOtherMovesDisplay(1, counterPath, 'Smoke test');
      game.inGameWalkthroughModal.classList.add('active');
      game.drawInGameWalkthroughSnapshot(0);
      game.stepReplayNavigation('next');
      if (game.inGameWalkthroughStep.textContent !== 'Step: 0 / 1') throw new Error('Hint antigravity counters failed');
      game.stepReplayNavigation('next');
      if (game.inGameWalkthroughStep.textContent !== 'Step: 1 / 1') throw new Error('Hint move counters failed');
      game.stepReplayNavigation('prev');
      if (game.inGameWalkthroughStep.textContent !== 'Step: 0 / 1') throw new Error('Hint reverse navigation failed');
      game.inGameWalkthroughModal.classList.remove('active');
      game.levelCompleteModal.classList.add('active');
      game.drawLevelCompleteReplaySnapshot(0);
      game.stepReplayNavigation('next');
      if (game.levelCompleteReplayStep.textContent !== 'Step: 0 / 1') throw new Error('Completion antigravity counters failed');
      game.stepReplayNavigation('next');
      if (game.levelCompleteReplayStep.textContent !== 'Step: 1 / 1') throw new Error('Completion move counters failed');
      game.levelCompleteModal.classList.remove('active');
      game.resetHintForRun();
      game.updateFewestOtherMovesDisplay(null, null, '');
      const creditsBeforeEmpty = game.hintCredits;
      await game.openHintModal();
      if (!game.inGameWalkthroughModal.classList.contains('active') || !game.inGameWalkthroughModal.classList.contains('hint-empty')) throw new Error('Missing guide should open the empty Hint dialog');
      if (game.inGameWalkthroughBestMoves.textContent !== '-') throw new Error('Missing record should display a dash');
      if (game.hintCredits !== creditsBeforeEmpty || game.hintUnlockedThisRun) throw new Error('Empty guide consumed a Hint');
      game.closeInGameWalkthroughModal();
      const realPortal = game.getPortalCommerce;
      const realHintUse = game.consumeLocalHintCredit;
      const realInventorySync = game.syncGameInventory;
      let hintUses = 0, hintQuantity = 2;
      game.getPortalCommerce = () => ({
        assertAccount: async () => {}, hasPendingUse: () => false,
        catalog: async () => ({ items: {} }),
      });
      game.consumeLocalHintCredit = async () => { hintUses++; hintQuantity--; game.hintCredits = hintQuantity; };
      game.syncGameInventory = async () => { game.hintCredits = hintQuantity; return true; };
      game.resetHintForRun();
      game.hintCredits = hintQuantity;
      game.updateFewestOtherMovesDisplay(1, counterPath, 'Smoke test', true);
      if (game.hintUnlockedThisRun) throw new Error('Historical Hint unlock leaked into a new run');
      await game.openHintModal();
      if (!game.inGameWalkthroughModal.classList.contains('active') || hintUses !== 1) throw new Error('Hint did not consume/open');
      await new Promise(resolve => setTimeout(resolve, 30));
      if (document.querySelector('#blockTipToggle .game-credit').textContent !== 'View') throw new Error('Hint allowance is not shown as View');
      const hintModal = game.inGameWalkthroughModal;
      if (hintModal.querySelector('.level-complete-stat strong').textContent !== '-') throw new Error('Hint should not show a player move count');
      if (hintModal.querySelector('h2') || hintModal.textContent.includes('Next Level')) throw new Error('Hint contains completion-only content');
      if (game.inGameWalkthroughBestMoves.textContent !== '1') throw new Error('Hint best move count missing');
      if (game.inGameWalkthroughCloseBtn.textContent.trim() !== 'Retry') throw new Error('Hint retry button missing');
      game.closeInGameWalkthroughModal();
      await game.openHintModal();
      if (hintUses !== 1) throw new Error('Hint consumed twice in one run');
      const hintVisit = game.hintRunId;
      game.restartLevel();
      if (!game.hintUnlockedThisRun || game.hintRunId !== hintVisit) throw new Error('Restart cleared Hint access');
      game.updateFewestOtherMovesDisplay(1, counterPath, 'Smoke test');
      await game.openHintModal();
      if (hintUses !== 1) throw new Error('Restart charged another Hint');
      game.inGameWalkthroughCloseBtn.click();
      if (!game.hintUnlockedThisRun || game.hintRunId !== hintVisit) throw new Error('Hint Retry cleared access');
      game.updateFewestOtherMovesDisplay(1, counterPath, 'Smoke test');
      await game.openHintModal();
      if (hintUses !== 1) throw new Error('Hint Retry charged another Hint');
      game.closeInGameWalkthroughModal();
      game.resetHintForRun();
      await game.openHintModal();
      if (hintUses !== 2) throw new Error('Restarted run did not consume a fresh Hint');
      game.closeInGameWalkthroughModal();
      await game.openHintModal();
      if (hintUses !== 2 || !game.inGameWalkthroughModal.classList.contains('active')) throw new Error('Last Hint did not stay available this run');
      game.closeInGameWalkthroughModal();
      game.resetHintForRun();
      game.levelCompleteModal.classList.add('active');
      game.updateLevelCompleteReplayDisplay();
      game.levelCompleteReplayLock.focus();
      game.levelCompleteReplayLock.click();
      if (!document.getElementById('powerUpsModal').classList.contains('active')) throw new Error('Zero Hint did not open shop');
      const shopPrice = document.querySelector('#powerUpsModal .power-price').getBoundingClientRect();
      const topElement = document.elementFromPoint(shopPrice.x + shopPrice.width / 2, shopPrice.y + shopPrice.height / 2);
      if (!topElement?.closest('#powerUpsModal')) throw new Error('Shop is behind the completion dialog');
      const { hideModal } = await import('/src/game/modalFocus.js');
      hideModal(document.getElementById('powerUpsModal'));
      if (!game.levelCompleteModal.classList.contains('active') || document.activeElement !== game.levelCompleteReplayLock) throw new Error('Closing shop did not restore the completion dialog focus');
      game.levelCompleteModal.classList.remove('active');
      game.getPortalCommerce = realPortal;
      game.consumeLocalHintCredit = realHintUse;
      game.syncGameInventory = realInventorySync;
      const board = Array.from({ length: 4 }, (_, row) => Array(6).fill(row === 3 ? game.CELL_TYPES.SOLID_BLOCK : 0));
      game.loadPuzzle({ name: 'Smoke test', rows: 4, cols: 6, board, players: [{ row: 2, col: 0, pieceType: 'rook' }], goal: { row: 2, col: 5 }, objectives: [], bombs: [] });
      game.gravityEnabled = false;
      if (game.isValidMove(0, 2, 0)) throw new Error('Current square must not be a move destination');
      if (!game.isValidMove(0, 2, 1)) throw new Error('Rook move rejected');
      game.movePlayer(0, 2, 1);
      if (!game.pieceMoveAnimation || game.players[0].col !== 0) throw new Error('Ordinary movement skipped its animation');
      await new Promise(resolve => setTimeout(resolve, 110));
      const movingImage = document.querySelector('.game-piece-sprite:not([hidden]) > img[src$="piece-rook.svg"]');
      const movementMatrix = movingImage && new DOMMatrix(getComputedStyle(movingImage.parentElement).transform);
      if (!movementMatrix || movementMatrix.e <= 8 || movementMatrix.e >= game.TILE_SIZE + 8) throw new Error('Piece did not pass through an intermediate horizontal position');
      await new Promise(resolve => setTimeout(resolve, 320));
      if (game.levelMoveCount !== 1 || game.players[0].col !== 1) throw new Error('Move did not update state');
      await game.syncUndoCreditsFromServer();
      await game.undoMove();
      if (game.levelMoveCount !== 0 || game.players[0].col !== 0) throw new Error('Undo did not restore state');
      game.restartLevel();
      if (game.currentPuzzleData.name !== 'Smoke test' || game.players[0].col !== 0) throw new Error('Restart failed');
      await game.openUndoExchangeModal();
      hideModal(document.getElementById('powerUpsModal'));
      await game.openAntigravityExchangeModal();
      hideModal(document.getElementById('powerUpsModal'));
      game.loadPuzzle(game.LEVELS[0]);
      const realProgressApi = game.apiFetchWithAuthRetry;
      game.gameWon = true;
      game.apiFetchWithAuthRetry = async () => new Response(JSON.stringify({ success: true, coinReward: 200 }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
      game.showLevelCompleteModal();
      game.triggerConfetti({ target: game.levelCompleteModal.querySelector('.level-complete-content'), silent: true });
      const celebration = document.querySelector('body > .confetti-container');
      if (!celebration || Number(getComputedStyle(celebration).zIndex) <= Number(getComputedStyle(game.levelCompleteModal).zIndex)) throw new Error('Celebration is behind the completion dialog');
      if (getComputedStyle(celebration).pointerEvents !== 'none') throw new Error('Celebration blocks dialog clicks');
      if (!game.levelCompleteCoinReward.hidden) throw new Error('Reward displayed before server confirmation');
      await game.syncProgressAfterWin();
      if (game.levelCompleteCoinReward.hidden || game.levelCompleteCoinReward.textContent.trim() !== '+200') throw new Error('Confirmed first-clear reward missing');
      const rewardRect = game.levelCompleteCoinReward.getBoundingClientRect();
      const headingRect = document.getElementById('levelCompleteHeading').getBoundingClientRect();
      if (rewardRect.top < headingRect.bottom || rewardRect.height <= 0) throw new Error('Coin reward is not below the completion heading');
      game.showLevelCompleteModal();
      game.apiFetchWithAuthRetry = async () => new Response(JSON.stringify({ success: true, coinReward: 0 }), { status: 200 });
      await game.syncProgressAfterWin();
      if (!game.levelCompleteCoinReward.hidden) throw new Error('Repeat clear displayed another coin reward');
      game.apiFetchWithAuthRetry = realProgressApi;
      game.gameWon = false;
      game.levelCompleteModal.classList.remove('active');
      if (JSON.stringify(game.LEVELS) !== originalLevels) throw new Error('Gameplay mutated level data');
      return { loaded, levels: game.LEVELS.length, movesAndUndo: true, replay: true };
    })()`);
    assert.ok(result.loaded); assert.ok(result.movesAndUndo); assert.ok(result.replay);
    console.log('Game initialized:', result);
  }
  await evaluate('document.getElementById("restartLevelBtn").click()');
  await evaluate('document.getElementById("blockTipToggle").click()');
  await evaluate('if (document.getElementById("blockTipModal")) throw new Error("Obsolete Hint modal still mounted");');
  await evaluate('document.getElementById("portalButton").click()');
  await until('!document.body.classList.contains("in-game")');
  await evaluate('document.getElementById("bgMusic").currentTime = 17; document.getElementById("startButton").click()');
  await until('document.body.classList.contains("in-game")');
  assert.deepEqual(await evaluate('window.__musicStarts'), [0, 0], 'Starting again from home restarts the music');
  await evaluate('document.getElementById("musicToggle").click(); document.getElementById("portalButton").click()');
  await until('!document.body.classList.contains("in-game")');
  await evaluate('document.getElementById("bgMusic").currentTime = 23; document.getElementById("startButton").click()');
  await until('document.body.classList.contains("in-game")');
  assert.deepEqual(await evaluate('window.__musicStarts'), [0, 0], 'Starting while muted never requests playback');
  assert.equal(await evaluate('document.getElementById("bgMusic").currentTime'), 0);
  assert.equal(await evaluate('document.getElementById("bgMusic").muted'), true);
  await evaluate('document.getElementById("portalButton").click()');
  await until('!document.body.classList.contains("in-game")');
  await evaluate('delete document.getElementById("bgMusic").play; delete window.__musicStarts');
  console.log('Game start, level selection, restart, hint and return home passed.');
  await command('Page.navigate', { url: base + '/editor.html' });
  await until('document.getElementById("editorLevelsSelect")?.options.length > 0');
  if (!production) {
    const result = await evaluate(`(async () => {
      const { game } = await import('/src/game/runtime.js');
      const select = document.getElementById('editorLevelsSelect');
      select.value = '0';
      document.getElementById('editorLoadLevelsBtn').click();
      const before = game.board[0][0];
      game.editMode = 'block';
      game.cmEditorOnEditCell(0, 0);
      if (game.board[0][0] !== game.CELL_TYPES.SOLID_BLOCK) throw new Error('Editor placement failed');
      document.getElementById('editorUndoBtn').click();
      if (game.board[0][0] !== before) throw new Error('Editor undo failed');
      let copied;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: text => { copied = text; return Promise.resolve(); } } });
      document.getElementById('copyLevelsJsBtn').click();
      await Promise.resolve();
      const exported = JSON.parse(copied.trim().replace(/,$/, ''));
      if (!exported.players.length || JSON.stringify(exported.board) !== JSON.stringify(game.board)) throw new Error('Editor export failed');
      game.drawBoard();
      return { editor: game.CM_EDITOR_PAGE, players: game.players.length, editingAndExport: true };
    })()`);
    assert.equal(result.editor, true); assert.ok(result.players > 0);
    console.log('Editor initialized:', result);
    const remounted = await evaluate(`(async () => {
      const runtime = await import('/src/game/runtime.js');
      const previous = runtime.game;
      window.dispatchEvent(new Event('pagehide'));
      const { initializeGame } = await import('/src/game/initialize.js');
      const { initializeEditor } = await import('/src/editor/tools.js');
      const dispose = initializeGame({ editor: true });
      initializeEditor(runtime.game);
      runtime.game.loadPuzzle(runtime.game.LEVELS[0]);
      const isolated = previous !== runtime.game && !previous.lifecycle.active;
      dispose();
      const disposeAgain = initializeGame({ editor: true });
      dispose();
      const active = runtime.game.lifecycle.active;
      disposeAgain();
      return isolated && active;
    })()`);
    assert.equal(remounted, true);
    console.log('Engine disposal, isolated state and remount passed.');
  }
  await delay(200);
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  if (artifactDir) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'passed.png'), Buffer.from(screenshot.data, 'base64'));
  }
  console.log(`${production ? 'Production' : 'Development'} browser smoke checks passed.`);
} catch (error) {
  if (artifactDir) {
    fs.writeFileSync(path.join(artifactDir, 'failure.txt'), `${error.stack || error}\n${errors.join('\n')}`, 'utf8');
    if (command && socket?.readyState === WebSocket.OPEN) {
      try {
        const screenshot = await command('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(artifactDir, 'failed.png'), Buffer.from(screenshot.data, 'base64'));
        const dom = await command('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        fs.writeFileSync(path.join(artifactDir, 'failed.html'), dom.result.value || '', 'utf8');
      } catch (diagnosticError) {
        fs.appendFileSync(path.join(artifactDir, 'failure.txt'), `\nDiagnostics: ${diagnosticError.message}`, 'utf8');
      }
    }
  }
  throw error;
} finally {
  clearTimeout(deadline);
  if (artifactDir) {
    fs.writeFileSync(path.join(artifactDir, 'server.log'), serverOutput, 'utf8');
    fs.writeFileSync(path.join(artifactDir, 'browser.log'), browserOutput, 'utf8');
    fs.writeFileSync(path.join(artifactDir, 'console.json'), JSON.stringify(errors, null, 2), 'utf8');
  }
  socket?.close();
  browser.kill(); server.kill();
  const tempPrefix = path.resolve(os.tmpdir()) + path.sep + 'chessmater-browser-';
  if (!path.resolve(profile).startsWith(tempPrefix)) throw new Error('Unexpected browser cleanup path.');
  // Give Chrome time to release Windows profile locks before cleaning up.
  for (let attempt = 0; attempt < 20; attempt++) {
    await delay(200);
    try { fs.rmSync(profile, { recursive: true, force: true }); break; }
    catch (error) { if (attempt === 19) console.error(`Could not remove browser profile ${profile}: ${error.message}`); }
  }
}
