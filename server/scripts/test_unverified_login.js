const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const { createPool } = require('mysql2/promise');
const http = require('http');
const { env } = require('../src/config');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: data }));
    });

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function getHealth(url) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'GET' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.end();
  });
}

async function main() {
  const pool = createPool({
    host: env.mysqlHost,
    port: env.mysqlPort || 3306,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    connectionLimit: 2,
  });

  const email = `temp-unverified-${Date.now()}@example.com`;
  const password = 'TempPass123!';
  const id = crypto.randomUUID();
  const passwordHash = await bcryptjs.hash(password, 10);

  try {
    const health = await getHealth('http://127.0.0.1:3000/api/health');
    console.log('Health status:', health.status);

    await pool.execute(
      `INSERT INTO profiles (id, name, email, phone, password_hash, email_verified, verified_at, app_role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [id, 'Temp Unverified', email, null, passwordHash, 0, null, 'user']
    );

    const response = await postJson('http://127.0.0.1:3000/api/auth/login', { email, password, role: 'user' });
    console.log('Status:', response.status);
    console.log('Body:', response.body);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.execute('DELETE FROM profiles WHERE id = ?', [id]);
    await pool.end();
  }
}

main();
