module.exports = function ({
  app,
  authenticate,
  pool
}) {
  app.get('/stats/fewest-other-moves', authenticate, async (req, res) => {
    try {
      const parsedLevel = Number.parseInt(req.query.level, 10);
      if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
        return res.status(400).json({
          error: 'Invalid level parameter'
        });
      }
      const currentUserId = String(req.user.user_id);
      const unlockResult = await pool.query(`SELECT 1 FROM user_level_replay_unlocks WHERE portal_user_id = $1 AND level_index = $2 LIMIT 1`, [currentUserId, parsedLevel]);
      const replayUnlocked = unlockResult.rows.length > 0;
      const result = await pool.query(`SELECT lbr.owner_portal_user_id AS user_id, lbr.best_moves, lbr.best_path, u.username
       FROM level_best_replays lbr
       LEFT JOIN LATERAL (
         SELECT username
         FROM users
         WHERE portal_user_id = lbr.owner_portal_user_id
         ORDER BY id DESC
         LIMIT 1
       ) u ON TRUE
       WHERE lbr.level_index = $1
       LIMIT 1`, [parsedLevel]);
      if (!result.rows.length) {
        return res.json({
          level: parsedLevel,
          best_moves: null,
          user_id: null,
          username: null,
          best_path: null,
          replay_unlocked: replayUnlocked
        });
      }
      res.json({
        level: parsedLevel,
        best_moves: result.rows[0].best_moves,
        user_id: result.rows[0].user_id,
        username: result.rows[0].username || null,
        best_path: result.rows[0].best_path || null,
        replay_unlocked: replayUnlocked
      });
    } catch (err) {
      console.error('Error fetching fewest moves by other user:', err);
      res.status(500).json({
        error: 'Failed to fetch fewest moves by other user'
      });
    }
  });
  app.get('/leaderboard', authenticate, async (req, res) => {
    try {
      const mode = req.query.mode === 'level' ? 'level' : 'progress';
      let result;
      if (mode === 'level') {
        const parsedLevel = Number.parseInt(req.query.level, 10);
        if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
          return res.status(400).json({
            error: 'Invalid level parameter'
          });
        }
        result = await pool.query(`SELECT uls.portal_user_id AS user_id, uls.level_index, uls.best_moves, u.username
         FROM user_level_stats uls
         LEFT JOIN LATERAL (
           SELECT username
           FROM users
           WHERE portal_user_id = uls.portal_user_id
           ORDER BY id DESC
           LIMIT 1
         ) u ON TRUE
         WHERE uls.level_index = $1
         ORDER BY uls.best_moves ASC, uls.first_achieved_at ASC, uls.portal_user_id ASC
         LIMIT 100`, [parsedLevel]);
      } else {
        result = await pool.query(`SELECT up.portal_user_id AS user_id, up.max_unlocked, u.username
         FROM user_progress up
         LEFT JOIN LATERAL (
           SELECT username
           FROM users
           WHERE portal_user_id = up.portal_user_id
           ORDER BY id DESC
           LIMIT 1
         ) u ON TRUE
         ORDER BY up.max_unlocked DESC, up.portal_user_id ASC
         LIMIT 100`);
      }
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      res.status(500).json({
        error: 'Failed to fetch leaderboard'
      });
    }
  });
};
