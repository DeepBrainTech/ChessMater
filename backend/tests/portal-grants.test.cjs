const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'production';
process.env.CHESSMATER_JWT_SECRET = 'isolated-commerce-test-secret';
process.env.CHESSMATER_JWT_AUD = 'chessmater';
process.env.CHESSMATER_JWT_ISS = 'main-portal';
process.env.CHESSMATER_JWT_ALG = 'HS256';
const jwt = require('jsonwebtoken');
const { verifyReplayGrant } = require('../portal-grants');
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

test('replay verifier binds user, game, product, purpose, level and purchase ID', () => {
  assert.equal(verifyReplayGrant(sign(), 42, 7).target, 'level:7');
  for (const change of [{ user_id: 43 }, { game_key: 'another-game' }, { product_id: 'undo' },
    { purpose: 'login' }, { target: 'level:8' }, { purchase_id: 'invalid' },
    { exp: undefined }, { exp: 1 }, { aud: 'another-game' }, { iss: 'another-issuer' }]) {
    assert.throws(() => verifyReplayGrant(sign(change), 42, 7));
  }
  assert.throws(() => verifyReplayGrant(sign({}, 'wrong-secret'), 42, 7));
});

test('ordinary game login tokens cannot be replaced with paid grants', () => {
  assert.throws(() => verifyPortalToken(sign()));
});

test('removed grant endpoints return 404', async () => {
  for (const path of ['/undo-credits/grant', '/antigravity-credits/grant']) {
    assert.equal((await fetch(base + path, { method: 'POST' })).status, 404);
  }
});

test('replay activation requires matching signed authorization before any database writes', async () => {
  const login = jwt.sign({ user_id: 42, username: 'commerce-test', sub: 'commerce-test',
    exp: Math.floor(Date.now() / 1000) + 300, aud: 'chessmater', iss: 'main-portal' },
    process.env.CHESSMATER_JWT_SECRET);
  const post = grant => fetch(base + '/replay-unlocks/activate', { method: 'POST',
    headers: { Authorization: 'Bearer ' + login, 'Content-Type': 'application/json',
      ...(grant ? { 'X-Grant-Token': grant } : {}) }, body: JSON.stringify({ level: 7 }) });
  const initial = writes;
  assert.equal((await post()).status, 402);
  assert.equal((await post(sign({ user_id: 43 }))).status, 402);
  assert.equal(writes, initial);
  assert.equal((await post(sign())).status, 200);
  assert.equal(writes, initial + 1);
});

test('CORS allows the canonical paid-grant header', async () => {
  const response = await fetch(base + '/replay-unlocks/activate', { method: 'OPTIONS',
    headers: { Origin: 'https://chessmaster.deepbraintechnology.com',
      'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-grant-token' } });
  assert.match(response.headers.get('access-control-allow-headers'), /X-Grant-Token/i);
});
