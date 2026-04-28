require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();

// ChessMater JWT config — must match main portal (same secret, aud, iss) or verify returns 401 invalid signature
const CHESSMATER_SECRET = process.env.CHESSMATER_JWT_SECRET || 'CHESSMATER';
const CHESSMATER_ALG = process.env.CHESSMATER_JWT_ALG || 'HS256';
const CHESSMATER_AUD = process.env.CHESSMATER_JWT_AUD || 'chessmater';
const CHESSMATER_ISS = process.env.CHESSMATER_JWT_ISS || 'main-portal';
const CHESSMATER_SESSION_SECRET = process.env.CHESSMATER_SESSION_JWT_SECRET || CHESSMATER_SECRET;
const CHESSMATER_SESSION_AUD = process.env.CHESSMATER_SESSION_JWT_AUD || 'chessmater-session';
const CHESSMATER_SESSION_ISS = process.env.CHESSMATER_SESSION_JWT_ISS || 'chessmater-backend';
const CHESSMATER_SESSION_EXPIRE_SECONDS = Number(process.env.CHESSMATER_SESSION_EXPIRE_SECONDS || 86400);
const SESSION_COOKIE_NAME = 'cm_session';

const ALLOWED_ORIGINS = [
  'https://chessmater.pages.dev',
  'https://chessmater-production.up.railway.app',
  'https://chessmaster.deepbraintechnology.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function isPrivateLanHost(hostname) {
  if (!hostname) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const second = Number(match172[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function parseHostname(input) {
  if (!input) return '';
  const value = String(input).trim().toLowerCase();
  if (!value) return '';
  if (value.includes('://')) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return '';
    }
  }
  return value.split(':')[0];
}

function isLocalDevHost(hostLike) {
  const hostname = parseHostname(hostLike);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || isPrivateLanHost(hostname);
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (isLocalDevHost(origin)) return true;
  if (origin.includes('pages.dev') || origin.includes('deepbraintechnology.com')) return true;
  return false;
}

// Handle preflight first: OPTIONS returns CORS headers without auth
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = origin && isOriginAllowed(origin);
  // For OPTIONS preflight, echo Origin back so browser always gets Allow-Origin (avoids CORS block)
  if (req.method === 'OPTIONS' && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

app.use(express.json());

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function verifyPortalToken(token) {
  return jwt.verify(token, CHESSMATER_SECRET, {
    algorithms: [CHESSMATER_ALG],
    audience: CHESSMATER_AUD,
    issuer: CHESSMATER_ISS
  });
}

function verifySessionToken(token) {
  return jwt.verify(token, CHESSMATER_SESSION_SECRET, {
    algorithms: [CHESSMATER_ALG],
    audience: CHESSMATER_SESSION_AUD,
    issuer: CHESSMATER_SESSION_ISS
  });
}

function normalizePortalUsername(raw) {
  const value = raw == null ? '' : String(raw).trim();
  if (!value) return '';
  if (value.includes('@')) {
    const local = value.split('@')[0].trim();
    return local || value;
  }
  return value;
}

function extractPortalIdentity(decoded) {
  const userId =
    decoded?.user_id ??
    decoded?.userId ??
    decoded?.uid ??
    decoded?.portal_user_id ??
    decoded?.sub ??
    null;

  const usernameRaw =
    decoded?.username ??
    decoded?.name ??
    decoded?.preferred_username ??
    decoded?.nickname ??
    decoded?.displayName ??
    decoded?.email ??
    null;

  const username = normalizePortalUsername(usernameRaw);
  const normalizedUserId = userId == null ? null : String(userId);
  return { userId: normalizedUserId, username };
}

function buildLegacyUsername(baseUsername, rowId, portalUserId) {
  const cleanBase = normalizePortalUsername(baseUsername || 'user') || 'user';
  const suffix = `__legacy_p${String(portalUserId)}_r${String(rowId)}`;
  const maxBaseLength = Math.max(1, 255 - suffix.length);
  const base = cleanBase.slice(0, maxBaseLength);
  return `${base}${suffix}`;
}

async function syncUsernameByPortalIdentity(db, targetUser, desiredUsername, portalUserId) {
  const normalized = normalizePortalUsername(desiredUsername || '');
  if (!targetUser || !normalized || targetUser.username === normalized) {
    return targetUser;
  }

  const conflictCheck = await db.query(
    'SELECT id, username, portal_user_id FROM users WHERE username = $1 LIMIT 1',
    [normalized]
  );
  const conflictRow = conflictCheck.rows[0] || null;

  if (conflictRow && Number(conflictRow.id) !== Number(targetUser.id)) {
    if (String(conflictRow.portal_user_id || '') === String(portalUserId || '')) {
      // Same portal user duplicated in DB; release username from the duplicate row.
      const legacyName = buildLegacyUsername(conflictRow.username, conflictRow.id, portalUserId);
      await db.query(
        'UPDATE users SET username = $1 WHERE id = $2',
        [legacyName, conflictRow.id]
      );
      console.warn(`⚠️ Released duplicate username "${normalized}" from duplicate row id=${conflictRow.id}, portal_user_id=${portalUserId}`);
    } else {
      // Another portal user owns this username; do not hijack.
      console.warn(`⚠️ Username "${normalized}" already used by portal_user_id=${conflictRow.portal_user_id}; keep existing username="${targetUser.username}" for portal_user_id=${portalUserId}`);
      return targetUser;
    }
  }

  const updated = await db.query(
    'UPDATE users SET username = $1 WHERE id = $2 RETURNING *',
    [normalized, targetUser.id]
  );
  const nextUser = updated.rows[0] || targetUser;
  console.log(`🔄 Username synced for portal_user_id=${portalUserId}: ${nextUser.username}`);
  return nextUser;
}

function issueSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: user.sub || user.username || String(user.user_id),
      user_id: user.user_id,
      username: user.username,
      typ: 'cm_session',
      iat: now,
      exp: now + CHESSMATER_SESSION_EXPIRE_SECONDS,
      iss: CHESSMATER_SESSION_ISS,
      aud: CHESSMATER_SESSION_AUD
    },
    CHESSMATER_SESSION_SECRET,
    { algorithm: CHESSMATER_ALG }
  );
}

