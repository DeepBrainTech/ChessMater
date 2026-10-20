const { test } = require('node:test');
const assert = require('node:assert/strict');
const register = require('../routes/leaderboard');

test('record lookup no longer reads permanent unlock rows or grants permanent access', async () => {
  const handlers = new Map();
  let lookups = 0;
  register({
    app: { get: (path, auth, handler) => handlers.set(path, handler) },
    authenticate: () => {},
    pool: { query: async sql => {
      assert.doesNotMatch(sql, /user_level_replay_unlocks/);
      lookups++;
      return { rows: [{ best_moves: 4, best_path: [{}, {}], user_id: 2, username: 'best' }] };
    } },
  });
  let data;
  await handlers.get('/stats/fewest-other-moves')({ query: { level: '3' }, user: { user_id: 42 } }, { json: value => { data = value; } });
  assert.equal(lookups, 1);
  assert.equal(data.replay_unlocked, false);
  assert.equal(data.best_moves, 4);
  assert.equal(data.best_path.length, 2);
});
