import test from 'node:test';
import assert from 'node:assert/strict';
import { installPieceMovementAnimation, interpolatePieceMove, playerDrawPosition } from '../src/game/pieceMovementAnimation.js';

test('ordinary movement interpolates in every direction', () => {
  for (const [row, col] of [[0, 0], [0, 2], [0, 4], [2, 0], [2, 4], [4, 0], [4, 2], [4, 4], [0, 1]]) {
    const move = { fromRow: 2, fromCol: 2, toRow: row, toCol: col };
    assert.deepEqual(interpolatePieceMove(move, 0, 50), { x: 100, y: 100 });
    assert.deepEqual(interpolatePieceMove(move, .5, 50), { x: (2 + col) * 25, y: (2 + row) * 25 });
    assert.deepEqual(interpolatePieceMove(move, 1, 50), { x: col * 50, y: row * 50 });
  }
});

function fixture(reduced = false) {
  let now = 0, id = 0;
  const timers = new Map(), committed = [];
  const game = { TILE_SIZE: 50, players: [{ row: 2, col: 2 }, { row: 2, col: 5 }],
    lifecycle: { setTimeout: callback => { timers.set(++id, callback); return id; }, clearTimeout: id => timers.delete(id) },
    movePlayer: (...args) => committed.push(args), castleKingWithRook: (...args) => committed.push(args) };
  installPieceMovementAnimation(game, { performance: { now: () => now }, matchMedia: () => ({ matches: reduced }) });
  return { game, timers, committed, setTime: value => { now = value; } };
}

test('movement finishes before applying movement rules and physics', () => {
  const { game, timers, committed, setTime } = fixture();
  assert.equal(game.startPlayerMoveAnimation(0, 0, 4), true);
  assert.equal(committed.length, 0);
  assert.deepEqual(game.players[0], { row: 2, col: 2 });
  setTime(game.pieceMoveAnimation.duration / 2);
  assert.deepEqual(playerDrawPosition(game, game.players[0]), { x: 150, y: 50 });
  assert.equal(game.startPlayerMoveAnimation(0, 1, 1), true);
  assert.equal(timers.size, 1, 'Repeated input cannot queue a second move');
  [...timers.values()][0]();
  assert.equal(game.pieceMoveAnimation, null);
  assert.deepEqual(committed, [[0, 0, 4, { animate: false }]]);
});

test('restarting cancels movement and reduced motion skips animation', () => {
  const { game, timers, committed } = fixture();
  game.startPlayerMoveAnimation(0, 0, 4);
  game.cancelPieceMoveAnimation();
  assert.equal(timers.size, 0);
  assert.equal(game.pieceMoveAnimation, null);
  assert.equal(committed.length, 0);
  const reduced = fixture(true);
  assert.equal(reduced.game.startPlayerMoveAnimation(0, 0, 4), false);
  assert.equal(reduced.timers.size, 0);
});

test('castling animates king and rook together', () => {
  const { game, setTime, timers, committed } = fixture();
  game.startCastleAnimation(0, 1);
  setTime(game.pieceMoveAnimation.duration / 2);
  assert.deepEqual(playerDrawPosition(game, game.players[0]), { x: 150, y: 100 });
  assert.deepEqual(playerDrawPosition(game, game.players[1]), { x: 200, y: 100 });
  [...timers.values()][0]();
  assert.deepEqual(committed, [[0, 1, { animate: false }]]);
});
