const jwt = require('jsonwebtoken');

const GAME_KEY = 'chessmater';
const COINS_PER_LEVEL = 200;
// Keep this bound in sync with the official level catalogue.
const LAST_REWARDED_LEVEL = 105;

async function deliverLevelReward(pool, userId, level, send = fetch) {
  const pending = await pool.query(`SELECT level_index FROM user_level_coin_rewards
    WHERE portal_user_id = $1 AND level_index = $2 AND rewarded_at IS NULL`, [String(userId), level]);
  if (!pending.rows.length) return false;
  const secret = process.env.CHESSMATER_REWARD_SECRET || process.env.CHESSMATER_JWT_SECRET;
  const token = jwt.sign({ user_id: String(userId), level, purpose: 'first-clear-reward' }, secret, {
    algorithm: process.env.CHESSMATER_JWT_ALG || 'HS256',
    audience: `${GAME_KEY}-level-reward`, issuer: `${GAME_KEY}-game`, expiresIn: 60,
  });
  const base = (process.env.PORTAL_API_URL || 'https://api.deepbraintechnology.com').replace(/\/$/, '');
  const response = await send(`${base}/api/games/${GAME_KEY}/level-rewards/claim`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
  });
  const data = await response.json();
  if (!response.ok || !data.success || data.data?.game_key !== GAME_KEY || data.data?.level !== level
      || data.data?.rewards?.coins !== COINS_PER_LEVEL) {
    throw new Error('Portal did not confirm the level reward');
  }
  const marked = await pool.query(`UPDATE user_level_coin_rewards SET rewarded_at = NOW()
    WHERE portal_user_id = $1 AND level_index = $2 AND rewarded_at IS NULL RETURNING level_index`, [String(userId), level]);
  return marked.rows.length > 0;
}

function registerLevelRewards({ app, authenticate, pool }) {
  app.post('/level-rewards/claim', authenticate, async (req, res) => {
    try {
      const pending = await pool.query(`SELECT level_index FROM user_level_coin_rewards
        WHERE portal_user_id = $1 AND rewarded_at IS NULL ORDER BY level_index LIMIT 105`, [String(req.user.user_id)]);
      const awardedLevels = [];
      for (const row of pending.rows) {
        if (await deliverLevelReward(pool, req.user.user_id, row.level_index)) awardedLevels.push(row.level_index);
      }
      res.json({ success: true, awardedLevels, coinsPerLevel: COINS_PER_LEVEL });
    } catch (error) {
      console.error('Level reward delivery pending:', error.message);
      res.status(503).json({ error: 'Level reward delivery pending' });
    }
  });
}

module.exports = { COINS_PER_LEVEL, LAST_REWARDED_LEVEL, deliverLevelReward, registerLevelRewards };
