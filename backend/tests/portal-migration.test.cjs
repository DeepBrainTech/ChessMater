const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { migratePortalInventory } = require('../scripts/migrate-portal-inventory.cjs');

test('cross-database migration preserves other games and recovers after target commit before acknowledgement', {
  skip: process.env.CHESSMATER_INVENTORY_DB_TEST !== '1'
}, async () => {
  process.env.CHESSMATER_JWT_SECRET = 'isolated-migration-test-secret';
  const { Pool } = require('pg');
  const connectionString = process.env.CHESSMATER_TEST_DATABASE_URL || process.env.DATABASE_URL;
  const admin = new Pool({ connectionString });
  const sourceSchema = 'source_test_' + randomUUID().replaceAll('-', '');
  const targetSchema = 'target_test_' + randomUUID().replaceAll('-', '');
  let source, target;
  try {
    await admin.query(`CREATE SCHEMA ${sourceSchema}; CREATE SCHEMA ${targetSchema}`);
    source = new Pool({ connectionString, options: `-c search_path=${sourceSchema}` });
    target = new Pool({ connectionString, options: `-c search_path=${targetSchema}` });
    await source.query(`CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE user_item_inventories (user_id INT, item_id TEXT, quantity INT);
      CREATE TABLE game_purchases (id SERIAL PRIMARY KEY, user_id INT, request_id TEXT, game_key TEXT, product_id TEXT,
        purpose TEXT, target TEXT, cost JSON, expires_at TIMESTAMP, created_at TIMESTAMP);
      CREATE TABLE commerce_operations (user_id INT, request_id TEXT, operation TEXT, payload JSON, result JSON,
        created_at TIMESTAMP, UNIQUE(user_id,request_id));
      INSERT INTO users VALUES (42);
      INSERT INTO user_item_inventories VALUES (42,'chess_mater_reply',3),(42,'chess_mater_undo',2),
        (42,'chess_mater_antigravity',1),(42,'chess_tourmaster_hint',9);`);
    await target.query(`CREATE TABLE user_progress (portal_user_id TEXT PRIMARY KEY, max_unlocked INT,
      hint_credits INT DEFAULT 0, undo_credits INT DEFAULT 0, antigravity_credits INT DEFAULT 0);
      CREATE TABLE inventory_deliveries (portal_user_id TEXT, purchase_id UUID, grants JSONB, PRIMARY KEY(portal_user_id,purchase_id));
      INSERT INTO user_progress VALUES ('42', 5, 10, 20, 30);`);
    assert.equal((await migratePortalInventory(source, target)).accounts, 1);
    assert.equal((await source.query('SELECT * FROM user_item_inventories')).rows.length, 4);
    let failOnce = true;
    const interruptedSource = {
      query: (...args) => source.query(...args),
      connect: async () => {
        const client = await source.connect();
        return { release: () => client.release(), query: (...args) => {
          if (failOnce && args[0].startsWith('INSERT INTO commerce_operations')) {
            failOnce = false;
            throw new Error('simulated interruption after game commit');
          }
          return client.query(...args);
        } };
      }
    };
    await assert.rejects(migratePortalInventory(interruptedSource, target, true), /interruption/);
    assert.deepEqual((await source.query('SELECT item_id, quantity FROM user_item_inventories')).rows,
      [{ item_id: 'chess_tourmaster_hint', quantity: 9 }]);
    let local = (await target.query('SELECT * FROM user_progress')).rows[0];
    assert.equal(local.hint_credits, 13); assert.equal(local.undo_credits, 22); assert.equal(local.antigravity_credits, 31);
    assert.equal((await migratePortalInventory(source, target, true)).deliveries, 1);
    assert.equal((await migratePortalInventory(source, target, true)).accounts, 0);
    local = (await target.query('SELECT * FROM user_progress')).rows[0];
    assert.equal(local.hint_credits, 13); assert.equal(local.undo_credits, 22); assert.equal(local.antigravity_credits, 31);
    assert.equal((await target.query('SELECT * FROM inventory_deliveries')).rows.length, 1);
  } finally {
    if (source) await source.end();
    if (target) await target.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${sourceSchema} CASCADE; DROP SCHEMA IF EXISTS ${targetSchema} CASCADE`);
    await admin.end();
  }
});
