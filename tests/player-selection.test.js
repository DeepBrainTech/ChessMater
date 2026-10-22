import test from 'node:test';
import assert from 'node:assert/strict';
import { ensurePlayerSelected } from '../src/game/playerSelection.js';
import { register as input } from '../src/game/engine/input.js';
import { register as render } from '../src/game/engine/render.js';

test('automatic selection keeps a valid piece and falls back when it disappears', () => {
  const game = { mode: 'play', players: [{}, {}], selectedPlayerIndex: -1 };
  assert.equal(ensurePlayerSelected(game), -1, 'Explicit deselection is preserved');
  assert.equal(ensurePlayerSelected(game, 0), 0);
  assert.equal(ensurePlayerSelected(game, 1), 1);
  assert.equal(ensurePlayerSelected(game), 1);
  game.players.pop();
  assert.equal(ensurePlayerSelected(game), 0);
  game.players.length = 0;
  assert.equal(ensurePlayerSelected(game), -1);
  game.mode = 'edit'; game.players.push({});
  assert.equal(ensurePlayerSelected(game), -1, 'Editor selection is unchanged');
});

test('board input allows consecutive moves and blocks input during physics', () => {
  const game = { mode: 'play', TILE_SIZE: 50, ROWS: 3, COLS: 4, players: [{ row: 2, col: 0 }, { row: 2, col: 3 }],
    selectedPlayerIndex: 0, fallingPieces: [], risingPieces: [],
    canvas: { width: 200, height: 150, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 150 }) },
    getPlayerAt: (row, col) => game.players.findIndex(p => p.row === row && p.col === col),
    isValidMove: () => true, updateStatus() {}, movePlayer: (index, row, col) => Object.assign(game.players[index], { row, col }) };
  input(game);
  game.handleMove({ clientX: 75, clientY: 125 });
  assert.equal(game.selectedPlayerIndex, 0);
  game.handleMove({ clientX: 125, clientY: 125 });
  assert.equal(game.players[0].col, 2, 'A second destination works without selecting again');
  game.fallingPieces.push({});
  game.handleMove({ clientX: 75, clientY: 75 });
  assert.equal(game.players[0].row, 2);
  game.fallingPieces.length = 0;
  game.handleMove({ clientX: 175, clientY: 125 });
  assert.equal(game.selectedPlayerIndex, 1, 'Clicking another piece switches selection');
  game.handleMove({ clientX: 175, clientY: 125 });
  assert.equal(game.selectedPlayerIndex, -1, 'Clicking the selected piece deselects it');
  game.handleMove({ clientX: 75, clientY: 75 });
  assert.equal(game.selectedPlayerIndex, -1, 'An empty cell does not automatically select a piece');
  assert.equal(game.players[0].col, 2);
  assert.equal(game.players[1].col, 3);
  game.handleMove({ clientX: 125, clientY: 125 });
  assert.equal(game.selectedPlayerIndex, 0, 'Any piece can be selected after deselecting');
});

test('move hints wait for landing and then use the selected piece position', () => {
  const markers = [];
  const game = { mode: 'play', TILE_SIZE: 50, ROWS: 3, COLS: 3, players: [{ row: 1, col: 1 }], selectedPlayerIndex: 0,
    fallingPieces: [{}], risingPieces: [], ctx: { save() {}, restore() {}, fillRect() {}, strokeRect() {} },
    isValidMove: (index, row, col) => row === game.players[index].row && col === 2 };
  render(game);
  game.drawPossibleMoveMarker = (x, y) => markers.push([x, y]);
  game.drawPossibleMoves();
  assert.deepEqual(markers, []);
  game.fallingPieces.length = 0; game.players[0].row = 2;
  game.drawPossibleMoves();
  assert.deepEqual(markers, [[100, 100]]);
  game.showTransformerMenu = true;
  game.drawPossibleMoves();
  assert.equal(markers.length, 1, 'Hints hide during transformation');
  game.showTransformerMenu = false;
  game.selectedPlayerIndex = -1;
  game.drawPossibleMoves();
  assert.equal(game.selectedPlayerIndex, -1, 'Rendering preserves deselection');
  assert.equal(markers.length, 1, 'Deselected pieces have no move hints');
});