function setSessionCookie(req, res, token) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const host = String(req.headers.host || '').toLowerCase();
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const secure = req.secure || forwardedProto.includes('https') || !isLocalHost;
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: CHESSMATER_SESSION_EXPIRE_SECONDS * 1000,
    path: '/'
  });
}

/**
 * Authenticate ChessMater JWT (same secret/audience/issuer as main portal)
 */
function authenticate(req, res, next) {
  // 开发模式：如果是本地开发环境，自动设置测试用户
  const isLocalDev = isLocalDevHost(req.headers.host);
  
  if (isLocalDev && process.env.NODE_ENV !== 'production') {
    // 开发模式：检查是否有dev-token或直接允许
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.split(' ')[1];
    
    if (bearerToken === 'dev-token' || !bearerToken) {
      // 设置测试用户
      req.user = {
        user_id: 999,
        username: 'dev_user',
        sub: 'dev_user'
      };
      console.log('🔧 开发模式：使用测试用户', req.user);
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.split(' ')[1];
  const sessionToken = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];

  if (sessionToken) {
    try {
      const decoded = verifySessionToken(sessionToken);
      const identity = extractPortalIdentity(decoded);
      req.user = {
        user_id: identity.userId || decoded.user_id,
        username: identity.username || decoded.username || '',
        sub: decoded.sub
      };
      return next();
    } catch (err) {
      console.warn('Session cookie auth failed:', err.name, err.message);
    }
  }

  if (bearerToken) {
    try {
      const decoded = verifyPortalToken(bearerToken);
      const identity = extractPortalIdentity(decoded);
      req.user = {
        user_id: identity.userId || decoded.user_id,
        username: identity.username || decoded.username || '',
        sub: decoded.sub
      };
      return next();
    } catch (err) {
      console.warn('Bearer auth failed:', err.name, err.message);
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

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
        const userResult = await pool.query(
          'SELECT * FROM users WHERE username = $1',
          ['dev_user']
        );
        
        if (userResult.rows.length > 0) {
          user = userResult.rows[0];
        } else {
          const createResult = await pool.query(
            `INSERT INTO users (username, password, portal_user_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            ['dev_user', 'dev_password', '999']
          );
          user = createResult.rows[0];
        }
      } catch (dbErr) {
        console.warn('开发模式：数据库操作失败，使用模拟用户', dbErr.message);
        user = { id: 999, username: 'dev_user', portal_user_id: '999' };
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

    console.log('✅ JWT verified, decoded:', { username: decoded.username, user_id: decoded.user_id, sub: decoded.sub });

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

    // Find or create user (portal_user_id is the stable identity)
    let user;
    try {
      console.log(`🔍 Looking for user by portal_user_id=${portalUserId}`);
      const userResult = await pool.query(
        `SELECT *
         FROM users
         WHERE portal_user_id = $1
         ORDER BY
           CASE WHEN username LIKE '%__legacy_p%_r%' THEN 1 ELSE 0 END ASC,
           id DESC
         LIMIT 1`,
        [portalUserId.toString()]
      );

      if (userResult.rows.length > 0) {
        // User exists: keep username in sync with portal token
        user = userResult.rows[0];
        user = await syncUsernameByPortalIdentity(pool, user, username, portalUserId);
        console.log(`✅ User exists: username=${user.username}, id=${user.id}, portal_user_id=${user.portal_user_id}`);
      } else {
        // Create user (portal_user_id used in temp password)
        const tempPassword = `portal_sso_${portalUserId}`;
        console.log(`➕ Creating new user: username=${username}, portal_user_id=${portalUserId}`);
        const createResult = await pool.query(
          `INSERT INTO users (username, password, portal_user_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [username, tempPassword, portalUserId.toString()]
        );
        user = createResult.rows[0];
        console.log(`✅ User created: username=${username}, db_id=${user.id}, portal_user_id=${user.portal_user_id}`);
      }
    } catch (dbErr) {
      console.error('❌ DB error during user find/create:', dbErr);
      return res.status(500).json({
        success: false,
        message: `Failed to create user: ${dbErr.message}`
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
        user_id: portalUserId  // 返回 JWT 里的 user_id，供前端使用
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userResult = await pool.query(
      `SELECT id, username, portal_user_id
       FROM users
       WHERE portal_user_id = $1
       ORDER BY
         CASE WHEN username LIKE '%__legacy_p%_r%' THEN 1 ELSE 0 END ASC,
         id DESC
       LIMIT 1`,
      [portalUserId]
    );

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
    return res.status(500).json({ success: false, message: 'Failed to restore session' });
  }
});

// Health check (no DB, no auth) - use to verify server and CORS
app.get('/health', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.json({ ok: true });
});

const initTablesSql = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    portal_user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_progress (
    user_id TEXT PRIMARY KEY,
    max_unlocked INT,
    undo_credits INT NOT NULL DEFAULT 0,
    antigravity_credits INT NOT NULL DEFAULT 2
  );
  CREATE TABLE IF NOT EXISTS levels (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    level_name TEXT,
    level_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_level_stats (
    user_id TEXT NOT NULL,
    level_index INT NOT NULL,
    best_moves INT NOT NULL,
    best_path JSONB,
    first_achieved_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, level_index)
  );
  CREATE TABLE IF NOT EXISTS level_best_replays (
    level_index INT PRIMARY KEY,
    best_moves INT NOT NULL,
    best_path JSONB,
    owner_user_id TEXT NOT NULL,
    first_achieved_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_level_undo_rewards (
    user_id TEXT NOT NULL,
    level_index INT NOT NULL,
    rewarded_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, level_index)
  );
  CREATE TABLE IF NOT EXISTS user_level_replay_unlocks (
    user_id TEXT NOT NULL,
    level_index INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, level_index)
  );
`;

async function ensureTables() {
  try {
    await pool.query(initTablesSql);
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS undo_credits INT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS antigravity_credits INT NOT NULL DEFAULT 2');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS best_path JSONB');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS first_achieved_at TIMESTAMP');
    await pool.query('UPDATE user_level_stats SET first_achieved_at = COALESCE(first_achieved_at, updated_at, NOW()) WHERE first_achieved_at IS NULL');
    await pool.query('ALTER TABLE user_level_stats ALTER COLUMN first_achieved_at SET DEFAULT NOW()');
    await pool.query(`
      INSERT INTO level_best_replays (level_index, best_moves, best_path, owner_user_id, first_achieved_at, updated_at)
      SELECT DISTINCT ON (uls.level_index)
        uls.level_index,
        uls.best_moves,
        uls.best_path,
        uls.user_id,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()),
        NOW()
      FROM user_level_stats uls
      WHERE uls.best_path IS NOT NULL
      ORDER BY
        uls.level_index ASC,
        uls.best_moves ASC,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()) ASC,
        uls.user_id ASC
      ON CONFLICT (level_index) DO NOTHING
    `);
    console.log('✅ DB tables ensured (users, user_progress, levels)');
  } catch (err) {
    console.error('❌ Failed to create tables:', err.message);
  }
}

app.get('/init', async (req, res) => {
  try {
    await pool.query(initTablesSql);
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS undo_credits INT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS antigravity_credits INT NOT NULL DEFAULT 2');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS best_path JSONB');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS first_achieved_at TIMESTAMP');
    await pool.query('UPDATE user_level_stats SET first_achieved_at = COALESCE(first_achieved_at, updated_at, NOW()) WHERE first_achieved_at IS NULL');
    await pool.query('ALTER TABLE user_level_stats ALTER COLUMN first_achieved_at SET DEFAULT NOW()');
    await pool.query(`
      INSERT INTO level_best_replays (level_index, best_moves, best_path, owner_user_id, first_achieved_at, updated_at)
      SELECT DISTINCT ON (uls.level_index)
        uls.level_index,
        uls.best_moves,
        uls.best_path,
        uls.user_id,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()),
        NOW()
      FROM user_level_stats uls
      WHERE uls.best_path IS NOT NULL
      ORDER BY
        uls.level_index ASC,
        uls.best_moves ASC,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()) ASC,
        uls.user_id ASC
      ON CONFLICT (level_index) DO NOTHING
    `);
    res.send('✅ Tables created');
  } catch (err) {
    console.error('Init failed:', err);
    res.status(500).send('Failed to create tables: ' + err.message);
  }
});

app.get('/progress', authenticate, async (req, res) => {
  console.log('GET /progress for user:', req.user.user_id);
  try {
    const result = await pool.query(
      'SELECT max_unlocked, undo_credits, antigravity_credits FROM user_progress WHERE user_id = $1',
      [req.user.user_id]
    );
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
    res.status(500).json({ error: 'Failed to fetch progress' });
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

    await pool.query(
      `
      INSERT INTO user_progress (user_id, max_unlocked)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET max_unlocked = GREATEST(user_progress.max_unlocked, EXCLUDED.max_unlocked)
      `,
      [req.user.user_id, maxUnlocked]
    );

    // 只要有关卡编号和moves数据(即使是0),都记录到stats表
    let undoAwarded = false;
    if (level && level > 0 && moves !== null && moves !== undefined && moves >= 0) {
      console.log('Saving level stats for level:', level, 'with moves:', moves);
      await pool.query(
        `
        INSERT INTO user_level_stats (user_id, level_index, best_moves, first_achieved_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (user_id, level_index)
        DO UPDATE SET
          best_moves = LEAST(user_level_stats.best_moves, EXCLUDED.best_moves),
          first_achieved_at = CASE
            WHEN EXCLUDED.best_moves < user_level_stats.best_moves THEN EXCLUDED.first_achieved_at
            ELSE user_level_stats.first_achieved_at
          END,
          updated_at = NOW()
        `,
        [req.user.user_id, level, moves]
      );

      // Store replay path only when a new global best is achieved for this level.
      await pool.query(
        `
        INSERT INTO level_best_replays (level_index, best_moves, best_path, owner_user_id, first_achieved_at, updated_at)
        VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
        ON CONFLICT (level_index)
        DO UPDATE SET
          best_moves = EXCLUDED.best_moves,
          best_path = EXCLUDED.best_path,
          owner_user_id = EXCLUDED.owner_user_id,
          first_achieved_at = EXCLUDED.first_achieved_at,
          updated_at = NOW()
        WHERE EXCLUDED.best_moves < level_best_replays.best_moves
        `,
        [level, moves, moveTraceJson, req.user.user_id]
      );

      // Grant level-clear undo reward only once per user per level.
      const rewardInsert = await pool.query(
        `
        INSERT INTO user_level_undo_rewards (user_id, level_index, rewarded_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, level_index) DO NOTHING
        RETURNING user_id
        `,
        [req.user.user_id, level]
      );

      if (rewardInsert.rows.length > 0) {
        undoAwarded = true;
        await pool.query(
          `
          UPDATE user_progress
          SET undo_credits = undo_credits + 1
          WHERE user_id = $1
          `,
          [req.user.user_id]
        );
      }
      console.log('Level stats saved successfully');
    } else {
      console.log('Level stats not saved - insufficient data:', { level, moves });
    }

    const creditsResult = await pool.query(
      'SELECT undo_credits, antigravity_credits FROM user_progress WHERE user_id = $1',
      [req.user.user_id]
    );
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
    try { await pool.query('ROLLBACK'); } catch (_) {}
    console.error('Error saving progress:', err);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

app.get('/undo-credits', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT undo_credits FROM user_progress WHERE user_id = $1',
      [req.user.user_id]
    );
    const undoCredits = Number.parseInt(result.rows[0]?.undo_credits, 10);
    res.json({ undoCredits: Number.isFinite(undoCredits) ? undoCredits : 0 });
  } catch (err) {
    console.error('Error fetching undo credits:', err);
    res.status(500).json({ error: 'Failed to fetch undo credits' });
  }
});

app.post('/undo-credits/grant', authenticate, async (req, res) => {
  const parsedAmount = Number.parseInt(req.body?.amount, 10);
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;

  try {
    const result = await pool.query(
      `
      INSERT INTO user_progress (user_id, max_unlocked, undo_credits)
      VALUES ($1, 1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET undo_credits = user_progress.undo_credits + EXCLUDED.undo_credits
      RETURNING undo_credits
      `,
      [req.user.user_id, amount]
    );

    const undoCredits = Number.parseInt(result.rows[0]?.undo_credits, 10);
    res.json({ success: true, undoCredits: Number.isFinite(undoCredits) ? undoCredits : 0 });
  } catch (err) {
    console.error('Error granting undo credits:', err);
    res.status(500).json({ error: 'Failed to grant undo credits' });
  }
});

app.post('/undo-credits/use', authenticate, async (req, res) => {
  const parsedAmount = Number.parseInt(req.body?.amount, 10);
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;

  try {
    await pool.query(
      `
      INSERT INTO user_progress (user_id, max_unlocked, undo_credits)
      VALUES ($1, 1, 0)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [req.user.user_id]
    );

    const result = await pool.query(
      `
      UPDATE user_progress
      SET undo_credits = undo_credits - $2
      WHERE user_id = $1 AND undo_credits >= $2
      RETURNING undo_credits
      `,
      [req.user.user_id, amount]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Not enough undo credits' });
    }

    const undoCredits = Number.parseInt(result.rows[0]?.undo_credits, 10);
    res.json({ success: true, undoCredits: Number.isFinite(undoCredits) ? undoCredits : 0 });
  } catch (err) {
    console.error('Error consuming undo credits:', err);
    res.status(500).json({ error: 'Failed to consume undo credits' });
  }
});

