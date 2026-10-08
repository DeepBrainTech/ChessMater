import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../src/game/engine/replay.js';

test('replay pieces have a fallback while their sprite is unavailable', () => {
  const game = { pieceImages: { rook: { complete: false } } };
  register(game);
  const labels = [];
  const context = { beginPath() {}, arc() {}, fill() {}, fillText(text) { labels.push(text); } };
  game.drawReplayPlayerPiece(context, 'rook', 0, 0, 0, 0, 40);
  assert.deepEqual(labels, ['R']);
});

test('black replay targets use the recorded piece type at their board cell', () => {
  const game = { CELL_TYPES: { BLACK_TARGET_PIECE: 99 }, drawBlackTargetPiece: (...args) => drawn.push(args) };
  const drawn = [];
  register(game);
  const target = { row: 2, col: 3, pieceType: 'bishop', captured: false };
  game.drawReplayCellDecoration({}, 99, 120, 80, 40, 2, 3, [target]);
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0].at(-1), 'bishop');
});
