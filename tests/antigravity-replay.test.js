import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register as registerInput } from '../src/game/engine/input.js';
import { register as registerReplay } from '../src/game/engine/replay.js';

function setup() {
  const game = {
    ROWS: 3, COLS: 1, board: [[0], [0], [0]], players: [{ row: 0, col: 0 }],
    goal: { row: 2, col: 0 }, objectives: [], targetPieces: [],
    cloneGameData: structuredClone, fallingPieces: [], risingPieces: [],
    pendingMoveCounter: false, antigravityEnabled: true, antigravityUnlockedThisRun: true,
    updateAntigravityButtonLabel() {}, updateStatus() {},
  };
  registerInput(game);
  registerReplay(game);
  game.resetCurrentLevelMoveTrace();
  return game;
}

test('disabling antigravity captures the final goal position even when physics immediately wins', async () => {
  const game = setup();
  game.applyGravity = () => {
    game.players[0].row = game.goal.row;
    game.gameWon = true;
    game.tryCapturePendingMoveTrace(true);
  };
  await game.toggleAntigravity();
  const final = game.currentLevelMoveTrace.at(-1);
  assert.equal(final.players[0].row, final.goal.row);
  assert.equal(final.move.antigravityEnabled, false);
  assert.equal(final.antigravityEnabled, false);
  assert.deepEqual(game.buildReplayMoveCounts(game.currentLevelMoveTrace), [0, 0]);
});

test('switches without physical movement are still recorded', async () => {
  const game = setup();
  game.antigravityEnabled = false;
  game.applyAntigravity = () => false;
  await game.toggleAntigravity();
  game.tryCapturePendingMoveTrace(false);
  assert.equal(game.currentLevelMoveTrace.length, 2);
  assert.equal(game.currentLevelMoveTrace[1].move.antigravityEnabled, true);
});
