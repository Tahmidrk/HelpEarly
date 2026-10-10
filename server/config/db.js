const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const databaseUrl=process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
// Connection-string SSL parameters replace pg's explicit ssl object; keep policy centralized.
for(const option of ['ssl','sslmode','sslcert','sslkey','sslrootcert']) databaseUrl?.searchParams.delete(option);
const hostname=databaseUrl?.hostname || process.env.DB_HOST || 'localhost';
const isLocalDatabaseUrl=['localhost','127.0.0.1','::1','[::1]','db'].includes(hostname);
const ssl=process.env.DB_SSL==='false' || isLocalDatabaseUrl ? false : {
  rejectUnauthorized:process.env.DB_SSL_ALLOW_SELF_SIGNED!=='true',
  ...(process.env.DB_SSL_CA ? {ca:process.env.DB_SSL_CA.replace(/\\n/g,'\n')} : {}),
};

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: databaseUrl.toString(),
      ssl,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'at_your_service',
      ssl,
    };

const pool = new Pool({ ...poolConfig, connectionTimeoutMillis: 5000 });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.code || err.name);
  process.exit(-1);
});

module.exports = pool;
