const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const databaseTest = { skip: process.env.CHESSMATER_INVENTORY_DB_TEST !== '1' };
function connectionString() {
  const url = process.env.CHESSMATER_TEST_DATABASE_URL;
  if (!url) throw new Error('Set CHESSMATER_TEST_DATABASE_URL to an isolated test database.');
  return url;
}

async function withSchema(run) {
  const admin = new Pool({ connectionString: connectionString() });
  const schema = 'ci_test_' + randomUUID().replaceAll('-', '');
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: connectionString(), options: `-c search_path=${schema}`, max: 8 });
    await pool.query(`CREATE TABLE users (id SERIAL PRIMARY KEY, portal_user_id TEXT, username TEXT);
      CREATE TABLE user_progress (portal_user_id TEXT PRIMARY KEY, max_unlocked INT NOT NULL DEFAULT 1,
        hint_credits INT NOT NULL DEFAULT 0, undo_credits INT NOT NULL DEFAULT 0, antigravity_credits INT NOT NULL DEFAULT 0);
      CREATE TABLE user_level_stats (portal_user_id TEXT, level_index INT, best_moves INT,
        first_achieved_at TIMESTAMP, updated_at TIMESTAMP, PRIMARY KEY (portal_user_id, level_index));
      CREATE TABLE level_best_replays (level_index INT PRIMARY KEY, best_moves INT, best_path JSONB,
        owner_portal_user_id TEXT, first_achieved_at TIMESTAMP, updated_at TIMESTAMP);
      CREATE TABLE user_level_coin_rewards (portal_user_id TEXT, level_index INT, rewarded_at TIMESTAMP,
        PRIMARY KEY (portal_user_id, level_index));`);
    await run(pool);
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}

function routes(register, pool) {
  const handlers = new Map();
  register({ app: {
    get: (url, auth, handler) => handlers.set('GET ' + url, handler),
    post: (url, auth, handler) => handlers.set('POST ' + url, handler),
  }, authenticate() {}, pool, getPortalAvatars: async () => new Map() });
  return async (method, url, { userId = '120', query = {}, body = {} } = {}) => {
    let status = 200, data;
    await handlers.get(method + ' ' + url)({ user: { user_id: userId }, query, body }, {
      status(code) { status = code; return this; }, json(value) { data = value; },
    });
    assert.equal(status, 200, JSON.stringify(data));
    return data;
  };
}

test('PostgreSQL leaderboard ranks text accounts, pages globally, and breaks zero-move ties', databaseTest, async () => {
  await withSchema(async pool => {
    await pool.query(`INSERT INTO users (portal_user_id, username)
      SELECT i::text, 'Player ' || i FROM generate_series(1,120) i;
      INSERT INTO users (portal_user_id, username) VALUES ('1', 'Latest name');
      INSERT INTO user_level_stats (portal_user_id, level_index, best_moves, first_achieved_at)
      SELECT i::text, level, 10, '2026-01-01'::timestamp
      FROM generate_series(1,120) i CROSS JOIN LATERAL generate_series(1,121-i) level;`);
    const call = routes(require('../routes/leaderboard'), pool);
    const completed = { mode: 'completed', includeMe: '1', paged: '1' };
    const first = await call('GET', '/leaderboard', { query: completed });
    assert.equal(first.total, 120);
    assert.equal(first.entries.length, 100);
    assert.equal(first.entries[0].username, 'Latest name');
    assert.equal(first.entries[0].completed_levels, 120);
    assert.equal(first.current_user.user_id, '120');
    assert.equal(first.current_user.rank, 120);
    assert.equal(first.next_rank, 101);
    const last = await call('GET', '/leaderboard', { query: { ...completed, startRank: '101' } });
    assert.deepEqual(last.entries.map(entry => entry.rank), Array.from({ length: 20 }, (_, i) => i + 101));
    assert.equal(last.next_rank, null);
    const around = await call('GET', '/leaderboard', { query: { ...completed, aroundMe: '1' } });
    assert.equal(around.start_rank, 95);
    assert.ok(around.entries.some(entry => entry.user_id === '120'));
    await pool.query(`UPDATE user_level_stats SET best_moves = 0 WHERE level_index = 1 AND portal_user_id IN ('2','10','3');
      UPDATE user_level_stats SET first_achieved_at = '2026-01-02' WHERE level_index = 1 AND portal_user_id = '3';
      UPDATE user_level_stats SET best_moves = -1 WHERE level_index = 1 AND portal_user_id = '42';`);
    const level = await call('GET', '/leaderboard', { userId: '10', query: { mode: 'level', level: '1', includeMe: '1', paged: '1' } });
    assert.deepEqual(level.entries.slice(0, 3).map(entry => entry.user_id), ['10', '2', '3']);
    assert.equal(level.current_user.best_moves, 0);
    assert.equal(level.total, 119);
    const empty = await call('GET', '/leaderboard', { query: { mode: 'level', level: '999', includeMe: '1', paged: '1' } });
    assert.equal(empty.total, 0);
    assert.deepEqual(empty.entries, []);
    assert.equal(empty.current_user, null);
  });
});

