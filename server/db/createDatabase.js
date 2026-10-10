require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function createDatabase() {
  const database = process.env.DB_NAME || 'at_your_service';
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE ${database}`);
  await client.end();
  console.log(exists.rowCount ? 'Database already exists' : 'Database created');
}

createDatabase().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
