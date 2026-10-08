module.exports = function ({
  app,
  authenticate,
  pool
}) {
  app.get('/progress', authenticate, async (req, res) => {
    console.log('GET /progress for user:', req.user.user_id);
    try {
      const result = await pool.query('SELECT max_unlocked, undo_credits, antigravity_credits FROM user_progress WHERE portal_user_id = $1', [req.user.user_id]);
      const maxUnlocked = result.rows[0]?.max_unlocked || 1;
      const undoCredits = Number.parseInt(result.rows[0]?.undo_credits, 10);
      const antigravityCredits = Number.parseInt(result.rows[0]?.antigravity_credits, 10);
      console.log('Returning maxUnlocked:', maxUnlocked);
      res.json({
        maxUnlocked,
        undoCredits: Number.isFinite(undoCredits) ? undoCredits : 0,
        antigravityCredits: Number.isFinite(antigravityCredits) ? antigravityCredits : 2
      });
    } catch (err) {
      console.error('Error fetching progress:', err);
      res.status(500).json({
        error: 'Failed to fetch progress'
      });
    }
  });
  app.post('/progress', authenticate, async (req, res) => {
    const parsed = Number.parseInt(req.body?.maxUnlocked, 10);
    const maxUnlocked = Number.isFinite(parsed) ? parsed : 1;
    const parsedLevel = Number.parseInt(req.body?.level, 10);
    const parsedMoves = Number.parseInt(req.body?.moves, 10);
    const level = Number.isFinite(parsedLevel) ? parsedLevel : null;
    const moves = Number.isFinite(parsedMoves) ? parsedMoves : null;
    const rawMoveTrace = Array.isArray(req.body?.moveTrace) ? req.body.moveTrace : null;
    const moveTrace = rawMoveTrace ? rawMoveTrace.slice(0, 500) : null;
    const moveTraceJson = moveTrace ? JSON.stringify(moveTrace) : null;
    console.log('POST /progress - user:', req.user.user_id, 'maxUnlocked:', maxUnlocked, 'level:', level, 'moves:', moves, 'moveTraceLength:', moveTrace ? moveTrace.length : 0);
    try {
      await pool.query('BEGIN');
      await pool.query(`
      INSERT INTO user_progress (portal_user_id, max_unlocked)
      VALUES ($1, $2)
      ON CONFLICT (portal_user_id)
      DO UPDATE SET max_unlocked = GREATEST(user_progress.max_unlocked, EXCLUDED.max_unlocked)
      `, [req.user.user_id, maxUnlocked]);

      // 只要有关卡编号和moves数据(即使是0),都记录到stats表
      let undoAwarded = false;
      if (level && level > 0 && moves !== null && moves !== undefined && moves >= 0) {
        console.log('Saving level stats for level:', level, 'with moves:', moves);
        await pool.query(`
        INSERT INTO user_level_stats (portal_user_id, level_index, best_moves, first_achieved_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (portal_user_id, level_index)
        DO UPDATE SET
          best_moves = LEAST(user_level_stats.best_moves, EXCLUDED.best_moves),
          first_achieved_at = CASE
            WHEN EXCLUDED.best_moves < user_level_stats.best_moves THEN EXCLUDED.first_achieved_at
            ELSE user_level_stats.first_achieved_at
          END,
          updated_at = NOW()
        `, [req.user.user_id, level, moves]);

        // Store replay path only when a new global best is achieved for this level.
        await pool.query(`
        INSERT INTO level_best_replays (level_index, best_moves, best_path, owner_portal_user_id, first_achieved_at, updated_at)
        VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
        ON CONFLICT (level_index)
        DO UPDATE SET
          best_moves = EXCLUDED.best_moves,
          best_path = EXCLUDED.best_path,
          owner_portal_user_id = EXCLUDED.owner_portal_user_id,
          first_achieved_at = EXCLUDED.first_achieved_at,
          updated_at = NOW()
        WHERE EXCLUDED.best_moves < level_best_replays.best_moves
        `, [level, moves, moveTraceJson, req.user.user_id]);

        // Grant level-clear undo reward only once per user per level.
        const rewardInsert = await pool.query(`
        INSERT INTO user_level_undo_rewards (portal_user_id, level_index, rewarded_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (portal_user_id, level_index) DO NOTHING
        RETURNING portal_user_id
        `, [req.user.user_id, level]);
        if (rewardInsert.rows.length > 0) {
          undoAwarded = true;
          await pool.query(`
          UPDATE user_progress
          SET undo_credits = undo_credits + 1
          WHERE portal_user_id = $1
          `, [req.user.user_id]);
        }
        console.log('Level stats saved successfully');
      } else {
        console.log('Level stats not saved - insufficient data:', {
          level,
          moves
        });
      }
      const creditsResult = await pool.query('SELECT undo_credits, antigravity_credits FROM user_progress WHERE portal_user_id = $1', [req.user.user_id]);
      const undoCredits = Number.parseInt(creditsResult.rows[0]?.undo_credits, 10);
      const antigravityCredits = Number.parseInt(creditsResult.rows[0]?.antigravity_credits, 10);
      await pool.query('COMMIT');
      console.log('Progress saved successfully');
      res.json({
        success: true,
        undoAwarded,
        undoCredits: Number.isFinite(undoCredits) ? undoCredits : 0,
        antigravityCredits: Number.isFinite(antigravityCredits) ? antigravityCredits : 2
      });
    } catch (err) {
      try {
        await pool.query('ROLLBACK');
      } catch (_) {}
      console.error('Error saving progress:', err);
      res.status(500).json({
        error: 'Failed to save progress'
      });
    }
  });
};
