import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../src/game/engine/commerce.js';

test('empty Undo and AntiGravity use the same shop with the relevant asset', async () => {
  const events = [], game = { cmEmitGameUi: event => events.push(event) };
  register(game);
  await game.openUndoExchangeModal();
  await game.openAntigravityExchangeModal();
  assert.deepEqual(events.map(({ type, asset }) => ({ type, asset })), [
    { type: 'openPowerUps', asset: 'undo' }, { type: 'openPowerUps', asset: 'antigravity' },
  ]);
});

test('zero Hint opens the shop without looking up a permanent entitlement', async () => {
  const events = [], game = {};
  register(game);
  Object.assign(game, { hintCredits: 0, currentLevelIndex: 2,
    cmEmitGameUi: event => events.push(event),
    getPortalCommerce: () => ({ hasPendingUse: () => false }),
  });
  await game.useHintForCurrentRun();
  assert.equal(events[0].asset, 'hint');
  assert.equal(events.length, 1);
});

test('purchases apply the signed delivery to ChessMater before acknowledging the portal', async () => {
  const game = {};
  register(game);
  const events = [];
  Object.assign(game, {
    getPortalCommerce: () => ({
      buyLocalItem: async () => { events.push('charge'); return { purchase_id: 'delivery', grant_token: 'signed' }; },
      finishLocalItem: () => events.push('finish'),
      acknowledgeDelivery: async () => events.push('ack')
    }),
    claimInventoryDelivery: async delivery => { assert.equal(delivery.grant_token, 'signed'); events.push('claim'); return { hintCredits: 3, undoCredits: 2, antigravityCredits: 1 }; }
  });
  assert.equal((await game.postPortalRedeemItem('chess_mater_utility_pack')).ok, true);
  assert.deepEqual(events, ['charge', 'claim', 'finish', 'ack']);
});

test('a failed local delivery remains unacknowledged for safe recovery', async () => {
  const game = {}, events = []; register(game);
  Object.assign(game, {
    getPortalCommerce: () => ({ buyLocalItem: async () => ({ grant_token: 'signed' }),
      finishLocalItem: () => events.push('finish'), acknowledgeDelivery: async () => events.push('ack') }),
    claimInventoryDelivery: async () => { throw new Error('offline'); }
  });
  assert.equal((await game.postPortalRedeemItem('chess_mater_reply')).ok, false);
  assert.deepEqual(events, []);
});

test('recovery imports old stock and unacknowledged deliveries without reading portal inventory totals', async () => {
  const game = {}, events = []; register(game); let acked = false;
  Object.assign(game, {
    getPortalCommerce: () => ({
      assertAccount: async () => {}, migrateInventory: async () => events.push('migrate'),
      pendingDeliveries: async () => ({ deliveries: acked ? [] : [{ purchase_id: 'old', item_id: 'chess_mater_reply', grant_token: 'receipt' }] }),
      finishLocalItem: (item, id) => events.push([item, id]),
      acknowledgeDelivery: async () => { acked = true; events.push('ack'); }
    }),
    claimInventoryDelivery: async () => events.push('local-claim')
  });
  assert.equal(await game.recoverInventoryDeliveries(), true);
  assert.deepEqual(events, ['migrate', 'local-claim', ['chess_mater_reply', 'old'], 'ack']);
});
