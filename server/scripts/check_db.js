const { createPool } = require('mysql2/promise');
const { env } = require('../src/config');

async function main() {
  const pool = createPool({
    host: env.mysqlHost,
    port: env.mysqlPort || 3306,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    connectionLimit: 2,
  });

  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles'
       ORDER BY ORDINAL_POSITION`,
      [env.mysqlDatabase]
    );

    console.log('profiles table columns:');
    for (const c of cols) {
      console.log(`- ${c.COLUMN_NAME} | ${c.COLUMN_TYPE} | nullable=${c.IS_NULLABLE} | default=${c.COLUMN_DEFAULT}`);
    }

    const [rows] = await pool.query('SELECT * FROM profiles LIMIT 3');
    console.log('\nSample rows (up to 3):');
    console.log(rows);
  } catch (err) {
    console.error('DB check failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
