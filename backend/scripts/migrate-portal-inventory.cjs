// Dry-run by default. Only ChessMater stock is moved; portal currencies are never updated.
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { applyInventoryReceipt } = require('../inventory');
const ITEMS = ['chess_mater_reply', 'chess_mater_undo', 'chess_mater_antigravity'];
const PURPOSE = 'chessmater-inventory';
const ACK = 'chessmater.inventory.delivered';

async function migratePortalInventory(portal, game, apply = false) {
  const preview = await portal.query(`SELECT item_id, COUNT(*)::int AS rows, SUM(quantity)::bigint AS quantity
    FROM user_item_inventories WHERE item_id = ANY($1::text[]) GROUP BY item_id ORDER BY item_id`, [ITEMS]);
  const users = await portal.query(`SELECT DISTINCT user_id FROM user_item_inventories WHERE item_id = ANY($1::text[])
    UNION SELECT gp.user_id FROM game_purchases gp WHERE gp.game_key = 'chessmater' AND gp.purpose = $2
    AND NOT EXISTS (SELECT 1 FROM commerce_operations co WHERE co.user_id = gp.user_id AND co.request_id = gp.request_id AND co.operation = $3)
    ORDER BY user_id`, [ITEMS, PURPOSE, ACK]);
  if (!apply) return { dryRun: true, inventories: preview.rows, accounts: users.rows.length };
  let movedRows = 0, deliveries = 0;
  for (const { user_id: userId } of users.rows) {
    const client = await portal.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const stock = await client.query('SELECT item_id, quantity FROM user_item_inventories WHERE user_id = $1 AND item_id = ANY($2::text[])', [userId, ITEMS]);
      const grants = {};
      for (const row of stock.rows) {
        if (!Number.isSafeInteger(row.quantity) || row.quantity < 0 || row.quantity > 1000000000) throw new Error('Invalid legacy inventory quantity');
        if (row.quantity) grants[row.item_id] = row.quantity;
      }
      if (Object.keys(grants).length) {
        await client.query(`INSERT INTO game_purchases
          (user_id, request_id, game_key, product_id, purpose, target, cost, expires_at, created_at)
          VALUES ($1, $2, 'chessmater', 'legacy-inventory', $3, $4, '{}'::json, NOW() + INTERVAL '10 minutes', NOW())`,
        [userId, randomUUID(), PURPOSE, JSON.stringify(grants)]);
      }
      const removed = await client.query('DELETE FROM user_item_inventories WHERE user_id = $1 AND item_id = ANY($2::text[])', [userId, ITEMS]);
      movedRows += removed.rowCount;
      await client.query('COMMIT');
      const pending = await client.query(`SELECT gp.request_id, gp.target FROM game_purchases gp
        WHERE gp.user_id = $1 AND gp.game_key = 'chessmater' AND gp.purpose = $2
        AND NOT EXISTS (SELECT 1 FROM commerce_operations co WHERE co.user_id = gp.user_id AND co.request_id = gp.request_id AND co.operation = $3)
        ORDER BY gp.id`, [userId, PURPOSE, ACK]);
      for (const row of pending.rows) {
        const token = jwt.sign({ user_id: Number(userId), game_key: 'chessmater', purpose: PURPOSE,
          purchase_id: row.request_id, grants: JSON.parse(row.target) }, process.env.CHESSMATER_JWT_SECRET, {
          algorithm: process.env.CHESSMATER_JWT_ALG || 'HS256',
          audience: process.env.CHESSMATER_JWT_AUD || 'chessmater',
          issuer: process.env.CHESSMATER_JWT_ISS || 'main-portal', expiresIn: 600
        });
        await applyInventoryReceipt(game, userId, token);
        await client.query(`INSERT INTO commerce_operations (user_id, request_id, operation, payload, result, created_at)
          VALUES ($1, $2, $3, $4::json, '{"delivered":true}'::json, NOW()) ON CONFLICT (user_id, request_id) DO NOTHING`,
        [userId, row.request_id, ACK, JSON.stringify({ purchase_id: row.request_id })]);
        deliveries++;
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  return { dryRun: false, movedRows, deliveries, accounts: users.rows.length };
}

if (require.main === module) {
  (async () => {
    const portalUrl = process.env.PORTAL_DATABASE_URL;
    const gameUrl = process.env.CHESSMATER_DATABASE_URL;
    if (!portalUrl || !gameUrl || portalUrl === gameUrl) throw new Error('Set distinct PORTAL_DATABASE_URL and CHESSMATER_DATABASE_URL explicitly.');
    const apply = process.argv.includes('--apply');
    if (apply && !process.env.CHESSMATER_JWT_SECRET) throw new Error('CHESSMATER_JWT_SECRET is required.');
    const portal = new Pool({ connectionString: portalUrl, ssl: process.env.PORTAL_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
    const game = new Pool({ connectionString: gameUrl, ssl: process.env.CHESSMATER_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
    try { console.log(JSON.stringify(await migratePortalInventory(portal, game, apply))); }
    finally { await Promise.all([portal.end(), game.end()]); }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { migratePortalInventory };
