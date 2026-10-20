const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'production';
process.env.CHESSMATER_JWT_SECRET = 'isolated-commerce-test-secret';
process.env.CHESSMATER_JWT_AUD = 'chessmater';
process.env.CHESSMATER_JWT_ISS = 'main-portal';
process.env.CHESSMATER_JWT_ALG = 'HS256';
const jwt = require('jsonwebtoken');
const { app, verifyPortalToken } = require('../server');
const pool = require('../db');
const claims = { user_id: 42, game_key: 'chessmater', product_id: 'replay',
  purpose: 'level-replay', target: 'level:7', purchase_id: randomUUID(),
  exp: Math.floor(Date.now() / 1000) + 3600, aud: 'chessmater', iss: 'main-portal' };
const sign = (overrides = {}, secret = process.env.CHESSMATER_JWT_SECRET) => jwt.sign(Object.fromEntries(Object.entries({ ...claims, ...overrides }).filter(([, value]) => value !== undefined)), secret);
let server;
let base;
let writes = 0;
before(async () => {
  pool.query = async () => { writes++; return { rows: [] }; };
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });

test('ordinary game login tokens cannot be replaced with paid grants', () => {
  assert.throws(() => verifyPortalToken(sign()));
});

test('localhost requires authentication in development and rejects the former test token', async () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const initialWrites = writes;
  try {
    for (const headers of [{}, { Authorization: 'Bearer dev-token' }]) {
      assert.equal((await fetch(base + '/api/auth/verify', { method: 'POST', headers })).status, 401);
      for (const path of ['/api/auth/me', '/progress', '/undo-credits', '/loadLevels']) {
        assert.equal((await fetch(base + path, { headers })).status, 401);
      }
    }
    assert.equal(writes, initialWrites);
    const login = jwt.sign({ user_id: 42, username: 'portal-user',
      exp: Math.floor(Date.now() / 1000) + 300, aud: 'chessmater', iss: 'main-portal' },
      process.env.CHESSMATER_JWT_SECRET);
    assert.equal((await fetch(base + '/progress', { headers: { Authorization: 'Bearer ' + login } })).status, 200);
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
});

test('removed grant endpoints return 404', async () => {
  for (const path of ['/undo-credits/grant', '/antigravity-credits/grant']) {
    assert.equal((await fetch(base + path, { method: 'POST' })).status, 404);
  }
});

test('retired permanent unlock endpoints return 404 without database writes', async () => {
  const login = jwt.sign({ user_id: 42, username: 'commerce-test', sub: 'commerce-test',
    exp: Math.floor(Date.now() / 1000) + 300, aud: 'chessmater', iss: 'main-portal' },
    process.env.CHESSMATER_JWT_SECRET);
  const post = grant => fetch(base + '/replay-unlocks/activate', { method: 'POST',
    headers: { Authorization: 'Bearer ' + login, 'Content-Type': 'application/json',
      ...(grant ? { 'X-Grant-Token': grant } : {}) }, body: JSON.stringify({ level: 7 }) });
  const initial = writes;
  assert.equal((await post()).status, 404);
  assert.equal((await post(sign())).status, 404);
  const status = await fetch(base + '/replay-unlocks/status?level=7', { headers: { Authorization: 'Bearer ' + login } });
  assert.equal(status.status, 404);
  assert.equal(writes, initial);
});

test('CORS allows the canonical paid-grant header', async () => {
  const response = await fetch(base + '/replay-unlocks/activate', { method: 'OPTIONS',
    headers: { Origin: 'https://chessmaster.deepbraintechnology.com',
      'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-grant-token' } });
  assert.match(response.headers.get('access-control-allow-headers'), /X-Grant-Token/i);
});
