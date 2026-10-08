import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLifecycle } from '../src/game/lifecycle.js';

test('disposing a board removes listeners and cancels pending animation, timers and observers', () => {
  let nextId = 0, disconnected = false, removed = false, events = 0;
  const frames = new Map(), timers = new Map(), intervals = new Map();
  const host = {
    requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: callback => { const id = ++nextId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: callback => { const id = ++nextId; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id),
    MutationObserver: class { disconnect() { disconnected = true; } },
  };
  const lifecycle = createLifecycle(host), target = new EventTarget();
  lifecycle.listen(target, 'click', () => events++);
  target.dispatchEvent(new Event('click'));
  assert.equal(events, 1);
  lifecycle.requestAnimationFrame(() => events++);
  lifecycle.setTimeout(() => events++, 0);
  lifecycle.setInterval(() => events++, 0);
  new lifecycle.MutationObserver(() => events++);
  lifecycle.trackNode({ remove() { removed = true; } });
  const queuedFrame = [...frames.values()][0];
  lifecycle.dispose();
  lifecycle.dispose();
  target.dispatchEvent(new Event('click'));
  queuedFrame(0);
  assert.equal(events, 1);
  assert.equal(frames.size + timers.size + intervals.size, 0);
  assert.equal(disconnected, true);
  assert.equal(removed, true);
  assert.equal(lifecycle.requestAnimationFrame(() => events++), 0);
});

test('disposing restores property handlers without overwriting a later owner', () => {
  const lifecycle = createLifecycle({});
  const previous = () => {}, current = () => {}, newer = () => {};
  const first = { onclick: previous }, second = { onclick: previous };
  lifecycle.setHandler(first, 'onclick', current);
  lifecycle.setHandler(second, 'onclick', current);
  second.onclick = newer;
  lifecycle.dispose();
  assert.equal(first.onclick, previous);
  assert.equal(second.onclick, newer);
});
