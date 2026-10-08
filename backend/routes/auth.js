module.exports = function ({
  app,
  isLocalDevHost,
  pool,
  issueSessionToken,
  setSessionCookie,
  CHESSMATER_SESSION_EXPIRE_SECONDS,
  verifyPortalToken,
  extractPortalIdentity,
  authenticate,
  normalizePortalUsername,
  syncUsernameByPortalIdentity
}) {
  /**
   * Token verify endpoint: validate token and create/find user (QuantumGo-style flow)
   */
  app.post('/api/auth/verify', async (req, res) => {
    // 开发模式：如果是本地开发环境，直接返回测试用户
    const isLocalDev = isLocalDevHost(req.headers.host);
    if (isLocalDev && process.env.NODE_ENV !== 'production') {
      const token = req.headers.authorization?.split(' ')[1];
      if (token === 'dev-token' || !token) {
        console.log('🔧 开发模式：返回测试用户');
        // 尝试查找或创建测试用户
        let user;
        try {
          const userResult = await pool.query('SELECT * FROM users WHERE username = $1', ['dev_user']);
          if (userResult.rows.length > 0) {
            user = userResult.rows[0];
          } else {
            const createResult = await pool.query(`INSERT INTO users (username, password, portal_user_id)
             VALUES ($1, $2, $3)
             RETURNING *`, ['dev_user', 'dev_password', '999']);
            user = createResult.rows[0];
          }
        } catch (dbErr) {
          console.warn('开发模式：数据库操作失败，使用模拟用户', dbErr.message);
          user = {
            id: 999,
            username: 'dev_user',
            portal_user_id: '999'
          };
        }
        const sessionToken = issueSessionToken({
          user_id: 999,
          username: 'dev_user',
          sub: 'dev_user'
        });
        setSessionCookie(req, res, sessionToken);
        return res.json({
          success: true,
          sessionExpiresIn: CHESSMATER_SESSION_EXPIRE_SECONDS,
          user: {
            id: user.id,
            username: user.username,
            portal_user_id: user.portal_user_id,
            user_id: 999
          }
        });
      }
    }
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    try {
      // Verify JWT
      const decoded = verifyPortalToken(token);
      console.log('✅ JWT verified, decoded:', {
        username: decoded.username,
        user_id: decoded.user_id,
        sub: decoded.sub
      });

      // Extra expiry check
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      const identity = extractPortalIdentity(decoded);
      const username = identity.username;
      const portalUserId = identity.userId;
      if (!username || !portalUserId) {
        console.error('❌ Missing username or user_id in JWT payload:', decoded);
        return res.status(400).json({
          success: false,
          message: 'Invalid token payload: missing username or user_id'
        });
      }

      // Upsert user by stable identity, and keep username in sync.
      let user;
      try {
        const tempPassword = `portal_sso_${portalUserId}`;
        user = (await pool.query(`INSERT INTO users (username, password, portal_user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (portal_user_id)
           DO UPDATE SET username = EXCLUDED.username
           RETURNING *`, [username, tempPassword, portalUserId.toString()])).rows[0];
        console.log(`✅ User upserted: username=${user.username}, id=${user.id}, portal_user_id=${user.portal_user_id}`);
      } catch (dbErr) {
        console.error('❌ DB error during user find/create:', dbErr);
        return res.status(500).json({
          success: false,
          message: `Failed to upsert user: ${dbErr.message}`
        });
      }
      const sessionToken = issueSessionToken({
        user_id: portalUserId,
        username,
        sub: decoded.sub || username
      });
      setSessionCookie(req, res, sessionToken);
      res.json({
        success: true,
        sessionExpiresIn: CHESSMATER_SESSION_EXPIRE_SECONDS,
        user: {
          id: user.id,
          username: user.username,
          portal_user_id: user.portal_user_id,
          user_id: portalUserId // 返回 JWT 里的 user_id，供前端使用
        }
      });
    } catch (err) {
      console.error('❌ Token verification failed:', err.name, err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: `Invalid or expired token: ${err.message}`
        });
      } else {
        return res.status(401).json({
          success: false,
          message: `Token verification failed: ${err.message}`
        });
      }
    }
  });

  // Restore user session from httpOnly cookie (for hard refresh / direct open without hash token)
  app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
      const portalUserId = req.user?.user_id != null ? String(req.user.user_id) : null;
      if (!portalUserId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      const userResult = await pool.query(`SELECT id, username, portal_user_id
       FROM users
       WHERE portal_user_id = $1
       ORDER BY id DESC
       LIMIT 1`, [portalUserId]);
      const dbUser = userResult.rows[0] || null;
      const sessionUsername = normalizePortalUsername(req.user?.username || '');
      let username = dbUser?.username || sessionUsername || String(req.user.sub || '');

      // Keep username in sync even on cookie-restored sessions.
      if (dbUser && sessionUsername && dbUser.username !== sessionUsername) {
        const syncedUser = await syncUsernameByPortalIdentity(pool, dbUser, sessionUsername, portalUserId);
        username = syncedUser?.username || username;
      }
      const user = {
        id: dbUser?.id || null,
        username,
        portal_user_id: dbUser?.portal_user_id || portalUserId,
        user_id: req.user.user_id
      };
      return res.json({
        success: true,
        sessionExpiresIn: CHESSMATER_SESSION_EXPIRE_SECONDS,
        user
      });
    } catch (err) {
      console.error('❌ Session restore failed:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to restore session'
      });
    }
  });

  // Health check (no DB, no auth) - use to verify server and CORS
};
