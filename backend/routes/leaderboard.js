const { fetchPortalAvatars } = require('../portal-avatars');

module.exports = function ({
  app,
  authenticate,
  pool,
  getPortalAvatars = fetchPortalAvatars
}) {
  app.get('/stats/fewest-other-moves', authenticate, async (req, res) => {
    try {
      const parsedLevel = Number.parseInt(req.query.level, 10);
      if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
        return res.status(400).json({
          error: 'Invalid level parameter'
        });
      }
      // Hint access is paid from inventory once per client run, like AntiGravity.
      // Historical permanent unlock rows no longer authorize new runs.
      const replayUnlocked = false;
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
      const mode = ['level', 'completed'].includes(req.query.mode) ? req.query.mode : 'progress';
      const includeMe = req.query.includeMe === '1';
      const paged = includeMe && req.query.paged === '1';
      const requestedStart = Number(req.query.startRank ?? 1);
      if (paged && (!Number.isSafeInteger(requestedStart) || requestedStart < 1 || requestedStart > 2147483547)) {
        return res.status(400).json({ error: 'Invalid start rank' });
      }
      const params = [includeMe ? req.user.user_id : null];
      let source;
      let ordering;
      if (mode === 'level') {
        const parsedLevel = Number(req.query.level);
        if (!Number.isSafeInteger(parsedLevel) || parsedLevel <= 0) {
          return res.status(400).json({
            error: 'Invalid level parameter'
          });
        }
        params.push(parsedLevel);
        source = `SELECT portal_user_id AS user_id, level_index, best_moves, first_achieved_at
          FROM user_level_stats WHERE level_index = $2 AND best_moves >= 0`;
        ordering = 'best_moves ASC, first_achieved_at ASC NULLS LAST, user_id ASC';
      } else if (mode === 'completed') {
        // A stats row is written when a level is completed. Unlocks are not completions.
        source = `SELECT portal_user_id AS user_id, COUNT(DISTINCT level_index)::int AS completed_levels
          FROM user_level_stats WHERE level_index > 0 AND best_moves >= 0 GROUP BY portal_user_id`;
        ordering = 'completed_levels DESC, user_id ASC';
      } else {
        // Preserve the original endpoint's unlocked-progress mode for older clients.
        source = 'SELECT portal_user_id AS user_id, max_unlocked FROM user_progress';
        ordering = 'max_unlocked DESC, user_id ASC';
      }
      let bounds = '';
      if (paged) {
        params.push(requestedStart);
        const start = req.query.aroundMe === '1'
          ? 'GREATEST(1, COALESCE((SELECT rank FROM ranked WHERE user_id = $1), 1) - 25)'
          : `$${params.length}::int`;
        // Keep the requested-start parameter typed even when centering on the player.
        bounds = `, page_bounds AS (SELECT ${start} AS page_start, $${params.length}::int AS requested_start)`;
      }
      // Rank the population before selecting a page and the authenticated player.
      const result = await pool.query(`WITH scores AS (${source}), ranked AS (
        SELECT scores.*, ROW_NUMBER() OVER (ORDER BY ${ordering})::int AS rank${paged ? ', COUNT(*) OVER ()::int AS total_count' : ''} FROM scores
      )${bounds} SELECT ranked.*, u.username${paged ? ', page_bounds.page_start, COALESCE(ranked.total_count, (SELECT COUNT(*)::int FROM scores)) AS total_count' : ''}
        FROM ${paged ? 'page_bounds LEFT JOIN ranked ON (ranked.rank BETWEEN page_bounds.page_start AND page_bounds.page_start + 99 OR ranked.user_id = $1)' : 'ranked'}
        LEFT JOIN LATERAL (
          SELECT username FROM users WHERE portal_user_id = ranked.user_id ORDER BY id DESC LIMIT 1
        ) u ON TRUE
        ${paged ? '' : 'WHERE ranked.rank <= 100 OR ranked.user_id = $1'}
        ORDER BY ranked.rank`, params);
      const start = paged ? Number(result.rows[0]?.page_start ?? requestedStart) : 1;
      const total = paged ? Number(result.rows[0]?.total_count ?? 0) : 0;
      const rows = result.rows.filter(entry => entry.user_id != null).map(({ page_start, total_count, ...entry }) => entry);
      const entries = rows.filter(entry => entry.rank >= start && entry.rank < start + 100);
      if (!includeMe) return res.json(entries);
      const podium = entries.filter(entry => entry.rank <= 3);
      const avatars = await getPortalAvatars(podium.map(entry => entry.user_id));
      for (const entry of podium) {
        Object.assign(entry, avatars.get(String(entry.user_id)) || { avatar_url: null, avatar_fallback_url: null });
      }
      res.json({
        entries,
        current_user: rows.find(entry => String(entry.user_id) === String(req.user.user_id)) || null,
        ...(paged ? { start_rank: start, total, next_rank: start + 100 <= total ? start + 100 : null,
          previous_rank: start > 1 ? Math.max(1, start - 100) : null } : {})
      });
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      res.status(500).json({
        error: 'Failed to fetch leaderboard'
      });
    }
  });
};
