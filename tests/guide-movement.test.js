import test from 'node:test';
import assert from 'node:assert/strict';
import { guideLanding, guideMoves, guideRising, guideScene } from '../src/components/modals/guideBoard.js';

const floor = [15, 16, 17, 18, 19];
const piece = (pieceType, changes = {}) => ({ pieceType, row: 2, col: 2, hasMoved: false, ...changes });

test('guide antigravity raises every piece immediately and stops below obstacles', () => {
  for (const type of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
    const player = piece(type);
    const risen = guideRising(player, floor);
    assert.equal(risen.row, 0);
    assert.equal(guideLanding(risen, floor).row, 2);
    assert.equal(guideRising(player, [...floor, 7]).row, 2);
    assert.equal(guideRising(player, floor, 2).row, 1);
    assert.equal(risen.hasMoved, false, 'Switching gravity does not consume the first chess move');
  }
});

test('guide uses legal moves for all six chess pieces and excludes platforms', () => {
  const expected = {
    king: [6, 7, 8, 11, 13],
    queen: [0, 2, 4, 6, 7, 8, 10, 11, 13, 14],
    rook: [2, 7, 10, 11, 13, 14],
    bishop: [0, 4, 6, 8],
    knight: [1, 3, 5, 9],
    pawn: [2, 7],
  };
  for (const [type, moves] of Object.entries(expected)) assert.deepEqual(guideMoves(piece(type), floor), moves, type);
});

test('guide blocks sliding paths while allowing knight jumps', () => {
  assert.deepEqual(guideMoves(piece('rook'), [...floor, 7]), [10, 11, 13, 14]);
  assert.deepEqual(guideMoves(piece('knight'), [...floor, 7]), [1, 3, 5, 9]);
});

test('pawn keeps the real first-move and diagonal-target rules', () => {
  assert.deepEqual(guideMoves(piece('pawn', { hasMoved: true }), floor), [7]);
  assert.deepEqual(guideMoves(piece('pawn'), floor, 6), [2, 6, 7]);
  assert.deepEqual(guideMoves(piece('pawn'), [...floor, 7]), []);
});

test('all guide pieces fall onto the platform after moving', () => {
  for (const type of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
    const destination = piece(type, { row: 0, col: 1, hasMoved: true });
    assert.deepEqual(guideLanding(destination, floor), { ...destination, row: 2 });
    assert.equal(guideLanding(destination, [...floor, 6]).row, 0, 'A supporting platform stops the fall');
  }
  assert.equal(guideLanding(piece('king'), floor).row, 2, 'A supported piece stays in place');
});

test('every piece has a legal demonstration and a supported reachable target', () => {
  for (const type of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
    for (const page of [0, 2, 3]) {
      const { player, platforms, goal, destination } = guideScene(type, page);
      assert.ok(guideMoves(player, platforms, goal).includes(destination), `${type} page ${page + 1}`);
      if (page === 3) {
        const target = { ...player, row: Math.floor(goal / 5), col: goal % 5 };
        assert.equal(guideLanding(target, platforms, goal).row, target.row, 'The target must be supported');
      }
    }
    const { player, platforms } = guideScene(type, 1);
    assert.equal(guideLanding(player, platforms).row, player.row, 'Gravity practice starts supported');
    assert.ok(platforms.includes(15) && platforms.includes(19) && platforms.includes(11), 'The board has a full floor and an elevated platform');
    assert.ok(guideMoves(player, platforms).some(index => {
      const destination = { ...player, row: Math.floor(index / 5), col: index % 5 };
      return guideLanding(destination, platforms).row > destination.row;
    }), `${type} has a legal move followed by a fall`);
  }
});
