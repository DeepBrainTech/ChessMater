import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const executable = process.env.CHESSMATER_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(file => fs.existsSync(file));
if (!executable) throw new Error('Set CHESSMATER_BROWSER to a Chromium browser executable.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chessmater-browser-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const production = process.argv.includes('--production');
const port = Number(process.env.CHESSMATER_SMOKE_PORT) || (production ? 5284 : 5283);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, production ? ['server.js'] : ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  windowsHide: true, stdio: 'pipe', env: { ...process.env, PORT: String(port),
    VITE_API_BASE_URL: 'http://127.0.0.1:3001', VITE_PORTAL_API_BASE_URL: 'http://127.0.0.1:8000' },
});
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base)).ok && fs.existsSync(path.join(profile, 'DevToolsActivePort'))) break; } catch {}
    if (server.exitCode !== null) throw new Error(serverOutput);
    await delay(100);
  }
  const debugPort = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error))); else resolve(data.result);
    }
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      errors.push(data.params.args.map(arg => arg.description || arg.value || '').join(' '));
    }
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error('Timed out: ' + expression + '\n' + errors.join('\n'));
  };
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    // Keep smoke checks deterministic without a running database or paid Portal session.
    const originalFetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      const requestUrl = String(url);
      const user = { id: 42, user_id: 42, portal_user_id: '42', username: 'browser-smoke' };
      const target = new URL(requestUrl, location.href);
      const local = ['localhost', '127.0.0.1'].includes(target.hostname);
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
  await evaluate('document.getElementById("startButton").click()');
  await until('document.body.classList.contains("in-game")');
  if (!production) {
    const result = await evaluate(`(async () => {
      const { game } = await import('/src/game/runtime.js');
      const loaded = game.currentPuzzleData?.name;
      // Exercise every shipped level, including special tiles and replay drawing.
      const originalLevels = JSON.stringify(game.LEVELS);
      document.getElementById('styleTestLevelButton').click();
      if (game.mode !== 'style-test' || game.ROWS !== 11) throw new Error('Updated Test board did not load');
      if (game.currentPuzzleData.samples.length !== 76) throw new Error('Test element samples are incomplete');
      if (!game.targetPieces.some(piece => piece.captured)) throw new Error('Captured target preview is missing');
      const testRect = game.canvas.getBoundingClientRect();
      for (const sample of game.currentPuzzleData.samples) {
        game.handleMove({
          clientX: testRect.left + (sample.col + .5) * game.TILE_SIZE * testRect.width / game.canvas.width,
          clientY: testRect.top + (sample.row + .5) * game.TILE_SIZE * testRect.height / game.canvas.height,
        });
        if (game.styleTestSelectedCell?.row !== sample.row || game.styleTestSelectedCell?.col !== sample.col) throw new Error('Test sample cannot be inspected');
      }
      for (const level of game.LEVELS) {
        game.loadPuzzle(level);
        if (!game.currentPuzzleData || game.board.length !== level.rows) throw new Error('Level failed: ' + level.name);
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
  console.log(`${production ? 'Production' : 'Development'} browser smoke checks passed.`);
} finally {
  socket?.close();
  browser.kill(); server.kill();
  // Chromium profile lives in the OS temp directory and is kept if still locked.
  await delay(200);
  const tempPrefix = path.resolve(os.tmpdir()) + path.sep + 'chessmater-browser-';
  if (!path.resolve(profile).startsWith(tempPrefix)) throw new Error('Unexpected browser cleanup path.');
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
