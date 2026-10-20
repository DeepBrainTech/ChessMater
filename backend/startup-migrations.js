const { readFile } = require('node:fs/promises');
const path = require('node:path');

async function runStartupMigrations(pool) {
  // Explicitly allow only reviewed, repeatable migrations at startup.
  const sql = (await Promise.all([
    '20261019_drop_permanent_replay_unlocks.sql',
    '20261019_drop_level_undo_rewards.sql',
    '20261020_level_coin_rewards.sql',
  ].map(file => readFile(path.join(__dirname, 'migrations', file), 'utf8')))).join('\n');
  const client = await pool.connect();
  try {
    await client.query(sql);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runStartupMigrations };
