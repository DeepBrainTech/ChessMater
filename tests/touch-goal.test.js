import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register as rules } from '../src/game/engine/rules.js';
import { register as input } from '../src/game/engine/input.js';
import { register as replay } from '../src/game/engine/replay.js';

function setup(ready = true) {
  const noop = () => {};
  const game = {
    ROWS: 3, COLS: 1, TILE_SIZE: 50, board: [[0], [3], [2]],
    players: [{ row: 2, col: 0, pieceType: 'king' }], goal: { row: 1, col: 0 },
    objectives: [], targetPieces: [], cloneGameData: structuredClone,
    fallingPieces: [], risingPieces: [], pendingMoveCounter: false,
    antigravityEnabled: true, gravityEnabled: true, levelMoveCount: 0,
    CELL_TYPES: { EMPTY: 0, PLAYER: 2, GOAL: 3 }, visitedSquares: [[false], [false], [true]],
    currentPuzzleData: {},
    updateStatus: noop, updateMoveCountDisplay: noop, saveUndoSnapshot: noop,
    getActiveLaserHitOnMove: () => null, collectObjectivesAlongMove: noop,
    getDuckAt: () => -1, checkObjectiveCompletion: noop,
    triggerConfetti: noop, showLevelCompleteModal: noop,
  };
  rules(game); input(game); replay(game);
  game.isValidMove = () => true;
  game.areAllObjectivesCompleted = () => ready;
  game.syncProgressAfterWin = () => { game.savedTrace = structuredClone(game.currentLevelMoveTrace); };
  game.resetCurrentLevelMoveTrace();
  return game;
}

test('touching an unlocked king wins before antigravity and saves the contact frame', () => {
  const game = setup();
  game.movePlayer(0, 1, 0);
  assert.equal(game.gameWon, true);
  assert.equal(game.players[0].row, game.goal.row);
  assert.deepEqual(game.risingPieces, []);
  assert.equal(game.savedTrace.at(-1).players[0].row, game.goal.row);
  assert.equal(game.savedTrace.at(-1).move.to.row, game.goal.row);
  assert.equal(game.levelMoveCount, 1);
  assert.equal(game.applyAntigravity(), false);
  game.applyGravity();
  assert.deepEqual(game.fallingPieces, []);
  game.updateRisingPieces(999);
  assert.equal(game.players[0].row, game.goal.row);
});

test('a physics finish with no pending move still saves a terminal contact frame once', () => {
  const game = setup();
  game.players[0].row = game.goal.row;
  game.checkWinCondition();
  const final = game.savedTrace.at(-1);
  assert.equal(final.move.systemEvent, 'goal_reached');
  assert.equal(final.players[0].row, final.goal.row);
  game.captureWinningReplaySnapshot();
  assert.equal(game.currentLevelMoveTrace.length, 2);
});

test('touching the king before completing requirements does not win', () => {
  const game = setup(false);
  game.players[0].row = game.goal.row;
  game.checkWinCondition();
  assert.notEqual(game.gameWon, true);
  assert.equal(game.savedTrace, undefined);
});

test('celebration starts after the completion dialog opens and uses its position', () => {
  const game = setup();
  const dialog = {}, order = [];
  game.players[0].row = game.goal.row;
  game.levelCompleteModal = { querySelector: () => dialog };
  game.showLevelCompleteModal = () => order.push('dialog');
  game.triggerConfetti = options => { order.push('celebration'); assert.equal(options.target, dialog); };
  game.checkWinCondition();
  assert.deepEqual(order, ['dialog', 'celebration']);
});
