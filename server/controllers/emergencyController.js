const pool = require('../config/db');
const { getIO } = require('../socket/chat');
const { assertBookingSlot } = require('../utils/bookingAvailability');
const eligibility = `(e.category_id IS NULL OR EXISTS(SELECT 1 FROM helper_categories hc WHERE hc.helper_id=h.id AND hc.category_id=e.category_id) OR EXISTS(SELECT 1 FROM helper_services hs WHERE hs.helper_id=h.id AND hs.category_id=e.category_id))`;
const fail = (status,message) => Object.assign(new Error(message),{status});
const publicError = (res,error) => res.status(error.status || 500).json({message:error.status ? error.message : 'Emergency service is temporarily unavailable'});

exports.triggerEmergencyAlert = async (req,res) => {
  try {
    const profile = (await pool.query('SELECT name,phone,location FROM users WHERE id=$1',[req.user.id])).rows[0];
    const location = typeof req.body.location==='string' ? req.body.location.trim() : profile.location;
    const phone = (typeof req.body.contact_phone==='string' && req.body.contact_phone.trim()) || profile.phone;
    if (!location || !phone) throw fail(400,'Location and contact phone are required');
    if (!/^\+?[\d ()-]{7,25}$/.test(phone) || phone.replace(/\D/g,'').length<7) throw fail(400,'Enter a valid contact phone number');
    const category = (await pool.query('SELECT id,name FROM categories WHERE is_visible AND (id=$1 OR lower(name)=lower($2)) LIMIT 1',[req.body.category_id || null,req.body.category_name || null])).rows[0];
    if (!category) throw fail(400,'Select a valid emergency category');
    const description = typeof req.body.description==='string' && req.body.description.trim() ? req.body.description.trim() : 'Immediate assistance required';
    if (description.length>5000 || location.length>500 || phone.length>50) throw fail(400,'Emergency details are too long');
    const emergency = (await pool.query('INSERT INTO emergency_requests(household_id,category_id,description,location,contact_phone) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.user.id,category.id,description,location,phone])).rows[0];
    const helpers = await pool.query(`SELECT h.user_id FROM helpers h JOIN users u ON u.id=h.user_id JOIN emergency_requests e ON e.id=$1 WHERE u.is_active AND u.role IN('helper','both') AND h.is_available AND h.user_id<>$2 AND ${eligibility}`,[emergency.id,req.user.id]);
    const alertDetails = {...emergency,household_name:profile.name,household_phone:phone,category_name:category.name};
    for (const helper of helpers.rows) getIO()?.to(`user_${helper.user_id}_helper`).emit('emergency_alert',{request_id:emergency.id});
    res.json({message:'Emergency request created',helpersNotified:helpers.rows.length,alertDetails});
  } catch (error) { publicError(res,error); }
};

exports.getEmergencyRequests = async (req,res) => {
  try {
    // Expiry is derived from timestamp; keep existing persisted status names.
    let query = `SELECT e.*,c.name AS category_name,u.name AS household_name,hu.name AS helper_name,b.status AS booking_status,
      CASE WHEN e.status='pending' AND e.expires_at<=CURRENT_TIMESTAMP THEN 'expired' ELSE e.status END AS effective_status
      FROM emergency_requests e JOIN users u ON u.id=e.household_id LEFT JOIN categories c ON c.id=e.category_id
      LEFT JOIN helpers accepted ON accepted.id=e.helper_id LEFT JOIN users hu ON hu.id=accepted.user_id LEFT JOIN bookings b ON b.id=e.booking_id`;
    if (req.activeRole==='helper') query += ` JOIN helpers h ON h.user_id=$1 WHERE u.is_active AND e.household_id<>$1 AND
      ((e.status='pending' AND e.expires_at>CURRENT_TIMESTAMP AND h.is_available AND ${eligibility}
      AND NOT EXISTS(SELECT 1 FROM emergency_declines d WHERE d.request_id=e.id AND d.helper_id=h.id)) OR e.helper_id=h.id)`;
    else query += ' WHERE e.household_id=$1';
    res.json((await pool.query(query+' ORDER BY e.created_at DESC LIMIT 100',[req.user.id])).rows);
  } catch (error) { publicError(res,error); }
};

exports.acceptEmergencyAlert = async (req,res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const helper = (await db.query('SELECT * FROM helpers WHERE user_id=$1 AND is_available=true FOR UPDATE',[req.user.id])).rows[0];
    if (!helper) throw fail(403,'An available worker profile is required');
    const emergency = (await db.query("SELECT *,expires_at>CURRENT_TIMESTAMP AS unexpired FROM emergency_requests WHERE id=$1 AND status='pending' FOR UPDATE",[req.params.id])).rows[0];
    if (!emergency || !emergency.unexpired) throw fail(409,'This emergency request is expired or no longer available');
    if (Number(emergency.household_id)===Number(req.user.id)) throw fail(403,'You cannot accept your own emergency request');
    const eligible = await db.query(`SELECT 1 FROM helpers h JOIN users u ON u.id=$2 AND u.is_active JOIN emergency_requests e ON e.id=$1 WHERE h.id=$3 AND ${eligibility} AND NOT EXISTS(SELECT 1 FROM emergency_declines d WHERE d.request_id=e.id AND d.helper_id=h.id)`,[emergency.id,emergency.household_id,helper.id]);
    if (!eligible.rows.length) throw fail(403,'This request is unavailable or does not match your category');
    const {startsAt,endsAt} = await assertBookingSlot(db,helper.id,new Date(),null);
    const booking = (await db.query(`INSERT INTO bookings(user_id,helper_id,booking_date,end_date,status,service_description,total_price,address) VALUES($1,$2,$3,$4,'confirmed',$5,$6,$7) RETURNING *`,[emergency.household_id,helper.id,startsAt,endsAt,emergency.description,helper.hourly_rate || 0,emergency.location])).rows[0];
    await db.query("UPDATE emergency_requests SET status='accepted',helper_id=$1,booking_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3",[helper.id,booking.id,emergency.id]);
    await db.query('COMMIT');
    getIO()?.to(`user_${emergency.household_id}`).emit('emergency_accepted',{request_id:emergency.id,booking});
    res.json({message:'Emergency request accepted',booking});
  } catch (error) { await db.query('ROLLBACK'); publicError(res,error); }
  finally { db.release(); }
};

exports.declineEmergency = async (req,res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await db.query(`SELECT h.id AS helper_id FROM emergency_requests e JOIN helpers h ON h.user_id=$2 WHERE e.id=$1 AND e.household_id<>$2 AND e.status='pending' AND e.expires_at>CURRENT_TIMESTAMP AND h.is_available AND ${eligibility} FOR UPDATE OF e`,[req.params.id,req.user.id]);
    if (!result.rows.length) throw fail(409,'Emergency request is no longer available');
    await db.query('INSERT INTO emergency_declines(request_id,helper_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,result.rows[0].helper_id]);
    await db.query('COMMIT');
    res.json({message:'Emergency declined'});
  } catch (error) { await db.query('ROLLBACK'); publicError(res,error); }
  finally { db.release(); }
};

exports.cancelEmergency = async (req,res) => {
  try {
    const result = await pool.query("UPDATE emergency_requests SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND household_id=$2 AND status='pending' RETURNING id",[req.params.id,req.user.id]);
    if (!result.rows.length) throw fail(409,'Request cannot be cancelled');
    res.json({message:'Emergency cancelled'});
  } catch (error) { publicError(res,error); }
};
