const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { verifyInventoryReceipt, applyInventoryReceipt } = require('../inventory');
process.env.CHESSMATER_JWT_SECRET = 'inventory-isolated-test-secret';
const sign = (overrides = {}, secret = process.env.CHESSMATER_JWT_SECRET) => jwt.sign({
  user_id: 42, game_key: 'chessmater', purpose: 'chessmater-inventory',
  purchase_id: randomUUID(), grants: { chess_mater_reply: 3, chess_mater_undo: 2, chess_mater_antigravity: 1 },
  aud: 'chessmater', iss: 'main-portal', exp: Math.floor(Date.now() / 1000) + 300, ...overrides
}, secret);

test('inventory receipts require a paid receipt purpose, matching account and bounded quantities', () => {
  assert.equal(verifyInventoryReceipt(sign(), 42).grants.chess_mater_reply, 3);
  for (const token of [sign({}, 'wrong-secret'), sign({ user_id: 43 }), sign({ purpose: undefined }),
    sign({ game_key: 'another-game' }), sign({ grants: { coins: 999 } }),
    sign({ grants: { chess_mater_reply: -1 } }), sign({ grants: { chess_mater_reply: 1.5 } }),
    sign({ exp: 1 }), sign({ grants: {} }), sign({ purchase_id: 'not-a-uuid' })]) {
    assert.throws(() => verifyInventoryReceipt(token, 42));
  }
});

test('PostgreSQL inventory delivery and credit use are atomic and idempotent', {
  skip: process.env.CHESSMATER_INVENTORY_DB_TEST !== '1'
}, async () => {
  const { Pool } = require('pg');
  const connectionString = process.env.CHESSMATER_TEST_DATABASE_URL || process.env.DATABASE_URL;
  const admin = new Pool({ connectionString });
  const schema = 'inventory_test_' + randomUUID().replaceAll('-', '');
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 8 });
    await pool.query(`CREATE TABLE user_progress (
      portal_user_id TEXT PRIMARY KEY, max_unlocked INT,
      hint_credits INT NOT NULL DEFAULT 0, undo_credits INT NOT NULL DEFAULT 0, antigravity_credits INT NOT NULL DEFAULT 0);
      CREATE TABLE inventory_deliveries (portal_user_id TEXT, purchase_id UUID, grants JSONB, PRIMARY KEY(portal_user_id, purchase_id));
      CREATE TABLE user_hint_credit_uses (portal_user_id TEXT, request_id TEXT, PRIMARY KEY(portal_user_id, request_id));`);
    const token = sign();
    await Promise.all(Array.from({ length: 8 }, () => applyInventoryReceipt(pool, 42, token)));
    let balances = (await pool.query('SELECT * FROM user_progress')).rows[0];
    assert.equal(balances.hint_credits, 6); assert.equal(balances.undo_credits, 4); assert.equal(balances.antigravity_credits, 2);
    assert.equal((await pool.query('SELECT * FROM inventory_deliveries')).rows.length, 1);
    await Promise.all(Array.from({ length: 8 }, () => applyInventoryReceipt(pool, 42, sign({ grants: { chess_mater_undo: 1 } }))));
    balances = (await pool.query('SELECT * FROM user_progress')).rows[0];
    assert.equal(balances.undo_credits, 12);
    await assert.rejects(applyInventoryReceipt(pool, 42, sign({ purchase_id: verifyInventoryReceipt(token, 42).purchase_id, grants: { chess_mater_reply: 100 } })), /mismatch/);
    const handlers = new Map();
    require('../routes/credits')({ app: { get() {}, post: (path, auth, handler) => handlers.set(path, handler) }, authenticate() {}, pool });
    const call = async (path, body = {}) => {
      let status = 200, data;
      await handlers.get(path)({ user: { user_id: 42 }, body }, { status(value) { status = value; return this; }, json(value) { data = value; } });
      return { status, data };
    };
    await call('/starter-pack/claim'); await call('/starter-pack/claim');
    assert.equal((await pool.query('SELECT hint_credits FROM user_progress')).rows[0].hint_credits, 6);
    const request_id = randomUUID();
    const uses = await Promise.all(Array.from({ length: 8 }, () => call('/hint-credits/use', { request_id })));
    assert.ok(uses.every(use => use.status === 200));
    assert.equal((await pool.query('SELECT hint_credits FROM user_progress')).rows[0].hint_credits, 5);
    await pool.query('UPDATE user_progress SET hint_credits = 0');
    assert.equal((await call('/hint-credits/use', { request_id })).status, 200);
    assert.equal((await call('/hint-credits/use', { request_id: randomUUID() })).status, 400);
    assert.equal((await pool.query('SELECT * FROM user_hint_credit_uses')).rows.length, 1);
    // A failed delivery rolls back its ledger, so it can be replayed after repair.
    const tooLarge = sign({ grants: { chess_mater_undo: 1000000000 } });
    await pool.query('UPDATE user_progress SET undo_credits = 2000000000');
    await assert.rejects(applyInventoryReceipt(pool, 42, tooLarge));
    assert.equal((await pool.query('SELECT * FROM inventory_deliveries')).rows.length, 9);
    await pool.query('UPDATE user_progress SET undo_credits = 0');
    assert.equal((await applyInventoryReceipt(pool, 42, tooLarge)).undoCredits, 1000000000);
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