test('PostgreSQL progress preserves best replays and rewards a first clear only once', databaseTest, async t => {
  process.env.CHESSMATER_JWT_SECRET = 'ci-progress-only-secret';
  let deliveries = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    deliveries++;
    return { ok: true, json: async () => ({ success: true, data: { game_key: 'chessmater', level: 1, rewards: { coins: 200 } } }) };
  });
  await withSchema(async pool => {
    const call = routes(require('../routes/progress'), pool);
    const submit = (moves, maxUnlocked = 2) => call('POST', '/progress', {
      userId: '2', body: { level: 1, moves, maxUnlocked, moveTrace: [{ marker: moves }] },
    });
    assert.equal((await submit(8)).coinReward, 200);
    assert.equal((await submit(10)).coinReward, 0);
    assert.equal((await submit(4)).coinReward, 0);
    assert.equal((await submit(6, 1)).coinReward, 0);
    assert.equal(deliveries, 1);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM user_level_coin_rewards')).rows[0].count, 1);
    const progress = await call('GET', '/progress', { userId: '2' });
    assert.equal(progress.maxUnlocked, 2, 'Replaying an older level never relocks later levels');
    assert.equal((await pool.query('SELECT best_moves FROM user_level_stats')).rows[0].best_moves, 4);
    const replay = (await pool.query('SELECT * FROM level_best_replays')).rows[0];
    assert.equal(replay.best_moves, 4);
    assert.equal(replay.owner_portal_user_id, '2');
    assert.deepEqual(replay.best_path, [{ marker: 4 }]);
  });
});

test('PostgreSQL startup migrations can run twice without losing progress or purchases', databaseTest, async () => {
  // Startup SQL names public explicitly, so isolate it in a disposable DATABASE, not a schema.
  const database = 'migration_ci_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: connectionString() });
  let pool, created = false;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    const url = new URL(connectionString());
    url.pathname = '/' + database;
    pool = new Pool({ connectionString: url.href });
    await pool.query(`CREATE TABLE user_progress (portal_user_id TEXT PRIMARY KEY, max_unlocked INT);
      INSERT INTO user_progress VALUES ('2', 105);
      CREATE TABLE inventory_deliveries (purchase_id TEXT PRIMARY KEY);
      INSERT INTO inventory_deliveries VALUES ('already-paid');
      CREATE TABLE user_level_replay_unlocks (portal_user_id TEXT);
      CREATE TABLE user_level_undo_rewards (portal_user_id TEXT);`);
    const { runStartupMigrations } = require('../startup-migrations');
    await runStartupMigrations(pool);
    await pool.query("INSERT INTO user_level_coin_rewards (portal_user_id, level_index) VALUES ('2',1)");
    await runStartupMigrations(pool);
    assert.equal((await pool.query('SELECT max_unlocked FROM user_progress')).rows[0].max_unlocked, 105);
    assert.equal((await pool.query('SELECT purchase_id FROM inventory_deliveries')).rows[0].purchase_id, 'already-paid');
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM user_level_coin_rewards')).rows[0].count, 1);
    assert.equal((await pool.query("SELECT to_regclass('public.user_level_replay_unlocks') AS table_name")).rows[0].table_name, null);
  } finally {
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});
