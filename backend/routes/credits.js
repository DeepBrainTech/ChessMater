module.exports = function ({
  app,
  authenticate,
  pool
}) {
  app.post('/starter-pack/claim', authenticate, async (req, res) => {
    try {
      const claimed = await pool.query(`
      INSERT INTO user_progress (portal_user_id, max_unlocked, hint_credits, undo_credits, antigravity_credits)
      VALUES ($1, 1, 3, 2, 1)
      ON CONFLICT (portal_user_id) DO NOTHING
      RETURNING hint_credits, undo_credits, antigravity_credits
      `, [req.user.user_id]);
      const result = claimed.rows[0] ? claimed : await pool.query(
        'SELECT hint_credits, undo_credits, antigravity_credits FROM user_progress WHERE portal_user_id = $1',
        [req.user.user_id]
      );
      const balances = result.rows[0] || {};
      res.json({
        success: true,
        granted: claimed.rows.length > 0,
        hintCredits: Number.parseInt(balances.hint_credits, 10) || 0,
        undoCredits: Number.parseInt(balances.undo_credits, 10) || 0,
        antigravityCredits: Number.parseInt(balances.antigravity_credits, 10) || 0
      });
    } catch (err) {
      console.error('Error claiming starter pack:', err);
      res.status(500).json({ error: 'Failed to claim starter pack' });
    }
  });
  app.get('/hint-credits', authenticate, async (req, res) => {
    try {
      const result = await pool.query('SELECT hint_credits FROM user_progress WHERE portal_user_id = $1', [req.user.user_id]);
      const hintCredits = Number.parseInt(result.rows[0]?.hint_credits, 10);
      res.json({ hintCredits: Number.isFinite(hintCredits) ? hintCredits : 0 });
    } catch (err) {
      console.error('Error fetching Hint credits:', err);
      res.status(500).json({ error: 'Failed to fetch Hint credits' });
    }
  });
  app.post('/hint-credits/use', authenticate, async (req, res) => {
    const requestId = String(req.body?.request_id || '');
    if (!requestId || requestId.length > 128) {
      return res.status(400).json({ error: 'A valid request_id is required' });
    }
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const claimed = await client.query(`
        INSERT INTO user_hint_credit_uses (portal_user_id, request_id)
        VALUES ($1, $2)
        ON CONFLICT (portal_user_id, request_id) DO NOTHING
        RETURNING request_id
      `, [req.user.user_id, requestId]);
      if (!claimed.rows.length) {
        const current = await client.query('SELECT hint_credits FROM user_progress WHERE portal_user_id = $1', [req.user.user_id]);
        const hintCredits = Number.parseInt(current.rows[0]?.hint_credits, 10) || 0;
        await client.query('COMMIT');
        return res.json({ success: true, hintCredits, idempotent: true });
      }
      const spent = await client.query(`
        UPDATE user_progress
        SET hint_credits = hint_credits - 1
        WHERE portal_user_id = $1 AND hint_credits > 0
        RETURNING hint_credits
      `, [req.user.user_id]);
      if (!spent.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Not enough Hint credits' });
      }
      await client.query('COMMIT');
      res.json({ success: true, hintCredits: Number.parseInt(spent.rows[0].hint_credits, 10) || 0 });
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      console.error('Error consuming Hint credit:', err);
      res.status(500).json({ error: 'Failed to consume Hint credit' });
    } finally {
      client?.release();
    }
  });
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
        antigravityCredits: Number.isFinite(credits) ? credits : 0
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
      VALUES ($1, 1, 0)
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
};
