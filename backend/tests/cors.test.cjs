const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.ALLOWED_ORIGINS = ' https://game.example.com , , http://localhost:5173, ';
const { app } = require('../server');
const pool = require('../db');
let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
});

test('configured origins are accepted for normal requests and preflight', async () => {
  for (const origin of ['https://game.example.com', 'http://localhost:5173']) {
    for (const method of ['GET', 'OPTIONS']) {
      const response = await fetch(base + '/health', {
        method,
        headers: { Origin: origin, ...(method === 'OPTIONS' ? {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization,x-grant-token'
        } : {}) }
      });
      assert.equal(response.status, method === 'OPTIONS' ? 204 : 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      assert.match(response.headers.get('vary'), /Origin/);
      if (method === 'OPTIONS') {
        assert.match(response.headers.get('access-control-allow-headers'), /X-Grant-Token/i);
      }
      await response.arrayBuffer();
    }
  }
});

test('unlisted origins cannot bypass normal or preflight checks', async () => {
  for (const origin of [
    'https://game.example.com.evil.com',
    'https://deepbraintechnology.com.evil.com',
    'https://pages.dev.evil.com',
    'https://unlisted.pages.dev',
    'https://unlisted.deepbraintechnology.com',
    'http://localhost:5500',
    'http://192.168.1.2:5173',
    'null'
  ]) {
    for (const method of ['GET', 'OPTIONS']) {
      const response = await fetch(base + '/health', { method, headers: { Origin: origin } });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      await response.arrayBuffer();
    }
  }
});

test('requests without Origin remain available for server clients and health checks', async () => {
  const response = await fetch(base + '/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  await response.arrayBuffer();
});
