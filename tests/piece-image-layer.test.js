import test from 'node:test';
import assert from 'node:assert/strict';
import { installPieceImageLayer } from '../src/game/pieceImageLayer.js';
import { createLifecycle } from '../src/game/lifecycle.js';

function fixture() {
  const node = () => ({ style: { cssText: '' }, children: [], hidden: false,
    appendChild(child) { this.children.push(child); child.parent = this; return child; },
    setAttribute() {}, remove() { this.parent.children = this.parent.children.filter(child => child !== this); } });
  const doc = { createElement: node }, parent = node(), draws = [];
  const canvas = { ownerDocument: doc, parentElement: parent, width: 800, height: 600, clientWidth: 400, clientHeight: 300, offsetLeft: 20, offsetTop: 12 };
  const ctx = { drawImage: (...args) => draws.push(args), globalAlpha: .5, filter: 'none', getTransform: () => ({ a: 0, b: 1, c: -1, d: 0, e: 200, f: 40 }) };
  const lifecycle = createLifecycle({}), game = { canvas, ctx, lifecycle };
  const native = ctx.drawImage;
  const layer = installPieceImageLayer(game);
  return { game, canvas, ctx, lifecycle, layer, parent, draws, native };
}

test('all chess artwork uses image elements while other drawing stays on canvas', () => {
  const { ctx, layer, parent, draws, lifecycle } = fixture();
  layer.beginFrame();
  for (const piece of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn', 'dark-king']) {
    ctx.drawImage({ src: `/assets/images/game/piece-${piece}.svg` }, 8, 12, 84, 84);
  }
  assert.equal(parent.children[0].children[0].children.length, 7);
  const sprite = parent.children[0].children[0].children[0];
  assert.equal(sprite.children[0].src, '/assets/images/game/piece-king.svg');
  assert.ok(sprite.style.cssText.includes('matrix(0, 1, -1, 0, 188, 48)'));
  assert.ok(parent.children[0].children[0].style.cssText.includes('scale(0.5, 0.5)'));
  assert.ok(parent.children[0].style.cssText.includes('width: 400px; height: 300px;'));
  ctx.drawImage({ src: '/assets/images/game/tile-light.webp' }, 0, 0, 100, 100);
  assert.equal(draws.length, 1);
  lifecycle.dispose();
});

test('a new frame clears stale pieces and preserves goal badges and menu occlusion', () => {
  const { ctx, layer, parent, lifecycle, native } = fixture();
  layer.beginFrame();
  ctx.drawImage({ src: '/assets/images/game/piece-dark-king.svg' }, 8, 12, 84, 84);
  layer.decorateGoal(true, 2);
  const sprite = parent.children[0].children[0].children[0];
  assert.equal(sprite.children[1].hidden, false);
  assert.equal(sprite.children[2].textContent, '2');
  layer.occludeRect(180, 40, 100, 100);
  assert.equal(sprite.hidden, true);
  layer.beginFrame();
  ctx.drawImage({ src: '/assets/images/game/piece-rook.svg' }, 8, 12, 84, 84);
  layer.decorateCastle();
  assert.equal(sprite.children[1].hidden, true);
  assert.equal(sprite.children[3].hidden, false);
  assert.equal(sprite.children[0].src, '/assets/images/game/piece-rook.svg');
  lifecycle.dispose();
  assert.equal(parent.children.length, 0);
  assert.equal(ctx.drawImage, native);
});
