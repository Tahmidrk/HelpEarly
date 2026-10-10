const router = require('express').Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
router.use(auth);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/', async (req,res,next) => {
  try { res.json((await pool.query('SELECT id,type,title,data,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[req.user.id])).rows); }
  catch (error) { next(error); }
});
router.put('/:id/read', async (req,res,next) => {
  try {
    const result=await pool.query('UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);
    if (!result.rows.length) return res.status(404).json({message:'Notification not found'});
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});
router.post('/devices', async (req,res,next) => {
  const {device_id,token,platform}=req.body;
  if (!uuid.test(String(device_id)) || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(String(token)) || !['android','ios'].includes(platform)) return res.status(400).json({message:'Valid device ID, Expo push token and platform are required'});
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[token]);
    // Token rotation is scoped to this installation. Another installation cannot take its token.
    const previous=await db.query('SELECT device_id FROM push_devices WHERE token=$1',[token]);
    if (previous.rows.length && previous.rows[0].device_id!==device_id) { await db.query('ROLLBACK'); return res.status(409).json({message:'Push token belongs to another installation'}); }
    await db.query(`INSERT INTO push_devices(user_id,device_id,token,platform) VALUES($1,$2,$3,$4)
      ON CONFLICT(device_id) DO UPDATE SET user_id=EXCLUDED.user_id,token=EXCLUDED.token,platform=EXCLUDED.platform,active=true,updated_at=CURRENT_TIMESTAMP`,[req.user.id,device_id,token,platform]);
    await db.query('COMMIT');
    res.status(201).json({registered:true});
  } catch (error) { await db.query('ROLLBACK'); next(error); }
  finally { db.release(); }
});
router.delete('/devices/:deviceId', async (req,res,next) => {
  if (!uuid.test(req.params.deviceId)) return res.status(400).json({message:'Invalid device ID'});
  try {
    await pool.query('UPDATE push_devices SET active=false,updated_at=CURRENT_TIMESTAMP WHERE device_id=$1 AND user_id=$2',[req.params.deviceId,req.user.id]);
    res.json({deactivated:true});
  } catch (error) { next(error); }
});
module.exports=router;
