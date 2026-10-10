const pool = require('../config/db');
async function assertSchema() {
  const result = await pool.query('SELECT version FROM helpearly_schema WHERE version=2');
  if (!result.rows.length) throw new Error('Database migrations need review and approval before deployment');
}
async function startup() {
  const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : process.env.DB_HOST || 'localhost';
  if (process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1','::1','[::1]','db'].includes(host)) return require('./ensureSchema')();
  return assertSchema(); // Production/remote startup is read-only, always.
}
module.exports = { startup, assertSchema };
