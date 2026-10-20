const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { deliverLevelReward } = require('../level-rewards');

test('reward delivery signs only the server-fixed completion and confirms portal credit before acknowledgement', async () => {
  process.env.CHESSMATER_JWT_SECRET = 'isolated-level-reward-secret';
  let marked = false;
  const pool = { query: async sql => {
    if (sql.startsWith('UPDATE')) marked = true;
    return { rows: [{ level_index: 3 }] };
  } };
  assert.equal(await deliverLevelReward(pool, 42, 3, async (url, options) => {
    assert.equal(marked, false);
    assert.match(url, /\/api\/games\/chessmater\/level-rewards\/claim$/);
    const claims = jwt.verify(options.headers.Authorization.slice(7), process.env.CHESSMATER_JWT_SECRET,
      { audience: 'chessmater-level-reward', issuer: 'chessmater-game' });
    assert.equal(claims.user_id, '42');
    assert.equal(claims.level, 3);
    assert.equal(claims.purpose, 'first-clear-coins');
    return { ok: true, json: async () => ({ success: true, data: { coins: 200 } }) };
  }), true);
  assert.equal(marked, true);
});

test('already delivered levels do not contact the portal; failed deliveries remain pending', async () => {
  assert.equal(await deliverLevelReward({ query: async () => ({ rows: [] }) }, 42, 3,
    () => { throw new Error('must not call'); }), false);
  let writes = 0;
  const pending = { query: async sql => {
    if (sql.startsWith('UPDATE')) writes++;
    return { rows: [{ level_index: 3 }] };
  } };
  for (const result of [{ ok: false, success: false, coins: 200 }, { ok: true, success: true, coins: 999 }]) {
    await assert.rejects(deliverLevelReward(pending, 42, 3, async () => ({ ok: result.ok,
      json: async () => ({ success: result.success, data: { coins: result.coins } }) })), /did not confirm/);
  }
  assert.equal(writes, 0);
});