app.get('/antigravity-credits', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT antigravity_credits FROM user_progress WHERE user_id = $1',
      [req.user.user_id]
    );
    const credits = Number.parseInt(result.rows[0]?.antigravity_credits, 10);
    res.json({ antigravityCredits: Number.isFinite(credits) ? credits : 2 });
  } catch (err) {
    console.error('Error fetching antigravity credits:', err);
    res.status(500).json({ error: 'Failed to fetch antigravity credits' });
  }
});

app.post('/antigravity-credits/grant', authenticate, async (req, res) => {
  const parsedAmount = Number.parseInt(req.body?.amount, 10);
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;

  try {
    const result = await pool.query(
      `
      INSERT INTO user_progress (user_id, max_unlocked, antigravity_credits)
      VALUES ($1, 1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET antigravity_credits = user_progress.antigravity_credits + EXCLUDED.antigravity_credits
      RETURNING antigravity_credits
      `,
      [req.user.user_id, amount]
    );

    const credits = Number.parseInt(result.rows[0]?.antigravity_credits, 10);
    res.json({ success: true, antigravityCredits: Number.isFinite(credits) ? credits : 0 });
  } catch (err) {
    console.error('Error granting antigravity credits:', err);
    res.status(500).json({ error: 'Failed to grant antigravity credits' });
  }
});

