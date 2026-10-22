import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../src/game/engine/effects.js';
import { createLifecycle } from '../src/game/lifecycle.js';

function fixture() {
  const frames = new Map();
  let frameId = 0;
  const host = {
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const node = () => ({
    style: {}, children: [], removed: false,
    setAttribute() {},
    appendChild(child) { this.children.push(child); child.parent = this; return child; },
    remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
  });
  const doc = { createElement: node, body: node() };
  const board = Object.assign(node(), { ownerDocument: doc, getBoundingClientRect: () => ({ left: 500, top: 200, width: 407, height: 326 }) });
  const game = { playSound: () => assert.fail('Guide celebration must remain silent'),
    lifecycle: { requestAnimationFrame: () => assert.fail('Guide must own its animation lifecycle') } };
  register(game);
  return { game, board, doc, frames, lifecycle: createLifecycle(host) };
}

test('guide confetti stays inside its board, stays silent, and cancels on disposal', () => {
  const { game, board, doc, frames, lifecycle } = fixture();
  game.triggerConfetti({ target: board, lifecycle, contained: true, silent: true, count: 40, duration: 1500, origin: { x: .7, y: .625 } });
  assert.equal(doc.body.children.length, 0);
  assert.equal(board.children.length, 1);
  const confetti = board.children[0];
  assert.equal(confetti.className, 'confetti-container confetti-container--contained');
  assert.equal(confetti.children.length, 40);
  assert.equal(frames.size, 1);
  lifecycle.dispose();
  assert.equal(board.children.length, 0);
  assert.equal(frames.size, 0);
});

test('guide confetti removes itself when its short duration ends', t => {
  const { game, board, frames, lifecycle } = fixture();
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  game.triggerConfetti({ target: board, lifecycle, contained: true, silent: true, count: 40, duration: 1500 });
  now = 1501;
  const [id, frame] = frames.entries().next().value;
  frames.delete(id); frame();
  assert.equal(board.children.length, 0);
  assert.equal(frames.size, 0);
  lifecycle.dispose();
});

test('regular game celebrations keep their full-size effect and sound', t => {
  const { game, board, doc, frames, lifecycle } = fixture();
  const previousAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: class { constructor(src) { this.src = src; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerHeight: 1080 } });
  t.after(() => {
    if (previousAudio) Object.defineProperty(globalThis, 'Audio', previousAudio); else delete globalThis.Audio;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
    lifecycle.dispose();
  });
  let sounds = 0, streamers = 0, bursts = 0;
  game.canvas = board; game.lifecycle = lifecycle;
  game.playSound = (audio, volume) => { sounds++; assert.equal(audio.src, 'assets/audio/completion.mp3'); assert.equal(volume, .7); };
  game.addStreamers = () => streamers++;
  game.createInitialBurst = () => bursts++;
  game.triggerConfetti();
  assert.equal(doc.body.children[0].children.length, 150);
  assert.equal(board.children.length, 0);
  assert.equal(sounds, 1); assert.equal(streamers, 1); assert.equal(bursts, 1);
  assert.equal(frames.size, 1);
});
