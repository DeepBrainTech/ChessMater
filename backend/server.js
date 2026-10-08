require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const {
  verifyReplayGrant
} = require('./portal-grants');
const app = express();

// ChessMater JWT config — must match main portal (same secret, aud, iss) or verify returns 401 invalid signature
const CHESSMATER_SECRET = process.env.CHESSMATER_JWT_SECRET;
const CHESSMATER_ALG = process.env.CHESSMATER_JWT_ALG || 'HS256';
const CHESSMATER_AUD = process.env.CHESSMATER_JWT_AUD || 'chessmater';
const CHESSMATER_ISS = process.env.CHESSMATER_JWT_ISS || 'main-portal';
const CHESSMATER_SESSION_SECRET = process.env.CHESSMATER_SESSION_JWT_SECRET || CHESSMATER_SECRET;
const CHESSMATER_SESSION_AUD = process.env.CHESSMATER_SESSION_JWT_AUD || 'chessmater-session';
const CHESSMATER_SESSION_ISS = process.env.CHESSMATER_SESSION_JWT_ISS || 'chessmater-backend';
const CHESSMATER_SESSION_EXPIRE_SECONDS = Number(process.env.CHESSMATER_SESSION_EXPIRE_SECONDS || 86400);
const SESSION_COOKIE_NAME = 'cm_session';
const ALLOWED_ORIGINS = ['https://chessmater.pages.dev', 'https://chessmater-production.up.railway.app', 'https://chessmaster.deepbraintechnology.com', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Grant-Token');
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Grant-Token']
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
  if (!CHESSMATER_SECRET || CHESSMATER_SECRET === 'CHESSMATER' || CHESSMATER_SECRET.startsWith('change-this-')) {
    throw new Error('game_signing_not_configured');
  }
  const claims = jwt.verify(token, CHESSMATER_SECRET, {
    algorithms: [CHESSMATER_ALG],
    audience: CHESSMATER_AUD,
    issuer: CHESSMATER_ISS
  });
  if (typeof claims === 'string' || !Number.isSafeInteger(claims.user_id) || claims.user_id <= 0 || typeof claims.username !== 'string' || !Number.isSafeInteger(claims.exp) || 'purpose' in claims) {
    throw new Error('invalid_game_token');
  }
  return claims;
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
  const userId = decoded?.portal_user_id ?? decoded?.user_id ?? decoded?.userId ?? decoded?.uid ?? decoded?.sub ?? null;
  const usernameRaw = decoded?.username ?? decoded?.name ?? decoded?.preferred_username ?? decoded?.nickname ?? decoded?.displayName ?? decoded?.email ?? null;
  const username = normalizePortalUsername(usernameRaw);
  const normalizedUserId = userId == null ? null : String(userId);
  return {
    userId: normalizedUserId,
    username
  };
}
async function syncUsernameByPortalIdentity(db, targetUser, desiredUsername, portalUserId) {
  const normalized = normalizePortalUsername(desiredUsername || '');
  if (!targetUser || !normalized || targetUser.username === normalized) {
    return targetUser;
  }
  const conflictCheck = await db.query('SELECT id, username, portal_user_id FROM users WHERE username = $1 LIMIT 1', [normalized]);
  const conflictRow = conflictCheck.rows[0] || null;
  if (conflictRow && Number(conflictRow.id) !== Number(targetUser.id)) {
    throw new Error(`username_conflict:${normalized}:owner_portal_user_id=${conflictRow.portal_user_id}:target_portal_user_id=${portalUserId}`);
  }
  const updated = await db.query('UPDATE users SET username = $1 WHERE id = $2 RETURNING *', [normalized, targetUser.id]);
  const nextUser = updated.rows[0] || targetUser;
  console.log(`🔄 Username synced for portal_user_id=${portalUserId}: ${nextUser.username}`);
  return nextUser;
}
function issueSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({
    sub: user.sub || user.username || String(user.user_id),
    user_id: user.user_id,
    username: user.username,
    typ: 'cm_session',
    iat: now,
    exp: now + CHESSMATER_SESSION_EXPIRE_SECONDS,
    iss: CHESSMATER_SESSION_ISS,
    aud: CHESSMATER_SESSION_AUD
  }, CHESSMATER_SESSION_SECRET, {
    algorithm: CHESSMATER_ALG
  });
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
  return res.status(401).json({
    error: 'Unauthorized'
  });
}

/**
 * Token verify endpoint: validate token and create/find user (QuantumGo-style flow)
 */
