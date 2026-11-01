// Run against local PostgreSQL only. No business rows or schema are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const caseName = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const cases = ['checked-out-connection-loss', 'notification-unlock-failure', 'media-unlock-failure', 'proxy-keep-alive', 'push-registration-checkout-failure', 'push-registration-rollback-failure'];

async function runCase(name) {
  if (name.startsWith('push-registration-')) {
    const express = require('express');
    let released = false, discarded = false;
    const stub = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
    stub('../config/db', { connect: async () => {
      if (name.endsWith('checkout-failure')) throw Object.assign(new Error('Injected checkout timeout'), { code: 'ETIMEDOUT' });
      return { query: async () => { throw Object.assign(new Error('Injected connection loss and rollback failure'), { code: 'ECONNRESET' }); }, release: error => { released = true; discarded = Boolean(error); } };
    } });
    stub('../middleware/auth', { auth: (req, res, next) => { req.user = { id: 1, role: 'household' }; req.activeRole = 'household'; next(); } });
    const app = express(); app.use(express.json()); app.use('/notifications', require('../routes/notifications'));
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    app.use((error, req, res, next) => res.status(500).json({ message: 'Injected database failure' }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      const response = await fetch(base + '/notifications/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(2000),
        body: JSON.stringify({ device_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', token: 'ExpoPushToken[synthetic_fixture_token]', platform: 'android' }) });
      assert.equal(response.status, 500, 'A failed database write must not report success');
      assert.equal((await fetch(base + '/health')).status, 200, 'API must survive failed push registration');
      if (name.endsWith('rollback-failure')) { assert(released); assert(discarded); }
      return { failedWriteStatus: response.status, subsequentHealth: 200, released, discarded };
    } finally { server.closeAllConnections(); server.close(); }
  }
  if (name === 'proxy-keep-alive') {
    const http = require('node:http'), net = require('node:net');
    let server;
    const original = http.createServer;
    http.createServer = (...args) => (server = original(...args));
    const stub = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
    stub('../app', (req, res) => res.end('ok'));
    stub('../socket/chat', { initializeChat() {} });
    stub('../db/startup', { startup: async () => {} });
    stub('../utils/storage', { getStorage: () => ({ check: async () => {} }) });
    process.env.PORT = '0'; process.env.RUN_BACKGROUND_WORKER = 'false';
    require('../server');
    await new Promise(resolve => server.once('listening', resolve));
    const sockets = [0, 1].map(() => net.connect(server.address().port, '127.0.0.1'));
    try {
      await Promise.all(sockets.map(socket => new Promise((resolve, reject) => {
        socket.once('error', reject); socket.once('data', resolve);
        socket.write('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n');
      })));
      await new Promise(resolve => setTimeout(resolve, 6500));
      assert(sockets.every(socket => !socket.destroyed), 'Origin closed both proxy connections after the default 5-second idle window');
      await Promise.all(sockets.map(socket => new Promise((resolve, reject) => {
        socket.once('error', reject); socket.once('data', data => { assert(data.toString().includes('200 OK')); resolve(); });
        socket.write('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n');
      })));
      assert.equal(server.keepAliveTimeout, 120000);
      assert(server.headersTimeout > server.keepAliveTimeout);
      return { connectionsReused: 2, idle_ms: 6500, keepAliveTimeout: server.keepAliveTimeout, headersTimeout: server.headersTimeout };
    } finally { sockets.forEach(socket => socket.destroy()); server.close(); }
  }
  const pool = require('../config/db');
  const host = pool.options.connectionString ? new URL(pool.options.connectionString).hostname : pool.options.host;
  assert(['localhost', '127.0.0.1', '::1', '[::1]'].includes(host), 'Local database required');
  pool.options.max = 1; pool.options.connectionTimeoutMillis = 500;
  let checkedOut;
  try {
    if (name === 'checked-out-connection-loss') {
      const { Client } = require('pg');
      checkedOut = await pool.connect();
      const killer = new Client({ ...pool.options, password: pool.options.password });
      try {
        await killer.connect();
        await killer.query('SELECT pg_terminate_backend($1)', [checkedOut.processID]);
        await new Promise(resolve => setTimeout(resolve, 100));
        await assert.rejects(checkedOut.query('SELECT 1'));
      } finally { await killer.end(); }
      checkedOut.release(true); checkedOut = null;
    } else {
      const originalConnect = pool.connect.bind(pool);
      let destroyed = false;
      pool.connect = async () => {
        const client = checkedOut = await originalConnect();
        const release = client.release;
        client.release = error => { destroyed = Boolean(error); checkedOut = null; return release(error); };
        client.query = async sql => {
          if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
          if (sql.includes('pg_advisory_unlock')) throw Object.assign(new Error('Injected unlock connection failure'), { code: 'ECONNRESET' });
          return { rows: [] };
        };
        return client;
      };
      const work = name === 'notification-unlock-failure' ? require('../utils/notifications').flushNotifications : require('../utils/storage').cleanupOrphans;
      try { await assert.rejects(work(), error => error.code === 'ECONNRESET'); }
      finally { pool.connect = originalConnect; }
      assert.equal(checkedOut, null, 'Failed advisory unlock leaked its checked-out pool connection');
      assert(destroyed, 'Connection with uncertain session lock was returned for reuse');
    }
    await Promise.all([pool.query('SELECT 1'), pool.query('SELECT 1')]);
    assert.equal(pool.waitingCount, 0);
    return { concurrentReads: 2, poolMax: 1, waiting: pool.waitingCount };
  } finally { checkedOut?.release(true); await pool.end(); }
}

async function main() {
  if (caseName) { const result = await runCase(caseName); console.log(JSON.stringify({ case: caseName, status: 'PASS', ...result })); return; }
  const results = await Promise.all(cases.map(name => new Promise(resolve => {
    const start = performance.now(); let stdout = '', stderr = '';
    const child = spawn(process.execPath, [__filename, '--case=' + name], {
      cwd: root, env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', STORAGE_PROVIDER: 'local', PUSH_ENABLED: 'false' }, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data);
    child.once('error', error => resolve({ case: name, status: 'FAIL', error: error.code }));
    child.once('exit', code => resolve({ case: name, status: code === 0 ? 'PASS' : 'FAIL', exitCode: code, ms: Math.round(performance.now() - start),
      detail: stdout.trim().split('\n').find(line => line.startsWith('{')) || '',
      failure: code ? stderr.match(/(?:error:|AssertionError[^\n]*|Error:)[^\n]*/)?.[0] || 'Child process failed' : undefined }));
  })));
  const phase = process.argv.includes('--record-before') ? 'before' : 'after';
  const report = { executed_at: new Date().toISOString(), phase, scope: 'Local real PostgreSQL connection termination; controlled worker unlock failures; two real TCP connections to actual server startup with startup dependencies isolated. Not hosted incident proof or native UI testing.', results };
  fs.writeFileSync(path.join(root, '../docs/test-results/backend-availability-' + phase + '-20261101.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (phase === 'after') assert(results.every(result => result.status === 'PASS'), 'Backend availability regression failed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
