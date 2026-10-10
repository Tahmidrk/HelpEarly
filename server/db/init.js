const pool = require('../config/db');
require('./ensureSchema')().then(() => console.log('Database ready; existing records preserved.')).catch(e => { console.error(e.message); process.exitCode=1; }).finally(() => pool.end());
