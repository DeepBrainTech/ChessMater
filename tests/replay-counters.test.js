import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../src/game/engine/replay.js';

const move = { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, pieceType: 'rook' };
const antigravity = { systemEvent: 'toggle_antigravity', antigravityApplied: true };

function setup(events, bestMoves = null) {
  const context = { clearRect() {}, fillRect() {}, strokeRect() {} };
  const canvas = { width: 100, height: 100, getContext: () => context };
  const game = {
    CELL_TYPES: {}, fewestOtherMovesForLevel: bestMoves,
    fewestOtherMovesReplayPath: events.map(move => ({ rows: 1, cols: 2, board: [[0, 0]], players: [], move })),
    levelCompleteReplayCanvas: canvas, inGameWalkthroughCanvas: canvas,
    levelCompleteReplayStep: {}, inGameWalkthroughStep: {},
    levelCompleteReplayEvent: {}, inGameWalkthroughEvent: {},
  };
  register(game);
  game.fewestOtherMovesReplayMoveCounts = game.buildReplayMoveCounts(game.fewestOtherMovesReplayPath);
  return game;
}

test('antigravity records do not borrow the following move number', () => {
  const game = setup([null, antigravity, move, antigravity, move], 2);
  assert.deepEqual(game.fewestOtherMovesReplayMoveCounts, [0, 0, 1, 1, 2]);
  for (const [index, moves] of game.fewestOtherMovesReplayMoveCounts.entries()) {
    game.drawInGameWalkthroughSnapshot(index);
    game.drawLevelCompleteReplaySnapshot(index);
    const expected = `Action: ${index}/4 · Moves: ${moves}/2`;
    assert.equal(game.inGameWalkthroughStep.textContent, expected);
    assert.equal(game.levelCompleteReplayStep.textContent, expected);
  }
  game.drawInGameWalkthroughSnapshot(1);
  assert.equal(game.inGameWalkthroughEvent.textContent, 'Antigravity enabled.');
  game.drawInGameWalkthroughSnapshot(2);
  assert.equal(game.inGameWalkthroughEvent.textContent, '');
});

test('consecutive antigravity records and an antigravity-only finish remain at zero moves', () => {
  const game = setup([null, antigravity, antigravity], 0);
  game.drawInGameWalkthroughSnapshot(2);
  assert.equal(game.inGameWalkthroughStep.textContent, 'Action: 2/2 · Moves: 0/0');
});

test('existing move-only recordings and a move with antigravity keep their move counts', () => {
  const game = setup([null, move, { ...move, antigravityApplied: true }]);
  assert.deepEqual(game.fewestOtherMovesReplayMoveCounts, [0, 1, 2]);
  game.drawLevelCompleteReplaySnapshot(2);
  assert.equal(game.levelCompleteReplayStep.textContent, 'Action: 2/2 · Moves: 2/2');
  assert.equal(game.levelCompleteReplayEvent.textContent, 'Antigravity applied after this move.');
  game.drawLevelCompleteReplaySnapshot(0);
  assert.equal(game.levelCompleteReplayStep.textContent, 'Action: 0/2 · Moves: 0/2');
});

test('an initial-only recording and legacy records without metadata remain navigable', () => {
  const game = setup([null]);
  game.drawInGameWalkthroughSnapshot(0);
  assert.equal(game.inGameWalkthroughStep.textContent, 'Action: 0/0 · Moves: 0/0');
  const legacy = setup([undefined, undefined], 1);
  legacy.drawInGameWalkthroughSnapshot(1);
  assert.equal(legacy.inGameWalkthroughStep.textContent, 'Action: 1/1 · Moves: 0/1');
  assert.deepEqual(game.buildReplayMoveCounts(null), []);
});
