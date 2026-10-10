const pool = require('../config/db');
const { assertBookingSlot } = require('../utils/bookingAvailability');
const { createHash } = require('crypto');

// Create a booking
exports.createBooking = async (req, res) => {
  try {
    const { helper_id, service_id, booking_date, service_date, end_date, notes, total_price, address } = req.body;

    const helperCheck = await pool.query(`
      SELECT h.id, h.user_id
      FROM helpers h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = $1 AND u.is_active = true AND h.is_available = true
    `, [helper_id]);
    if (helperCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Helper is unavailable' });
    }

    if (!['household', 'both'].includes(req.user.role) || req.activeRole === 'helper' || helperCheck.rows[0].user_id === req.user.id) return res.status(403).json({ message: 'Book another worker from household mode' });
    const description = String(req.body.service_description || req.body.sub_service || notes || '').trim();
    if (!description || !address?.trim() || !Number.isFinite(Number(total_price)) || Number(total_price) <= 0) return res.status(400).json({ message: 'Describe the work, enter an address, and offer a positive fee' });
    if (service_id) {
      const service = await pool.query('SELECT id FROM helper_services WHERE id=$1 AND helper_id=$2', [service_id,helper_id]);
      if (!service.rows.length) return res.status(400).json({ message: 'Service does not belong to this worker' });
    }
    const finalBookingDate = new Date(booking_date || service_date);
    if (Number.isNaN(finalBookingDate.getTime())) return res.status(400).json({ message: 'A valid booking date and time are required' });
    const requestKey = createHash('sha256').update(JSON.stringify([req.user.id,Number(helper_id),service_id || null,finalBookingDate.toISOString(),end_date || null,description,Number(total_price),address])).digest('hex');

    const photoPaths = (req.files || []).map(f => `/uploads/${f.filename}`);
    const photosJson = photoPaths.length > 0 ? JSON.stringify(photoPaths) : null;
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [requestKey]);
      const existing = await db.query('SELECT * FROM bookings WHERE user_id=$1 AND request_key=$2',[req.user.id,requestKey]);
      if (existing.rows.length) {
        await db.query('COMMIT');
        res.locals.discardUploads = true;
        return res.status(200).json(existing.rows[0]);
      }
      const { startsAt, endsAt } = await assertBookingSlot(db, helper_id, finalBookingDate, end_date);
      const result = await db.query(
        `INSERT INTO bookings (user_id, helper_id, service_id, booking_date, end_date, notes, total_price, address, photos, service_description, request_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [req.user.id, helper_id, service_id || null, startsAt, endsAt, notes || '', total_price, address, photosJson, description, requestKey]
      );
      await db.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    console.error('CreateBooking error:', error.code || error.name);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Booking could not be saved' });
  }
};

// Get user's bookings (household) or helper's bookings
exports.getBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query, params;

    if ((req.activeRole || req.user.role) === 'helper') {
      query = `
        SELECT b.*, u.id as client_id, u.name as client_name, u.avatar_url as client_avatar, u.phone as client_phone,
               COALESCE(NULLIF(b.service_description, ''), hs.service_name) AS service_name, c.name as category_name, c.icon as category_icon
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN helpers h ON b.helper_id = h.id
        LEFT JOIN helper_services hs ON b.service_id = hs.id
        LEFT JOIN categories c ON hs.category_id = c.id
        WHERE h.user_id = $1 AND u.is_active = true
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT b.*, u.id as helper_user_id, u.name as helper_name, u.avatar_url as helper_avatar, u.phone as helper_phone,
               COALESCE(NULLIF(b.service_description, ''), hs.service_name) AS service_name, c.name as category_name, c.icon as category_icon, h.id as helper_profile_id
        FROM bookings b
        JOIN helpers h ON b.helper_id = h.id
        JOIN users u ON h.user_id = u.id
        LEFT JOIN helper_services hs ON b.service_id = hs.id
        LEFT JOIN categories c ON hs.category_id = c.id
        WHERE b.user_id = $1 AND u.is_active = true
      `;
      params = [req.user.id];
    }

    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }

    query += ` ORDER BY b.booking_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('GetBookings error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update booking status
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Verify ownership
    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (booking.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const b = booking.rows[0];
    const helperCheck = await pool.query('SELECT id FROM helpers WHERE user_id = $1', [req.user.id]);
    const isHelper = req.activeRole === 'helper' && helperCheck.rows.length > 0 && helperCheck.rows[0].id === b.helper_id;
    const isClient = req.activeRole !== 'helper' && b.user_id === req.user.id;

    if (!isHelper && !isClient && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.body.booking_date) {
      const date = new Date(req.body.booking_date);
      if (!isClient || !['pending','confirmed'].includes(b.status) || Number.isNaN(date.getTime())) return res.status(400).json({ message: 'This booking cannot be rescheduled' });
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query('SELECT id FROM helpers WHERE id=$1 FOR UPDATE',[b.helper_id]);
        const current = await db.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[id]);
        if (!['pending','confirmed'].includes(current.rows[0]?.status)) { await db.query('ROLLBACK'); return res.status(409).json({message:'Booking changed; refresh and try again'}); }
        const duration = b.end_date ? new Date(b.end_date)-new Date(b.booking_date) : 60*60*1000;
        const { startsAt, endsAt } = await assertBookingSlot(db,b.helper_id,date,new Date(date.getTime()+duration),b.id);
        const result = await db.query("UPDATE bookings SET booking_date=$1,end_date=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *",[startsAt,endsAt,id]);
        if (!result.rows.length) { await db.query('ROLLBACK'); return res.status(409).json({message:'Booking changed; refresh and try again'}); }
        await db.query('COMMIT');
        return res.json(result.rows[0]);
      } catch(error) { await db.query('ROLLBACK'); throw error; }
      finally { db.release(); }
    }
    const transitions = { pending: ['confirmed','cancelled'], confirmed: ['in_progress','completed','cancelled'], in_progress: ['completed','cancelled'] };
    if (!transitions[b.status]?.includes(status) || (status !== 'cancelled' && !isHelper)) return res.status(400).json({ message: 'Invalid booking status change' });
    const db = await pool.connect();
    let result;
    try {
      await db.query('BEGIN');
      result = await db.query('UPDATE bookings SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND status=$3 RETURNING *', [status,id,b.status]);
      if (!result.rows.length) { await db.query('ROLLBACK'); return res.status(409).json({ message: 'Booking changed; refresh and try again' }); }
      if (status === 'completed' && b.total_price) await db.query(`INSERT INTO payments (booking_id,user_id,helper_id,amount,status) VALUES ($1,$2,$3,$4,'completed')`, [id,b.user_id,b.helper_id,b.total_price]);
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateBooking error:', error.code || error.name);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Server error' });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (booking.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if ((req.activeRole === 'helper' || booking.rows[0].user_id !== req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const result = await pool.query(
      `UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('pending','confirmed','in_progress') RETURNING *`,
      [id]
    );

    if (!result.rows.length) return res.status(409).json({message:'Completed or cancelled bookings cannot be cancelled'});
    res.json(result.rows[0]);
  } catch (error) {
    console.error('CancelBooking error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};