require("./routes/auth")({
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
}); // Restore user session from httpOnly cookie (for hard refresh / direct open without hash token)
// Health check (no DB, no auth) - use to verify server and CORS
app.get('/health', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.json({
    ok: true
  });
});
const initTablesSql = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    portal_user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_progress (
    portal_user_id TEXT PRIMARY KEY,
    max_unlocked INT,
    undo_credits INT NOT NULL DEFAULT 0,
    antigravity_credits INT NOT NULL DEFAULT 2
  );
  CREATE TABLE IF NOT EXISTS levels (
    id SERIAL PRIMARY KEY,
    portal_user_id TEXT,
    level_name TEXT,
    level_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_level_stats (
    portal_user_id TEXT NOT NULL,
    level_index INT NOT NULL,
    best_moves INT NOT NULL,
    best_path JSONB,
    first_achieved_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (portal_user_id, level_index)
  );
  CREATE TABLE IF NOT EXISTS level_best_replays (
    level_index INT PRIMARY KEY,
    best_moves INT NOT NULL,
    best_path JSONB,
    owner_portal_user_id TEXT NOT NULL,
    first_achieved_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_level_undo_rewards (
    portal_user_id TEXT NOT NULL,
    level_index INT NOT NULL,
    rewarded_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (portal_user_id, level_index)
  );
  CREATE TABLE IF NOT EXISTS user_level_replay_unlocks (
    portal_user_id TEXT NOT NULL,
    level_index INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (portal_user_id, level_index)
  );
`;
async function ensurePortalUserIdUniqueIndex() {
  try {
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_portal_user_id_unique_idx ON users (portal_user_id)');
  } catch (err) {
    console.warn('⚠️ Could not enforce unique portal_user_id. Please deduplicate users table first:', err.message);
  }
}
async function dropUsernameUniqueness() {
  try {
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key');
    await pool.query('DROP INDEX IF EXISTS users_username_key');
  } catch (err) {
    console.warn('⚠️ Could not remove username uniqueness:', err.message);
  }
}
async function renameColumnIfExists(tableName, oldColumnName, newColumnName) {
  const oldExistsResult = await pool.query(`SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`, [tableName, oldColumnName]);
  const newExistsResult = await pool.query(`SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`, [tableName, newColumnName]);
  if (!oldExistsResult.rows[0]?.exists || newExistsResult.rows[0]?.exists) return;
  await pool.query(`ALTER TABLE ${tableName} RENAME COLUMN ${oldColumnName} TO ${newColumnName}`);
}
async function ensurePortalUserIdColumnNames() {
  try {
    await renameColumnIfExists('user_progress', 'user_id', 'portal_user_id');
    await renameColumnIfExists('levels', 'user_id', 'portal_user_id');
    await renameColumnIfExists('user_level_stats', 'user_id', 'portal_user_id');
    await renameColumnIfExists('user_level_undo_rewards', 'user_id', 'portal_user_id');
    await renameColumnIfExists('user_level_replay_unlocks', 'user_id', 'portal_user_id');
    await renameColumnIfExists('level_best_replays', 'owner_user_id', 'owner_portal_user_id');
  } catch (err) {
    console.warn('⚠️ Could not normalize portal_user_id column names:', err.message);
  }
}
async function ensureTables() {
  try {
    await pool.query(initTablesSql);
    await ensurePortalUserIdColumnNames();
    await dropUsernameUniqueness();
    await ensurePortalUserIdUniqueIndex();
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS undo_credits INT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS antigravity_credits INT NOT NULL DEFAULT 2');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS best_path JSONB');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS first_achieved_at TIMESTAMP');
    await pool.query('UPDATE user_level_stats SET first_achieved_at = COALESCE(first_achieved_at, updated_at, NOW()) WHERE first_achieved_at IS NULL');
    await pool.query('ALTER TABLE user_level_stats ALTER COLUMN first_achieved_at SET DEFAULT NOW()');
    await pool.query(`
      INSERT INTO level_best_replays (level_index, best_moves, best_path, owner_portal_user_id, first_achieved_at, updated_at)
      SELECT DISTINCT ON (uls.level_index)
        uls.level_index,
        uls.best_moves,
        uls.best_path,
        uls.portal_user_id,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()),
        NOW()
      FROM user_level_stats uls
      WHERE uls.best_path IS NOT NULL
      ORDER BY
        uls.level_index ASC,
        uls.best_moves ASC,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()) ASC,
        uls.portal_user_id ASC
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
    await ensurePortalUserIdColumnNames();
    await dropUsernameUniqueness();
    await ensurePortalUserIdUniqueIndex();
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS undo_credits INT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS antigravity_credits INT NOT NULL DEFAULT 2');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS best_path JSONB');
    await pool.query('ALTER TABLE user_level_stats ADD COLUMN IF NOT EXISTS first_achieved_at TIMESTAMP');
    await pool.query('UPDATE user_level_stats SET first_achieved_at = COALESCE(first_achieved_at, updated_at, NOW()) WHERE first_achieved_at IS NULL');
    await pool.query('ALTER TABLE user_level_stats ALTER COLUMN first_achieved_at SET DEFAULT NOW()');
    await pool.query(`
      INSERT INTO level_best_replays (level_index, best_moves, best_path, owner_portal_user_id, first_achieved_at, updated_at)
      SELECT DISTINCT ON (uls.level_index)
        uls.level_index,
        uls.best_moves,
        uls.best_path,
        uls.portal_user_id,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()),
        NOW()
      FROM user_level_stats uls
      WHERE uls.best_path IS NOT NULL
      ORDER BY
        uls.level_index ASC,
        uls.best_moves ASC,
        COALESCE(uls.first_achieved_at, uls.updated_at, NOW()) ASC,
        uls.portal_user_id ASC
      ON CONFLICT (level_index) DO NOTHING
    `);
    res.send('✅ Tables created');
  } catch (err) {
    console.error('Init failed:', err);
    res.status(500).send('Failed to create tables: ' + err.message);
  }
});
require("./routes/progress")({
  app,
  authenticate,
  pool
});
require("./routes/credits")({
  app,
  authenticate,
  pool,
  verifyReplayGrant
});
require("./routes/levels")({
  app,
  authenticate,
  pool
});
require("./routes/leaderboard")({
  app,
  authenticate,
  pool
});
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  (async () => {
    await ensureTables();
    app.listen(PORT, () => {
      console.log('Server running on port ' + PORT);
    });
  })();
}
module.exports = {
  app,
  verifyPortalToken
};
