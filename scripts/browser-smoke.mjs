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
const port = production ? 5284 : 5283;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, production ? ['server.js'] : ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  windowsHide: true, stdio: 'pipe', env: { ...process.env, PORT: String(port) },
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
      if (String(url).startsWith('http://127.0.0.1:3000')) return Promise.resolve(new Response(JSON.stringify({
        success: true, maxUnlocked: 999, undoCredits: 10, antigravityCredits: 10, best_moves: null, best_path: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return originalFetch(url, options);
    };
  ` });
  await command('Page.navigate', { url: base });
  await until('document.querySelectorAll(".level-button").length > 0');
  assert.ok(await evaluate('document.querySelectorAll(".level-button").length > 30'));
  await evaluate('document.getElementById("startButton").click()');
  await until('document.body.classList.contains("in-game")');
  if (!production) {
    const result = await evaluate(`(async () => {
      const { game } = await import('/src/game/runtime.js');
      const loaded = game.currentPuzzleData?.name;
      // Exercise every shipped level, including special tiles and replay drawing.
      const originalLevels = JSON.stringify(game.LEVELS);
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
      const initial = game.buildCurrentReplaySnapshot();
      const counterPath = [initial,
        { ...initial, move: { systemEvent: 'toggle_antigravity', antigravityApplied: true } },
        { ...initial, move: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } } },
      ];
      game.updateFewestOtherMovesDisplay(1, counterPath, 'Smoke test', true);
      game.inGameWalkthroughModal.classList.add('active');
      game.drawInGameWalkthroughSnapshot(0);
      game.stepReplayNavigation('next');
      if (game.inGameWalkthroughStep.textContent !== 'Action: 1/2 · Moves: 0/1') throw new Error('Hint antigravity counters failed');
      game.stepReplayNavigation('next');
      if (game.inGameWalkthroughStep.textContent !== 'Action: 2/2 · Moves: 1/1') throw new Error('Hint move counters failed');
      game.stepReplayNavigation('prev');
      if (game.inGameWalkthroughStep.textContent !== 'Action: 1/2 · Moves: 0/1') throw new Error('Hint reverse navigation failed');
      game.inGameWalkthroughModal.classList.remove('active');
      game.levelCompleteModal.classList.add('active');
      game.drawLevelCompleteReplaySnapshot(0);
      game.stepReplayNavigation('next');
      if (game.levelCompleteReplayStep.textContent !== 'Action: 1/2 · Moves: 0/1') throw new Error('Completion antigravity counters failed');
      game.stepReplayNavigation('next');
      if (game.levelCompleteReplayStep.textContent !== 'Action: 2/2 · Moves: 1/1') throw new Error('Completion move counters failed');
      game.levelCompleteModal.classList.remove('active');
      const board = Array.from({ length: 4 }, (_, row) => Array(6).fill(row === 3 ? game.CELL_TYPES.SOLID_BLOCK : 0));
      game.loadPuzzle({ name: 'Smoke test', rows: 4, cols: 6, board, players: [{ row: 2, col: 0, pieceType: 'rook' }], goal: { row: 2, col: 5 }, objectives: [], bombs: [] });
      game.gravityEnabled = false;
      if (!game.isValidMove(0, 2, 1)) throw new Error('Rook move rejected');
      game.movePlayer(0, 2, 1);
      if (game.levelMoveCount !== 1 || game.players[0].col !== 1) throw new Error('Move did not update state');
      await game.syncUndoCreditsFromServer();
      await game.undoMove();
      if (game.levelMoveCount !== 0 || game.players[0].col !== 0) throw new Error('Undo did not restore state');
      game.restartLevel();
      if (game.currentPuzzleData.name !== 'Smoke test' || game.players[0].col !== 0) throw new Error('Restart failed');
      await game.openUndoExchangeModal();
      game.closeUndoExchangeModal();
      await game.openAntigravityExchangeModal();
      game.closeAntigravityExchangeModal();
      game.loadPuzzle(game.LEVELS[0]);
      if (JSON.stringify(game.LEVELS) !== originalLevels) throw new Error('Gameplay mutated level data');
      return { loaded, levels: game.LEVELS.length, movesAndUndo: true, replay: true };
    })()`);
    assert.ok(result.loaded); assert.ok(result.movesAndUndo); assert.ok(result.replay);
    console.log('Game initialized:', result);
  }
  await evaluate('document.getElementById("restartLevelBtn").click()');
  await evaluate('document.getElementById("blockTipToggle").click()');
  await until('document.getElementById("blockTipModal").classList.contains("active")');
  await evaluate('document.getElementById("blockTipModal").classList.remove("active")');
  await evaluate('document.getElementById("portalButton").click()');
  await until('!document.body.classList.contains("in-game")');
  console.log('Game start, level selection, restart, hint and return home passed.');
  await command('Page.navigate', { url: base + '/editor.html' });
  await until('document.getElementById("editorLevelsSelect")?.options.length > 30');
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
