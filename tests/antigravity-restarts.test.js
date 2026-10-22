import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register as registerInput } from '../src/game/engine/input.js';
import { register as registerRules } from '../src/game/engine/rules.js';

test('restarting keeps paid antigravity access, while a new level visit requires another credit', async t => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else delete globalThis.document;
  });
  globalThis.document = { getElementById: () => null };
  let consumed = 0;
  const puzzle = { name: 'First', rows: 1, cols: 1, board: [[0]] };
  const otherPuzzle = { ...puzzle, name: 'Second' };
  const game = {
    CELL_TYPES: { EMPTY: 0 }, LEVELS: [puzzle, otherPuzzle],
    fallingPieces: [], risingPieces: [], antigravityCredits: 1,
    resizeBoard(rows, cols) {
      this.visitedSquares = Array.from({ length: rows }, () => Array(cols).fill(false));
    },
    consumeAntigravityCredit: async () => { consumed++; game.antigravityCredits--; return true; },
    updateStatus(message) { assert.ok(!message.startsWith('Error loading puzzle:'), message); },
    openAntigravityExchangeModal() { assert.fail('Unlocked access must work at zero credits'); },
  };
  for (const method of ['updatePlayerCount', 'updateObjectiveCount', 'updateTargetPieceCount',
    'resetHintForRun', 'updateMoveCountDisplay', 'updateAntigravityButtonLabel',
    'updateFewestOtherMovesDisplay', 'resetCurrentLevelMoveTrace', 'fetchFewestOtherMovesForCurrentLevel',
    'drawBoard', 'tryCapturePendingMoveTrace', 'queueSystemTraceCapture', 'applyGravity', 'applyAntigravity']) {
    game[method] = () => {};
  }
  registerInput(game);
  registerRules(game);
  game.loadPuzzle(puzzle);
  await game.toggleAntigravity();
  assert.equal(consumed, 1);
  assert.equal(game.antigravityEnabled, true);

  for (let restart = 0; restart < 2; restart++) {
    game.restartLevel();
    assert.equal(game.antigravityEnabled, false);
    assert.equal(game.antigravityUnlockedThisRun, true);
    await game.toggleAntigravity();
    assert.equal(game.antigravityEnabled, true);
    assert.equal(consumed, 1);
    assert.equal(game.antigravityCredits, 0);
  }

  game.loadPuzzle(otherPuzzle);
  assert.equal(game.antigravityUnlockedThisRun, false);
  game.loadPuzzle(puzzle);
  assert.equal(game.antigravityUnlockedThisRun, false);
  game.antigravityCredits = 1;
  await game.toggleAntigravity();
  assert.equal(consumed, 2);
});
