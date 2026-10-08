module.exports = function ({
  app,
  authenticate,
  pool,
  verifyReplayGrant
}) {
  app.get('/undo-credits', authenticate, async (req, res) => {
    try {
      const result = await pool.query('SELECT undo_credits FROM user_progress WHERE portal_user_id = $1', [req.user.user_id]);
      const undoCredits = Number.parseInt(result.rows[0]?.undo_credits, 10);
      res.json({
        undoCredits: Number.isFinite(undoCredits) ? undoCredits : 0
      });
    } catch (err) {
      console.error('Error fetching undo credits:', err);
      res.status(500).json({
        error: 'Failed to fetch undo credits'
      });
    }
  });
  app.post('/undo-credits/use', authenticate, async (req, res) => {
    const parsedAmount = Number.parseInt(req.body?.amount, 10);
    const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;
    try {
      await pool.query(`
      INSERT INTO user_progress (portal_user_id, max_unlocked, undo_credits)
      VALUES ($1, 1, 0)
      ON CONFLICT (portal_user_id) DO NOTHING
      `, [req.user.user_id]);
      const result = await pool.query(`
      UPDATE user_progress
      SET undo_credits = undo_credits - $2
      WHERE portal_user_id = $1 AND undo_credits >= $2
      RETURNING undo_credits
      `, [req.user.user_id, amount]);
      if (!result.rows.length) {
        return res.status(400).json({
          error: 'Not enough undo credits'
        });
      }
      const undoCredits = Number.parseInt(result.rows[0]?.undo_credits, 10);
      res.json({
        success: true,
        undoCredits: Number.isFinite(undoCredits) ? undoCredits : 0
      });
    } catch (err) {
      console.error('Error consuming undo credits:', err);
      res.status(500).json({
        error: 'Failed to consume undo credits'
      });
    }
  });
  app.get('/antigravity-credits', authenticate, async (req, res) => {
    try {
      const result = await pool.query('SELECT antigravity_credits FROM user_progress WHERE portal_user_id = $1', [req.user.user_id]);
      const credits = Number.parseInt(result.rows[0]?.antigravity_credits, 10);
      res.json({
        antigravityCredits: Number.isFinite(credits) ? credits : 2
      });
    } catch (err) {
      console.error('Error fetching antigravity credits:', err);
      res.status(500).json({
        error: 'Failed to fetch antigravity credits'
      });
    }
  });
  app.post('/antigravity-credits/use', authenticate, async (req, res) => {
    const parsedAmount = Number.parseInt(req.body?.amount, 10);
    const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;
    try {
      await pool.query(`
      INSERT INTO user_progress (portal_user_id, max_unlocked, antigravity_credits)
      VALUES ($1, 1, 2)
      ON CONFLICT (portal_user_id) DO NOTHING
      `, [req.user.user_id]);
      const result = await pool.query(`
      UPDATE user_progress
      SET antigravity_credits = antigravity_credits - $2
      WHERE portal_user_id = $1 AND antigravity_credits >= $2
      RETURNING antigravity_credits
      `, [req.user.user_id, amount]);
      if (!result.rows.length) {
        return res.status(400).json({
          error: 'Not enough antigravity credits'
        });
      }
      const credits = Number.parseInt(result.rows[0]?.antigravity_credits, 10);
      res.json({
        success: true,
        antigravityCredits: Number.isFinite(credits) ? credits : 0
      });
    } catch (err) {
      console.error('Error consuming antigravity credits:', err);
      res.status(500).json({
        error: 'Failed to consume antigravity credits'
      });
    }
  });
  app.get('/replay-unlocks/status', authenticate, async (req, res) => {
    try {
      const parsedLevel = Number.parseInt(req.query.level, 10);
      if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
        return res.status(400).json({
          error: 'Invalid level parameter'
        });
      }
      const result = await pool.query(`SELECT 1 FROM user_level_replay_unlocks WHERE portal_user_id = $1 AND level_index = $2 LIMIT 1`, [String(req.user.user_id), parsedLevel]);
      res.json({
        level: parsedLevel,
        unlocked: result.rows.length > 0
      });
    } catch (err) {
      console.error('Error fetching replay unlock status:', err);
      res.status(500).json({
        error: 'Failed to fetch replay unlock status'
      });
    }
  });
  app.post('/replay-unlocks/activate', authenticate, async (req, res) => {
    const level = req.body?.level;
    if (!Number.isSafeInteger(level) || level <= 0 || level > 999999) {
      return res.status(400).json({
        error: 'Invalid level parameter'
      });
    }
    try {
      verifyReplayGrant(req.headers['x-grant-token'], req.user.user_id, level);
    } catch (_) {
      return res.status(402).json({
        error: 'invalid_paid_grant'
      });
    }
    try {
      const parsedLevel = Number.parseInt(req.body?.level, 10);
      if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
        return res.status(400).json({
          error: 'Invalid level parameter'
        });
      }
      await pool.query(`
      INSERT INTO user_level_replay_unlocks (portal_user_id, level_index, unlocked_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (portal_user_id, level_index) DO NOTHING
      `, [String(req.user.user_id), parsedLevel]);
      res.json({
        success: true,
        level: parsedLevel,
        unlocked: true
      });
    } catch (err) {
      console.error('Error activating replay unlock:', err);
      res.status(500).json({
        error: 'Failed to activate replay unlock'
      });
    }
  });
};
