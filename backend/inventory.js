const jwt = require('jsonwebtoken');

const ITEM_COLUMNS = {
  chess_mater_reply: 'hint_credits',
  chess_mater_undo: 'undo_credits',
  chess_mater_antigravity: 'antigravity_credits'
};

function verifyInventoryReceipt(token, userId) {
  const secret = process.env.CHESSMATER_JWT_SECRET;
  if (!secret || secret === 'CHESSMATER' || secret.startsWith('change-this-')) throw new Error('game_signing_not_configured');
  const claims = jwt.verify(token, secret, {
    algorithms: [process.env.CHESSMATER_JWT_ALG || 'HS256'],
    audience: process.env.CHESSMATER_JWT_AUD || 'chessmater',
    issuer: process.env.CHESSMATER_JWT_ISS || 'main-portal'
  });
  if (claims.purpose !== 'chessmater-inventory' || claims.game_key !== 'chessmater' ||
      String(claims.user_id) !== String(userId) || !Number.isSafeInteger(claims.user_id) || claims.user_id <= 0 ||
      !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(claims.purchase_id || '') ||
      !Number.isSafeInteger(claims.exp) || !claims.grants || typeof claims.grants !== 'object' || Array.isArray(claims.grants) ||
      !Object.keys(claims.grants).length || Object.entries(claims.grants).some(([item, count]) =>
        !Object.hasOwn(ITEM_COLUMNS, item) || !Number.isSafeInteger(count) || count <= 0 || count > 1000000000)) {
    throw new Error('invalid_inventory_receipt');
  }
  return claims;
}

function balances(row = {}) {
  return {
    hintCredits: Number(row.hint_credits) || 0,
    undoCredits: Number(row.undo_credits) || 0,
    antigravityCredits: Number(row.antigravity_credits) || 0
  };
}

async function applyInventoryReceipt(pool, userId, token) {
  const claims = verifyInventoryReceipt(token, userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`
      INSERT INTO inventory_deliveries (portal_user_id, purchase_id, grants)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (portal_user_id, purchase_id) DO NOTHING RETURNING purchase_id
    `, [String(userId), claims.purchase_id, JSON.stringify(claims.grants)]);
    if (inserted.rows.length) {
      // A fresh account receives its starter pack before any paid or migrated stock.
      await client.query(`INSERT INTO user_progress
        (portal_user_id, max_unlocked, hint_credits, undo_credits, antigravity_credits)
        VALUES ($1, 1, 3, 2, 1) ON CONFLICT (portal_user_id) DO NOTHING`, [String(userId)]);
      await client.query(`UPDATE user_progress SET
        hint_credits = hint_credits + $2,
        undo_credits = undo_credits + $3,
        antigravity_credits = antigravity_credits + $4
        WHERE portal_user_id = $1`, [String(userId), claims.grants.chess_mater_reply || 0,
        claims.grants.chess_mater_undo || 0, claims.grants.chess_mater_antigravity || 0]);
    } else {
      const original = await client.query('SELECT grants FROM inventory_deliveries WHERE portal_user_id = $1 AND purchase_id = $2', [String(userId), claims.purchase_id]);
      if (Object.keys(ITEM_COLUMNS).some(item => (original.rows[0]?.grants?.[item] || 0) !== (claims.grants[item] || 0))) {
        throw new Error('inventory_receipt_mismatch');
      }
    }
    const current = await client.query('SELECT hint_credits, undo_credits, antigravity_credits FROM user_progress WHERE portal_user_id = $1', [String(userId)]);
    await client.query('COMMIT');
    return { success: true, purchase_id: claims.purchase_id, ...balances(current.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { verifyInventoryReceipt, applyInventoryReceipt, balances };