app.post('/antigravity-credits/use', authenticate, async (req, res) => {
  const parsedAmount = Number.parseInt(req.body?.amount, 10);
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;

  try {
    await pool.query(
      `
      INSERT INTO user_progress (user_id, max_unlocked, antigravity_credits)
      VALUES ($1, 1, 2)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [req.user.user_id]
    );

    const result = await pool.query(
      `
      UPDATE user_progress
      SET antigravity_credits = antigravity_credits - $2
      WHERE user_id = $1 AND antigravity_credits >= $2
      RETURNING antigravity_credits
      `,
      [req.user.user_id, amount]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Not enough antigravity credits' });
    }

    const credits = Number.parseInt(result.rows[0]?.antigravity_credits, 10);
    res.json({ success: true, antigravityCredits: Number.isFinite(credits) ? credits : 0 });
  } catch (err) {
    console.error('Error consuming antigravity credits:', err);
    res.status(500).json({ error: 'Failed to consume antigravity credits' });
  }
});

app.get('/replay-unlocks/status', authenticate, async (req, res) => {
  try {
    const parsedLevel = Number.parseInt(req.query.level, 10);
    if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
      return res.status(400).json({ error: 'Invalid level parameter' });
    }
    const result = await pool.query(
      `SELECT 1 FROM user_level_replay_unlocks WHERE user_id = $1 AND level_index = $2 LIMIT 1`,
      [String(req.user.user_id), parsedLevel]
    );
    res.json({ level: parsedLevel, unlocked: result.rows.length > 0 });
  } catch (err) {
    console.error('Error fetching replay unlock status:', err);
    res.status(500).json({ error: 'Failed to fetch replay unlock status' });
  }
});

app.post('/replay-unlocks/activate', authenticate, async (req, res) => {
  try {
    const parsedLevel = Number.parseInt(req.body?.level, 10);
    if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
      return res.status(400).json({ error: 'Invalid level parameter' });
    }
    await pool.query(
      `
      INSERT INTO user_level_replay_unlocks (user_id, level_index, unlocked_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, level_index) DO NOTHING
      `,
      [String(req.user.user_id), parsedLevel]
    );
    res.json({ success: true, level: parsedLevel, unlocked: true });
  } catch (err) {
    console.error('Error activating replay unlock:', err);
    res.status(500).json({ error: 'Failed to activate replay unlock' });
  }
});

app.post('/saveLevel', authenticate, async (req, res) => {
  const { levelName, levelData } = req.body;
  console.log('POST /saveLevel for user:', req.user.user_id);
  try {
    await pool.query(
      `INSERT INTO levels (user_id, level_name, level_data)
       VALUES ($1, $2, $3)`,
      [req.user.user_id, levelName, levelData]
    );
    console.log('Level saved successfully:', levelName);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving level:', err);
    res.status(500).json({ error: 'Failed to save level' });
  }
});

app.get('/loadLevels', authenticate, async (req, res) => {
  console.log('GET /loadLevels for user:', req.user.user_id);
  try {
    const result = await pool.query(
      `SELECT level_name, level_data FROM levels WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );
    console.log('Loaded levels:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('Error loading levels:', err);
    res.status(500).json({ error: 'Failed to load levels' });
  }
});

app.get('/stats/fewest-other-moves', authenticate, async (req, res) => {
  try {
    const parsedLevel = Number.parseInt(req.query.level, 10);
    if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
      return res.status(400).json({ error: 'Invalid level parameter' });
    }

    const currentUserId = String(req.user.user_id);
    const unlockResult = await pool.query(
      `SELECT 1 FROM user_level_replay_unlocks WHERE user_id = $1 AND level_index = $2 LIMIT 1`,
      [currentUserId, parsedLevel]
    );
    const replayUnlocked = unlockResult.rows.length > 0;

    const result = await pool.query(
      `SELECT lbr.owner_user_id AS user_id, lbr.best_moves, lbr.best_path, u.username
       FROM level_best_replays lbr
       LEFT JOIN LATERAL (
         SELECT username
         FROM users
         WHERE portal_user_id = lbr.owner_user_id
         ORDER BY
           CASE WHEN username LIKE '%__legacy_p%_r%' THEN 1 ELSE 0 END ASC,
           id DESC
         LIMIT 1
       ) u ON TRUE
       WHERE lbr.level_index = $1
       LIMIT 1`,
      [parsedLevel]
    );

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
    res.status(500).json({ error: 'Failed to fetch fewest moves by other user' });
  }
});

