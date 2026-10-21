// Local-only, repeatable leaderboard fixtures. Pass --remove to clean them up.
const { Pool } = require('pg');

const players = [
  { id: '2147000001', name: 'TEST_Knight', completed: 24, moves: 6 },
  { id: '2147000002', name: 'TEST_Rook', completed: 18, moves: 8 },
  { id: '2147000003', name: 'TEST_Bishop_Long_Name', completed: 12, moves: 8 },
  { id: '2147000004', name: 'TEST_Queen', completed: 8, moves: 12 },
  { id: '2147000005', name: 'TEST_Pawn', completed: 5, moves: 16 },
  { id: '2147000006', name: 'TEST_Castle', completed: 30, moves: 2 },
  { id: '2147000007', name: 'TEST_Champion', completed: 22, moves: 5 },
  { id: '2147000008', name: 'TEST_Royal', completed: 16, moves: 9 },
  { id: '2147000009', name: 'TEST_Bishop', completed: 10, moves: 13 },
  { id: '2147000010', name: 'TEST_Squire', completed: 6, moves: 18 },
  ...Array.from({ length: 20 }, (_, index) => ({
    id: String(2147000011 + index),
    name: `TEST_Player_${String(index + 11).padStart(2, '0')}`,
    completed: 5 + ((index * 7 + 3) % 26),
    moves: 4 + ((index * 3) % 23),
  })),
];
const marker = '!local-leaderboard-fixture-only!';

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !['--remove', '--append'].includes(arg))) {
    throw new Error('Usage: node scripts/seed-leaderboard.cjs [--remove|--append]');
  }
  const url = new URL(process.env.DATABASE_URL || '');
  if (process.env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', 'game-db'].includes(url.hostname)
      || url.pathname !== '/chessmater') {
    throw new Error('Run this script against the local ChessMater development database.');
  }
  const pool = new Pool({ connectionString: url.href, ssl: false });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const ids = players.map(player => player.id);
    const existing = await client.query('SELECT portal_user_id, password FROM users WHERE portal_user_id = ANY($1::text[]) FOR UPDATE', [ids]);
    if (existing.rows.some(row => row.password !== marker)) throw new Error('A fixture ID is already used by another account. No data changed.');
    const existingIds = new Set(existing.rows.map(row => row.portal_user_id));
    const selected = args.includes('--append') ? players.filter(player => !existingIds.has(player.id)) : players;
    const selectedIds = selected.map(player => player.id);
    // Replacing only marked fixtures makes reruns and cleanup deterministic.
    await client.query('DELETE FROM user_level_stats WHERE portal_user_id = ANY($1::text[])', [selectedIds]);
    await client.query('DELETE FROM user_progress WHERE portal_user_id = ANY($1::text[])', [selectedIds]);
    if (args.includes('--remove')) {
      await client.query('DELETE FROM users WHERE portal_user_id = ANY($1::text[]) AND password = $2', [ids, marker]);
    } else {
      for (const player of selected) {
        await client.query(`INSERT INTO users (username, password, portal_user_id) VALUES ($1, $2, $3)
          ON CONFLICT (portal_user_id) DO UPDATE SET username = EXCLUDED.username`, [player.name, marker, player.id]);
        await client.query('INSERT INTO user_progress (portal_user_id, max_unlocked) VALUES ($1, $2)', [player.id, player.completed + 1]);
        await client.query(`INSERT INTO user_level_stats (portal_user_id, level_index, best_moves, first_achieved_at, updated_at)
          SELECT $1, level, $2::int + level * 2,
            TIMESTAMP '2026-01-01' + $3::int * INTERVAL '1 day' + level * INTERVAL '1 minute', NOW()
          FROM generate_series(1, $4::int) AS level`, [player.id, player.moves, players.indexOf(player), player.completed]);
      }
    }
    await client.query('COMMIT');
    console.log(args.includes('--remove') ? `Removed ${players.length} local leaderboard test players.`
      : `Created ${selected.length} local leaderboard test players (${selected.reduce((sum, player) => sum + player.completed, 0)} level results).`);
    if (!args.includes('--remove')) console.table(selected.map(player => ({ player: player.name, completed: player.completed, level1Moves: player.moves + 2 })));
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
