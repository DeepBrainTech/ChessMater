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

const ALLOWED_ORIGINS = [
  'https://chessmater.pages.dev',
  'https://chessmater-production.up.railway.app',
  'https://chessmaster.deepbraintechnology.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin.startsWith('http://0.0.0.0:')) return true;
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

/**
 * Authenticate ChessMater JWT (same secret/audience/issuer as main portal)
 */
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify token (signature, audience, issuer)
    const decoded = jwt.verify(token, CHESSMATER_SECRET, {
      algorithms: [CHESSMATER_ALG],
      audience: CHESSMATER_AUD,
      issuer: CHESSMATER_ISS
    });

    // Attach decoded user to request
    req.user = {
      user_id: decoded.user_id,
      username: decoded.username,
      sub: decoded.sub
    };
    next();
  } catch (err) {
    console.error('Token verification failed:', err.name, err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      // invalid signature = CHESSMATER_JWT_SECRET does not match main portal secret
      return res.status(401).json({
        error: 'Invalid token',
        hint: err.message.includes('signature') ? 'JWT secret mismatch: set CHESSMATER_JWT_SECRET to the same value as the main portal.' : undefined
      });
    } else {
      return res.status(401).json({ error: 'Token verification failed' });
    }
  }
}

/**
 * Token verify endpoint: validate token and create/find user (QuantumGo-style flow)
 */
app.post('/api/auth/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'No token provided' 
    });
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(token, CHESSMATER_SECRET, {
      algorithms: [CHESSMATER_ALG],
      audience: CHESSMATER_AUD,
      issuer: CHESSMATER_ISS
    });

    // Extra expiry check
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    const username = decoded.username;
    const portalUserId = decoded.user_id;

    // Find or create user
    let user;
    try {
      const userResult = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length > 0) {
        // User exists
        user = userResult.rows[0];
        console.log(`User exists: username=${username}, id=${user.id}`);
      } else {
        // Create user (portal_user_id used in temp password)
        const tempPassword = `portal_sso_${portalUserId}`;
        const createResult = await pool.query(
          `INSERT INTO users (username, password, portal_user_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [username, tempPassword, portalUserId.toString()]
        );
        user = createResult.rows[0];
        console.log(`User created: username=${username}, portal_user_id=${portalUserId}`);
      }
    } catch (dbErr) {
      console.error('DB error:', dbErr);
      return res.status(500).json({
        success: false,
        message: `Failed to create user: ${dbErr.message}`
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        portal_user_id: user.portal_user_id
      }
    });
  } catch (err) {
    console.error('Token verification failed:', err.message);
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
    max_unlocked INT
  );
  CREATE TABLE IF NOT EXISTS levels (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    level_name TEXT,
    level_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;

async function ensureTables() {
  try {
    await pool.query(initTablesSql);
    console.log('✅ DB tables ensured (users, user_progress, levels)');
  } catch (err) {
    console.error('❌ Failed to create tables:', err.message);
  }
}

app.get('/init', async (req, res) => {
  try {
    await pool.query(initTablesSql);
    res.send('✅ Tables created');
  } catch (err) {
    console.error('Init failed:', err);
    res.status(500).send('Failed to create tables: ' + err.message);
  }
});

app.get('/progress', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT max_unlocked FROM user_progress WHERE user_id = $1',
    [req.user.user_id]
  );
  res.json({ maxUnlocked: result.rows[0]?.max_unlocked || 1 });
});

app.post('/progress', authenticate, async (req, res) => {
    const { maxUnlocked } = req.body;
  
    console.log("📥 Received progress update from user", req.user.id, "with maxUnlocked:", maxUnlocked);
  
    try {
      await pool.query(
        `
        INSERT INTO user_progress (user_id, max_unlocked)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET max_unlocked = EXCLUDED.max_unlocked
        `,
        [req.user.user_id, maxUnlocked]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error saving progress:", err);
      res.status(500).json({ error: "Failed to save progress" });
    }
  });

app.post('/saveLevel', authenticate, async (req, res) => {
  const { levelName, levelData } = req.body;
  await pool.query(
    `INSERT INTO levels (user_id, level_name, level_data)
     VALUES ($1, $2, $3)`,
    [req.user.id, levelName, levelData]
  );
  res.json({ success: true });
});

app.get('/loadLevels', authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT level_name, level_data FROM levels WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

app.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, max_unlocked
       FROM user_progress 
       ORDER BY max_unlocked DESC, user_id ASC 
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

const PORT = process.env.PORT || 3000;

(async () => {
  await ensureTables();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})();
