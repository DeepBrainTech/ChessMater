const test = require('node:test');
const assert = require('node:assert/strict');
const { runStartupMigrations } = require('../startup-migrations');

test('startup runs the repeatable cleanup and coin reward migration and releases the connection', async () => {
  let released = false;
  const queries = [];
  await runStartupMigrations({ connect: async () => ({
    query: async sql => queries.push(sql),
    release: () => { released = true; },
  }) });
  assert.equal(queries.length, 1);
  assert.match(queries[0], /DROP TABLE IF EXISTS public\.user_level_replay_unlocks;/);
  assert.match(queries[0], /DROP TABLE IF EXISTS public\.user_level_undo_rewards;/);
  assert.match(queries[0], /CREATE TABLE IF NOT EXISTS public\.user_level_coin_rewards/);
  assert.match(queries[0], /SET LOCAL lock_timeout = '5s'/);
  assert.match(queries[0], /BEGIN;[\s\S]*COMMIT;/);
  assert.equal(released, true);
});

test('failed cleanup rolls back and propagates the failure for startup to stop', async () => {
  const failure = new Error('lock timeout');
  const queries = [];
  let released = false;
  await assert.rejects(runStartupMigrations({ connect: async () => ({
    query: async sql => {
      queries.push(sql);
      if (sql !== 'ROLLBACK') throw failure;
    },
    release: () => { released = true; },
  }) }), error => error === failure);
  assert.equal(queries[1], 'ROLLBACK');
  assert.equal(released, true);
});