app.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const mode = req.query.mode === 'level' ? 'level' : 'progress';
    let result;

    if (mode === 'level') {
      const parsedLevel = Number.parseInt(req.query.level, 10);
      if (!Number.isFinite(parsedLevel) || parsedLevel <= 0) {
        return res.status(400).json({ error: 'Invalid level parameter' });
      }
      result = await pool.query(
        `SELECT uls.user_id, uls.level_index, uls.best_moves, u.username
         FROM user_level_stats uls
         LEFT JOIN LATERAL (
           SELECT username
           FROM users
           WHERE portal_user_id = uls.user_id
           ORDER BY
             CASE WHEN username LIKE '%__legacy_p%_r%' THEN 1 ELSE 0 END ASC,
             id DESC
           LIMIT 1
         ) u ON TRUE
         WHERE uls.level_index = $1
         ORDER BY uls.best_moves ASC, uls.first_achieved_at ASC, uls.user_id ASC
         LIMIT 100`,
        [parsedLevel]
      );
    } else {
      result = await pool.query(
        `SELECT up.user_id, up.max_unlocked, u.username
         FROM user_progress up
         LEFT JOIN LATERAL (
           SELECT username
           FROM users
           WHERE portal_user_id = up.user_id
           ORDER BY
             CASE WHEN username LIKE '%__legacy_p%_r%' THEN 1 ELSE 0 END ASC,
             id DESC
           LIMIT 1
         ) u ON TRUE
         ORDER BY up.max_unlocked DESC, up.user_id ASC
         LIMIT 100`
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

const PORT = process.env.PORT || 3000;

(async () => {
  await ensureTables();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();



