require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();

// ChessMater JWT 配置（必须与主站点一致）
const CHESSMATER_SECRET = process.env.CHESSMATER_JWT_SECRET || 'change-this-chessmater-secret';
const CHESSMATER_ALG = process.env.CHESSMATER_JWT_ALG || 'HS256';
const CHESSMATER_AUD = process.env.CHESSMATER_JWT_AUD || 'chessmater';
const CHESSMATER_ISS = process.env.CHESSMATER_JWT_ISS || 'main-portal';

const corsOptions = {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      // Allow local development servers
      const isLocalDev = origin.startsWith('http://localhost:') || 
                        origin.startsWith('http://127.0.0.1:') ||
                        origin.startsWith('http://0.0.0.0:');
      // Allow production domains
      const isProduction = origin === 'https://chessmater.pages.dev' ||
                          origin === 'https://chessmater-production.up.railway.app' ||
                          origin.includes('pages.dev') ||
                          origin.includes('deepbraintechnology.com');
      
      if (isLocalDev || isProduction) {
        return callback(null, true);
      } else {
        console.warn('CORS blocked origin:', origin);
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  
  // Apply CORS middleware
  app.use(cors(corsOptions));
  
  // Explicitly handle OPTIONS preflight requests
  app.options('*', cors(corsOptions));
  
  app.use(express.json());

/**
 * 验证 ChessMater JWT token
 * 使用与主站点相同的密钥、audience 和 issuer 进行验证
 */
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未提供 token' });
  }

  try {
    // 使用 jwt.verify 验证 token（包括签名、audience、issuer）
    const decoded = jwt.verify(token, CHESSMATER_SECRET, {
      algorithms: [CHESSMATER_ALG],
      audience: CHESSMATER_AUD,
      issuer: CHESSMATER_ISS
    });

    // 将解码后的用户信息附加到请求对象
    req.user = {
      user_id: decoded.user_id,
      username: decoded.username,
      sub: decoded.sub
    };
    next();
  } catch (err) {
    console.error('Token 验证失败:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token 已过期' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的 token' });
    } else {
      return res.status(401).json({ error: 'Token 验证失败' });
    }
  }
}

/**
 * Token 验证端点 - 验证 token 并自动创建/查找用户
 * 与 QuantumGo 类似的用户鉴定流程
 */
app.post('/api/auth/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: '未提供 token' 
    });
  }

  try {
    // 验证 JWT token
    const decoded = jwt.verify(token, CHESSMATER_SECRET, {
      algorithms: [CHESSMATER_ALG],
      audience: CHESSMATER_AUD,
      issuer: CHESSMATER_ISS
    });

    // 检查 token 是否过期（额外检查）
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return res.status(401).json({
        success: false,
        message: '令牌已过期 | Token expired'
      });
    }

    const username = decoded.username;
    const portalUserId = decoded.user_id;

    // 检查用户是否存在，不存在则自动创建
    let user;
    try {
      const userResult = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length > 0) {
        // 用户已存在
        user = userResult.rows[0];
        console.log(`用户已存在: username=${username}, id=${user.id}`);
      } else {
        // 用户不存在，自动创建
        // 使用主门户用户ID作为密码的一部分（用户无需知道这个密码）
        const tempPassword = `portal_sso_${portalUserId}`;
        const createResult = await pool.query(
          `INSERT INTO users (username, password, portal_user_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [username, tempPassword, portalUserId.toString()]
        );
        user = createResult.rows[0];
        console.log(`自动创建用户: username=${username}, portal_user_id=${portalUserId}`);
      }
    } catch (dbErr) {
      console.error('数据库操作失败:', dbErr);
      return res.status(500).json({
        success: false,
        message: `创建用户失败 | Failed to create user: ${dbErr.message}`
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
    console.error('Token 验证失败:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '令牌已过期 | Token expired'
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: `令牌无效或已过期 | Invalid token: ${err.message}`
      });
    } else {
      return res.status(401).json({
        success: false,
        message: `Token 验证失败: ${err.message}`
      });
    }
  }
});

app.get('/init', async (req, res) => {
  await pool.query(`
    -- 用户表（带唯一性约束，确保用户唯一性）
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
  `);
  res.send('✅ Tables created');
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Forcing Railway Update v1
