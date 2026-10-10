const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
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
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')));

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

// Health check
app.get('/api/health', async (req, res) => {
  try { await require('./config/db').query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Request failed:',err.code || err.name);
  res.status(err.status || 500).json({message: err.status && err.status<500 ? err.message : 'Internal server error'});
});

module.exports = app;
