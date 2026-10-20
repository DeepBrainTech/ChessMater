import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../src/game/engine/commerce.js';
import { register as presentation } from '../src/game/engine/presentation.js';

function fixture() {
  let quantity = 3, consumed = 0, opens = 0, shops = 0;
  const game = {};
  register(game);
  const portal = {
    useItem: async (scope) => {
      assert.ok(scope);
      consumed++; quantity--; return { inventory_quantity: quantity };
    },
  };
  Object.assign(game, {
    hintRunId: crypto.randomUUID(), hintUnlockedThisRun: false,
    hintCredits: quantity, currentLevelIndex: 6, fewestOtherMovesForLevel: 9,
    fewestOtherMovesReplayPath: [{ board: [] }, { board: [] }], portalQuantities: {},
    PORTAL_HINT_ITEM_ID: 'chess_mater_reply', getPortalCommerce: () => portal,
    syncGameInventory: async () => { game.hintCredits = quantity; },
    consumeLocalHintCredit: (...args) => portal.useItem(...args),
    refreshFewestOtherMovesAffordance: () => {}, updateFewestOtherMovesDisplay: () => {},
    updateLevelCompleteReplayDisplay: () => {}, closeInGameWalkthroughModal: () => {},
    openInGameWalkthroughModal: () => { opens++; }, openPowerUpsShop: () => { shops++; },
    updateStatus: text => { game.status = text; },
  });
  return { game, portal, get consumed() { return consumed; }, get opens() { return opens; }, get shops() { return shops; } };
}

test('Hint consumes once per run; repeated views stay free even at zero inventory', async () => {
  const f = fixture();
  assert.equal(await f.game.useHintForCurrentRun(), true);
  f.game.hintCredits = 0;
  await f.game.useHintForCurrentRun(); await f.game.useHintForCurrentRun();
  assert.equal(f.consumed, 1); assert.equal(f.opens, 3);
  assert.equal(f.game.hintUnlockedThisRun, true); assert.equal(f.shops, 0);
});

test('restarts keep Hint access, while leaving and returning requires a fresh Hint', async () => {
  const f = fixture();
  await f.game.useHintForCurrentRun();
  const first = f.game.hintRunId;
  f.game.resetHintForRun({ preserve: true });
  assert.equal(f.game.hintRunId, first); assert.equal(f.game.hintUnlockedThisRun, true);
  await f.game.useHintForCurrentRun();
  assert.equal(f.consumed, 1);
  f.game.currentLevelIndex++; f.game.resetHintForRun();
  f.game.currentLevelIndex--; f.game.resetHintForRun();
  await f.game.useHintForCurrentRun(); assert.equal(f.consumed, 2);
});

test('a missing or incomplete guide does not consume inventory', async () => {
  const f = fixture(); f.game.fewestOtherMovesReplayPath = [{}];
  assert.equal(await f.game.useHintForCurrentRun(), false);
  f.game.fewestOtherMovesForLevel = null;
  assert.equal(await f.game.useHintForCurrentRun(), false); assert.equal(f.consumed, 0);
  assert.equal(f.opens, 2);
});

test('zero credits opens Power-Ups without consuming a Hint', async () => {
  const f = fixture(); f.game.hintCredits = 0;
  await f.game.useHintForCurrentRun(); assert.equal(f.shops, 1); assert.equal(f.consumed, 0);
});

test('concurrent clicks share one consumption', async () => {
  const f = fixture();
  await Promise.all([f.game.useHintForCurrentRun(), f.game.useHintForCurrentRun()]);
  assert.equal(f.consumed, 1); assert.equal(f.opens, 1);
});

test('a stale response cannot unlock a new level visit', async () => {
  const f = fixture(); let finish;
  f.portal.useItem = () => new Promise(resolve => { finish = resolve; });
  const pending = f.game.useHintForCurrentRun(); f.game.resetHintForRun();
  finish({ inventory_quantity: 2 }); await pending;
  assert.equal(f.game.hintUnlockedThisRun, false); assert.equal(f.opens, 0);
});

test('failed consumption stays locked and can retry; empty inventory opens the shop', async () => {
  const f = fixture(); const success = f.portal.useItem;
  f.portal.useItem = async () => { throw new Error('response lost'); };
  await f.game.useHintForCurrentRun();
  assert.equal(f.game.hintUnlockedThisRun, false); assert.equal(f.game.hintUsePromise, null);
  f.portal.useItem = success; await f.game.useHintForCurrentRun();
  assert.equal(f.game.hintUnlockedThisRun, true);
  f.game.resetHintForRun();
  f.portal.useItem = async () => { throw { code: 'insufficient_inventory' }; };
  await f.game.useHintForCurrentRun();
  assert.equal(f.shops, 1); assert.equal(f.game.hintUnlockedThisRun, false);
});

test('completion screen shares this run allowance and does not open another walkthrough', async () => {
  const f = fixture(); f.game.levelCompleteModal = { classList: { contains: () => true } };
  await f.game.useHintForCurrentRun(); await f.game.useHintForCurrentRun();
  assert.equal(f.consumed, 1); assert.equal(f.opens, 0);
});

test('a lost final-credit response can retry the same run even after balance reaches zero', async () => {
  const f = fixture(); const scopes = [];
  f.game.consumeLocalHintCredit = async scope => {
    scopes.push(scope);
    if (scopes.length === 1) throw new Error('lost response');
  };
  f.game.syncGameInventory = async () => { f.game.hintCredits = 0; };
  await f.game.useHintForCurrentRun();
  assert.equal(f.game.hintCredits, 0);
  assert.equal(await f.game.useHintForCurrentRun(), true);
  assert.equal(scopes[0], scopes[1]);
  assert.equal(f.shops, 0);
});

test('record refresh cannot import historical permanent access or clear this run allowance', () => {
  const game = {}; presentation(game);
  Object.assign(game, { sanitizeReplayPath: path => path, buildReplayMoveCounts: () => [],
    refreshFewestOtherMovesAffordance: () => {}, updateLevelCompleteStatsDisplay: () => {}, updateLevelCompleteReplayDisplay: () => {} });
  game.hintUnlockedThisRun = false; game.updateFewestOtherMovesDisplay(3, [], 'test', true);
  assert.equal(game.hintUnlockedThisRun, false);
  game.hintUnlockedThisRun = true; game.updateFewestOtherMovesDisplay(2, [], 'new best', false);
  assert.equal(game.hintUnlockedThisRun, true);
});
