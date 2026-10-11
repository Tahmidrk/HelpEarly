const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
app.use((req,res,next) => {
  const started=Date.now(),requestId=require('node:crypto').randomUUID();
  req.requestId=requestId;res.set('X-Request-ID',requestId);
  if (req.path.startsWith('/api')) res.set('Cache-Control','no-store');
  res.on('finish',()=>{if(process.env.LOG_REQUESTS==='true') console.log(JSON.stringify({event:'http',request_id:requestId,method:req.method,route:req.route?.path || 'route',status:res.statusCode,duration_ms:Date.now()-started}));});
  next();
});
if(process.env.TRUST_PROXY === '1') app.set('trust proxy',1);
const allowedOrigins=(process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:8081').split(',').map(value=>value.trim()).filter(Boolean);
if(process.env.NODE_ENV!=='production') allowedOrigins.push('http://localhost:8081','http://127.0.0.1:8081');
// Middleware
app.use(cors({
  origin: (origin,callback)=>callback(null,!origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({ extended: true, limit:'100kb' }));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
app.use('/api',require('./middleware/validateRequest'));
const rateLimit=require('./middleware/rateLimit');
app.use('/api/auth/login',rateLimit('login',process.env.NODE_ENV==='production'?30:120,15*60*1000));
app.use('/api/auth/register',rateLimit('register',process.env.NODE_ENV==='production'?15:120,60*60*1000));
app.use('/api/chatbot',rateLimit('ai',30,60*1000));
app.use('/api',rateLimit('api',600,60*1000));

// Static files (uploads)
if ((process.env.STORAGE_PROVIDER || 'local') === 'local') app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')));
app.use('/api', (req,res,next) => {
  const json = res.json.bind(res);
  res.json = data => {
    if (res.statusCode >= 400 || (process.env.STORAGE_PROVIDER || 'local') === 'local') return json(data);
    require('./utils/storage').decorateMedia(data).then(json).catch(next);
    return res;
  };
  // A hint contains no records or IDs. Clients validate durable revisions before refetching.
  res.on('finish', () => { if (res.statusCode < 400 && !['GET','HEAD','OPTIONS'].includes(req.method)) require('./socket/chat').getIO()?.emit('sync_hint'); });
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/helpers', require('./routes/helpers'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/sync', require('./routes/sync'));

// Health check
app.get('/api/health', async (req, res) => {
  try { await require('./config/db').query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
});
app.get('/api/ready', async (req,res) => {
  try { const schema=await require('./db/startup').assertSchema(); res.json({status:'ready',schema}); }
  catch { res.status(503).json({status:'unavailable',message:'Database schema is not ready'}); }
});
app.use((req,res) => res.status(404).json({message:'Route not found'}));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Request failed:',err.code || err.name);
  res.status(err.status || 500).json({message: err.status && err.status<500 ? err.message : 'Internal server error',request_id:req.requestId});
});

module.exports = app;
