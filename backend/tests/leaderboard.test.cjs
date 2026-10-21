const { test } = require('node:test');
const assert = require('node:assert/strict');
const register = require('../routes/leaderboard');

function setup(query, getPortalAvatars = async () => new Map()) {
  const handlers = new Map();
  register({ app: { get: (path, auth, handler) => handlers.set(path, handler) }, authenticate() {}, pool: { query }, getPortalAvatars });
  return async (params = {}) => {
    let status = 200, body;
    const response = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
    await handlers.get('/leaderboard')({ query: params, user: { user_id: 42 } }, response);
    return { status, body };
  };
}

test('completed leaderboard counts recorded completions and returns a personal rank outside the top 100', async () => {
  const top = { user_id: 1, rank: 1, completed_levels: 90 };
  const me = { user_id: 42, rank: 328, completed_levels: 12 };
  const request = setup(async (sql, params) => {
    assert.match(sql, /COUNT\(DISTINCT level_index\)/);
    assert.doesNotMatch(sql, /max_unlocked/);
    assert.match(sql, /ROW_NUMBER\(\) OVER \(ORDER BY completed_levels DESC, user_id ASC\)/);
    assert.ok(sql.indexOf('ROW_NUMBER') < sql.indexOf('ranked.rank <= 100'));
    assert.deepEqual(params, [42]);
    return { rows: [top, me] };
  });
  assert.deepEqual(await request({ mode: 'completed', includeMe: '1' }), {
    status: 200, body: { entries: [{ ...top, avatar_url: null, avatar_fallback_url: null }], current_user: me }
  });
});

test('fewest moves uses the selected level, deterministic tie ordering, and preserves zero moves', async () => {
  const me = { user_id: 42, rank: 1, best_moves: 0 };
  const request = setup(async (sql, params) => {
    assert.deepEqual(params, [42, 7]);
    assert.match(sql, /level_index = \$2 AND best_moves >= 0/);
    assert.match(sql, /best_moves ASC, first_achieved_at ASC NULLS LAST, user_id ASC/);
    assert.doesNotMatch(sql, /best_path/);
    return { rows: [me] };
  });
  const { body } = await request({ mode: 'level', level: '7', includeMe: '1' });
  assert.equal(body.current_user.best_moves, 0);
  assert.equal(body.entries.length, 1);
});

test('invalid level parameters never reach the database', async () => {
  const request = setup(() => { throw new Error('must not query'); });
  for (const level of [undefined, '', '0', '-1', '1.5', '1abc', '1; DROP TABLE users', '9007199254740992']) {
    assert.equal((await request({ mode: 'level', level })).status, 400);
  }
});

test('empty leaderboard has no fabricated personal rank', async () => {
  const request = setup(async () => ({ rows: [] }));
  assert.deepEqual((await request({ mode: 'completed', includeMe: '1' })).body, { entries: [], current_user: null });
});

test('legacy clients still receive the unlocked-progress array', async () => {
  const top = { user_id: 1, rank: 1, max_unlocked: 30 };
  const request = setup(async (sql, params) => {
    assert.match(sql, /FROM user_progress/);
    assert.deepEqual(params, [null]);
    return { rows: [top] };
  });
  assert.deepEqual((await request()).body, [top]);
});

test('podium avatars are matched by portal account, without querying the entire leaderboard', async () => {
  const rows = [1, 2, 3, 4].map(rank => ({ rank, user_id: String(rank), completed_levels: 10 }));
  const request = setup(async () => ({ rows }), async ids => {
    assert.deepEqual(ids, ['1', '2', '3']);
    return new Map([['2', { avatar_url: 'https://images.example.test/avatar.png', avatar_fallback_url: 'https://portal.example.test/dashboard/default.png' }]]);
  });
  const { body } = await request({ mode: 'completed', includeMe: '1' });
  assert.equal(body.entries[0].avatar_url, null);
  assert.equal(body.entries[1].avatar_url, 'https://images.example.test/avatar.png');
  assert.equal(body.entries[1].avatar_fallback_url, 'https://portal.example.test/dashboard/default.png');
  assert.equal(body.entries[2].avatar_url, null);
  assert.equal(body.entries[3].avatar_url, undefined);
});

test('paged ranking returns global ranks, continuation cursors and the player outside the page', async () => {
  const request = setup(async (sql, params) => {
    assert.deepEqual(params, [42, 101]);
    assert.match(sql, /COUNT\(\*\) OVER \(\)::int AS total_count/);
    assert.match(sql, /BETWEEN page_bounds.page_start AND page_bounds.page_start \+ 99/);
    return { rows: [
      { user_id: '101', rank: 101, completed_levels: 30, page_start: 101, total_count: 450 },
      { user_id: '42', rank: 328, completed_levels: 10, page_start: 101, total_count: 450 },
    ] };
  }, async ids => { assert.deepEqual(ids, []); return new Map(); });
  const { body } = await request({ mode: 'completed', includeMe: '1', paged: '1', startRank: '101' });
  assert.deepEqual(body.entries.map(row => row.rank), [101]);
  assert.equal(body.current_user.rank, 328);
  assert.equal(body.entries[0].total_count, undefined);
  assert.equal(body.start_rank, 101);
  assert.equal(body.total, 450);
  assert.equal(body.next_rank, 201);
  assert.equal(body.previous_rank, 1);
});

test('jump to personal rank derives its page from the authenticated player and keeps level filtering', async () => {
  const request = setup(async (sql, params) => {
    assert.deepEqual(params, [42, 7, 1]);
    assert.match(sql, /WHERE level_index = \$2/);
    assert.match(sql, /SELECT rank FROM ranked WHERE user_id = \$1/);
    return { rows: [327, 328, 329].map(rank => ({ user_id: rank === 328 ? '42' : String(rank), rank, best_moves: 30, page_start: 303, total_count: 329 })) };
  });
  const { body } = await request({ mode: 'level', level: '7', includeMe: '1', paged: '1', aroundMe: '1' });
  assert.deepEqual(body.entries.map(row => row.rank), [327, 328, 329]);
  assert.equal(body.current_user.user_id, '42');
  assert.equal(body.start_rank, 303);
  assert.equal(body.next_rank, null);
  assert.equal(body.previous_rank, 203);
});

test('invalid page boundaries are rejected before querying', async () => {
  const request = setup(() => { throw new Error('must not query'); });
  for (const startRank of ['0', '-1', '1.5', 'no', '2147483548']) {
    assert.equal((await request({ mode: 'completed', includeMe: '1', paged: '1', startRank })).status, 400);
  }
});

test('an empty page preserves the total count without inventing a player row', async () => {
  const request = setup(async () => ({ rows: [{ user_id: null, rank: null, page_start: 501, total_count: 450 }] }));
  const { body } = await request({ mode: 'completed', includeMe: '1', paged: '1', startRank: '501' });
  assert.deepEqual(body.entries, []);
  assert.equal(body.current_user, null);
  assert.equal(body.total, 450);
  assert.equal(body.next_rank, null);
});
