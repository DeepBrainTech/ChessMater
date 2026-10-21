const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { fetchPortalAvatars } = require('../portal-avatars');

test('avatar lookup uses a scoped short-lived server token and only accepts requested HTTP image URLs', async () => {
  const previous = process.env.CHESSMATER_JWT_SECRET;
  process.env.CHESSMATER_JWT_SECRET = 'avatar-lookup-test-secret';
  try {
    const avatars = await fetchPortalAvatars([1, 2, 3, 4], async (url, options) => {
      assert.ok(url.endsWith('/api/games/chessmater/leaderboard/avatars'));
      assert.equal(options.method, 'POST');
      const token = jwt.verify(options.headers.Authorization.slice(7), process.env.CHESSMATER_JWT_SECRET, {
        algorithms: ['HS256'], audience: 'chessmater-leaderboard-avatars', issuer: 'chessmater-game',
      });
      assert.deepEqual(token.user_ids, ['1', '2', '3']);
      assert.equal(token.purpose, 'leaderboard-avatars');
      assert.equal(token.exp - token.iat, 60);
      return Response.json({ success: true, data: { avatars: [
        { user_id: 1, avatar_url: 'https://images.example.test/a.png?signature=test', avatar_fallback_url: 'https://portal.example.test/dashboard/default.png' },
        { user_id: 2, avatar_url: null },
        { user_id: 3, avatar_url: 'javascript:alert(1)' },
        { user_id: 4, avatar_url: 'https://images.example.test/other.png' },
      ] } });
    });
    assert.deepEqual([...avatars], [['1', { avatar_url: 'https://images.example.test/a.png?signature=test', avatar_fallback_url: 'https://portal.example.test/dashboard/default.png' }]]);
    for (const response of [() => { throw new Error('offline'); }, () => new Response('', { status: 503 }), () => Response.json({})]) {
      assert.equal((await fetchPortalAvatars([1], response)).size, 0);
    }
  } finally {
    if (previous === undefined) delete process.env.CHESSMATER_JWT_SECRET;
    else process.env.CHESSMATER_JWT_SECRET = previous;
  }
});
