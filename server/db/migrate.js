require('dotenv').config();
if (!process.argv.includes('--approved')) {
  console.error('No changes made. Review SQL, isolated tests and backup first. After owner approval: npm run db:migrate -- --approved');
  process.exitCode = 1;
} else {
  require('./ensureSchema')().catch(error => { console.error('Migration rolled back:', error.code || error.name); process.exitCode = 1; }).finally(() => require('../config/db').end());
}
