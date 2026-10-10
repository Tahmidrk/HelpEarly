require('dotenv').config();
const pool = require('./config/db');
require('./db/startup').assertSchema().then(() => {
  require('./utils/notifications').startNotifications();
  require('./utils/background').startCleanup();
  console.log('HelpEarly database-backed worker started');
}).catch(error => { console.error('Worker startup failed:',error.code || error.name); process.exit(1); });
const shutdown = () => pool.end().finally(() => process.exit(0));
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
setInterval(() => {}, 60000);
