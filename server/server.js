const http = require('http');
const app = require('./app');
const { initializeChat } = require('./socket/chat');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
if(process.env.NODE_ENV==='production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32 || !process.env.CLIENT_URL || process.env.CLIENT_URL.split(',').some(origin=>!origin.trim().startsWith('https://')))) {
  console.error('Production requires a strong JWT_SECRET and HTTPS CLIENT_URL origins');process.exit(1);
}

const server = http.createServer(app);
const shutdown=()=>{ server.close(()=>require('./config/db').end().finally(()=>process.exit(0))); setTimeout(()=>process.exit(1),10000).unref(); };
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

// Initialize Socket.io for real-time chat
initializeChat(server);

if (process.env.NODE_ENV==='production' && ((process.env.STORAGE_PROVIDER || 'local')!=='supabase' || !process.env.DATABASE_URL)) {
  console.error('Production requires DATABASE_URL and persistent Supabase Storage'); process.exit(1);
}
require('./utils/storage').getStorage();
require('./db/startup').startup().then(() => require('./utils/storage').getStorage().check()).then(() => server.listen(PORT, () => {
  if (process.env.RUN_BACKGROUND_WORKER!=='false') { require('./utils/notifications').startNotifications(); require('./utils/background').startCleanup(); }
  console.log(`\n🚀 At Your Service API server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready for real-time chat`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
})).catch(error => { console.error('Database startup failed:', error.message); process.exit(1); });
