const { applyInventoryReceipt, balances, verifyInventoryReceipt } = require('../inventory');

module.exports = function ({ app, authenticate, pool }) {
  app.get('/inventory', authenticate, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const result = await pool.query('SELECT hint_credits, undo_credits, antigravity_credits FROM user_progress WHERE portal_user_id = $1', [req.user.user_id]);
      res.json({ success: true, ...balances(result.rows[0]) });
    } catch (error) {
      res.status(500).json({ error: 'Could not load game inventory' });
    }
  });
  app.post('/inventory/claim', authenticate, async (req, res) => {
    try {
      verifyInventoryReceipt(req.body?.grant_token, req.user.user_id);
    } catch (error) {
      return res.status(403).json({ error: 'Invalid inventory receipt' });
    }
    try {
      res.json(await applyInventoryReceipt(pool, req.user.user_id, req.body.grant_token));
    } catch (error) {
      console.error('Inventory delivery failed:', error.message);
      res.status(500).json({ error: 'Could not deliver game inventory. Retry is safe.' });
    }
  });
};
