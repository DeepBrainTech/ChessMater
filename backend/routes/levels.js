module.exports = function ({
  app,
  authenticate,
  pool
}) {
  app.post('/saveLevel', authenticate, async (req, res) => {
    const {
      levelName,
      levelData
    } = req.body;
    console.log('POST /saveLevel for user:', req.user.user_id);
    try {
      await pool.query(`INSERT INTO levels (portal_user_id, level_name, level_data)
       VALUES ($1, $2, $3)`, [req.user.user_id, levelName, levelData]);
      console.log('Level saved successfully:', levelName);
      res.json({
        success: true
      });
    } catch (err) {
      console.error('Error saving level:', err);
      res.status(500).json({
        error: 'Failed to save level'
      });
    }
  });
  app.get('/loadLevels', authenticate, async (req, res) => {
    console.log('GET /loadLevels for user:', req.user.user_id);
    try {
      const result = await pool.query(`SELECT level_name, level_data FROM levels WHERE portal_user_id = $1
       ORDER BY created_at DESC`, [req.user.user_id]);
      console.log('Loaded levels:', result.rows.length);
      res.json(result.rows);
    } catch (err) {
      console.error('Error loading levels:', err);
      res.status(500).json({
        error: 'Failed to load levels'
      });
    }
  });
};
