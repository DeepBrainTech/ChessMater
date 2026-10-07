const fs = require('node:fs');
const path = require('node:path');
const browserCode = fs.readFileSync(path.join(__dirname, '../public/js/game/00-portal-commerce.js'), 'utf8');
const gameKey = 'chessmater';
const itemId = 'chess_mater_undo';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

function setup(storage = new Map()) {
  let userId = 42;
  let portalUserId = 42;
  let loseResponse = false;
  let failServer = false;
  let posts = 0;
  let charges = 0;
  const requests = [];
  const completed = new Map();
  const context = {
    window: {}, URLSearchParams, Error, Date, Map, Set, Number, JSON, atob,
    crypto: { randomUUID },
    sessionStorage: { getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (url, options) => {
      assert.equal(options.credentials, 'include');
      assert.equal(options.cache, 'no-store');
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/session')) {
        return { ok: true, json: async () => ({ success: true, data: { user: { id: portalUserId } } }) };
      }
      assert.equal(options.method, 'POST');
      assert.equal(options.headers?.Authorization, undefined);
      const body = options.body ? JSON.parse(options.body) : null;
      const id = body?.request_id ?? parsed.searchParams.get('request_id');
      assert.match(id, /^[0-9a-f-]{36}$/);
      requests.push({ id, url, body });
      posts++;
      if (failServer) return { ok: false, status: 503, json: async () => ({ detail: 'temporarily_unavailable' }) };
      const key = userId + ':' + id;
      if (!completed.has(key)) {
        charges++;
        completed.set(key, { inventory_quantity: 1, grant_token: 'signed-grant', purchase_id: id });
      }
      if (loseResponse) { loseResponse = false; throw new Error('response lost'); }
      return { ok: true, json: async () => ({ success: true, data: completed.get(key) }) };
    },
  };
  vm.runInNewContext(browserCode, context);
  const client = new context.window.PortalInventoryClient('https://portal.test', gameKey, () => userId);
  return { client, requests, storage, get posts() { return posts; }, get charges() { return charges; },
    lose: () => { loseResponse = true; }, fail: value => { failServer = value; },
    switchGameUser: value => { userId = value; }, switchPortalUser: value => { portalUserId = value; } };
}

test('redemption retry reuses UUID and a new action generates a new UUID', async () => {
  const f = setup();
  f.lose();
  await assert.rejects(f.client.buyItem(itemId), /response lost/);
  await f.client.buyItem(itemId);
  assert.equal(f.requests[0].id, f.requests[1].id);
  assert.equal(f.charges, 1);
  const url = new URL(f.requests[0].url);
  assert.equal(url.pathname, '/api/user/shop/redeem');
  assert.equal(url.searchParams.get('game_mode'), gameKey);
  assert.equal(url.searchParams.get('item_id'), itemId);
  await f.client.buyItem(itemId);
  assert.notEqual(f.requests[1].id, f.requests[2].id);
  assert.equal(f.charges, 2);
});

test('pending consumption survives reload and a 503 does not replace its UUID', async () => {
  const f = setup();
  f.lose();
  await assert.rejects(f.client.useItem(itemId), /response lost/);
  const originalId = f.requests[0].id;
  const reloaded = setup(f.storage);
  assert.equal(reloaded.client.hasPendingUse(itemId), true);
  reloaded.fail(true);
  await assert.rejects(reloaded.client.useItem(itemId), /temporarily_unavailable/);
  assert.equal(reloaded.requests[0].id, originalId);
  reloaded.fail(false);
  await reloaded.client.useItem(itemId);
  assert.equal(reloaded.requests[1].id, originalId);
  assert.equal(reloaded.client.hasPendingUse(itemId), false);
});

test('portal/game account mismatch prevents mutations and accounts have separate retry keys', async () => {
  const f = setup();
  f.switchPortalUser(43);
  await assert.rejects(f.client.buyItem(itemId), /portal_account_mismatch/);
  assert.equal(f.posts, 0);
  f.switchPortalUser(42);
  f.lose();
  await assert.rejects(f.client.buyItem(itemId));
  const oldId = f.requests[0].id;
  f.switchGameUser(43);
  f.switchPortalUser(43);
  await f.client.buyItem(itemId);
  assert.notEqual(f.requests[1].id, oldId);
});

test('concurrent redemption attempts cannot post twice', async () => {
  const f = setup();
  const first = f.client.buyItem(itemId);
  await assert.rejects(f.client.buyItem(itemId), /operation_in_progress/);
  await first;
  assert.equal(f.posts, 1);
});

test('paid grant retries retain purchase UUID until the game confirms fulfillment', async () => {
  const f = setup();
  const first = await f.client.buyGrant('replay', 'level:7');
  const retry = await f.client.buyGrant('replay', 'level:7');
  assert.equal(first.purchase_id, retry.purchase_id);
  assert.equal(f.charges, 1);
  f.client.finishGrant('replay', 'level:7');
  const next = await f.client.buyGrant('replay', 'level:7');
  assert.notEqual(first.purchase_id, next.purchase_id);
});
