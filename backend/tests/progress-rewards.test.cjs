const { test } = require('node:test');
const assert = require('node:assert/strict');

async function fixture({ unlocked = 1, completed = false, pending = false } = {}) {
  let handler, released = false, reserved = 0, delivered = 0;
  const queries = [];
  const client = {
    query: async sql => {
      queries.push(sql);
      if (sql.startsWith('SELECT max_unlocked')) return { rows: [{ max_unlocked: unlocked }] };
      if (sql.startsWith('SELECT level_index FROM user_level_stats')) return { rows: completed ? [{ level_index: 1 }] : [] };
      if (sql.includes('INSERT INTO user_level_coin_rewards')) { reserved++; pending = true; }
      if (sql.includes('INSERT INTO user_level_stats')) completed = true;
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  const pool = { connect: async () => client, query: async sql => {
    assert.equal(released, true, 'release the transaction connection before contacting the portal');
    if (sql.startsWith('UPDATE')) { pending = false; delivered++; return { rows: [{ level_index: 1 }] }; }
    return { rows: pending ? [{ level_index: 1 }] : [] };
  } };
  require('../routes/progress')({ app: { get() {}, post(path, auth, callback) { handler = callback; } }, authenticate() {}, pool });
  return { call: async body => {
    released = false;
    let status = 200, data;
    await handler({ user: { user_id: 42 }, body }, { status(code) { status = code; return this; }, json(value) { data = value; } });
    return { status, data };
  }, reserved: () => reserved, delivered: () => delivered, queries };
}

test('a first clear reserves and delivers 200 coins; a repeat clear does not award again', async t => {
  process.env.CHESSMATER_JWT_SECRET = 'isolated-progress-reward-secret';
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ success: true, data: { coins: 200 } }) }));
  const f = await fixture();
  const body = { maxUnlocked: 2, level: 1, moves: 8 };
  assert.equal((await f.call(body)).data.coinReward, 200);
  assert.equal((await f.call(body)).data.coinReward, 0);
  assert.equal(f.reserved(), 1);
  assert.equal(f.delivered(), 1);
  assert.equal(f.queries.filter(sql => sql === 'COMMIT').length, 2);
});

test('old unlocked levels and invalid future levels do not reserve coins', async () => {
  for (const [unlocked, level] of [[5, 1], [1, 2], [106, 106]]) {
    const f = await fixture({ unlocked });
    assert.equal((await f.call({ maxUnlocked: 999, level, moves: 1 })).data.coinReward, 0);
    assert.equal(f.reserved(), 0);
  }
});

test('a portal failure preserves saved progress and the pending reward for a later retry', async t => {
  process.env.CHESSMATER_JWT_SECRET = 'isolated-progress-reward-secret';
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('portal offline'); });
  const f = await fixture();
  const result = await f.call({ maxUnlocked: 2, level: 1, moves: 8 });
  assert.equal(result.status, 200);
  assert.equal(result.data.rewardPending, true);
  assert.equal(result.data.coinReward, 0);
  assert.ok(f.queries.includes('COMMIT'));
  assert.equal(f.delivered(), 0);
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ success: true, data: { coins: 200 } }) }));
  assert.equal((await f.call({ maxUnlocked: 2, level: 1, moves: 8 })).data.coinReward, 200);
  assert.equal(f.reserved(), 1);
});
