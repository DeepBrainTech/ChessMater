require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is your frontend
    if (
        origin === 'https://chessmater.pages.dev' ||
        origin === 'http://localhost:5173' ||
        origin === 'https://chessmater-production.up.railway.app'
    ) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
//app.options('*', cors(corsOptions));
app.use(express.json());

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
}

app.get('/init', async (req, res) => {
  await pool.query(`
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
    [req.user.id]
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
        [req.user.id, maxUnlocked]
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Forcing Railway Update v1