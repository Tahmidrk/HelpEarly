const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress'];

async function assertBookingSlot(db, helperId, start, end, excludeBookingId) {
  const startsAt = new Date(start);
  const endsAt = end ? new Date(end) : new Date(startsAt.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    const error = new Error('Enter a valid booking time range');
    error.status = 400;
    throw error;
  }

  const worker=await db.query('SELECT h.id FROM helpers h JOIN users u ON u.id=h.user_id WHERE h.id=$1 AND h.is_available=true AND u.is_active=true FOR UPDATE OF h',[helperId]);
  if(!worker.rows.length) throw Object.assign(new Error('This worker is unavailable'),{status:409});
  const params = [helperId, ACTIVE_BOOKING_STATUSES, startsAt, endsAt];
  let where = '';
  if (excludeBookingId) {
    params.push(excludeBookingId);
    where = ` AND id <> $${params.length}`;
  }
  const conflict = await db.query(`
    SELECT id FROM bookings
    WHERE helper_id = $1
      AND status = ANY($2::text[])
      AND booking_date < $4
      AND COALESCE(end_date, booking_date + INTERVAL '1 hour') > $3${where}
    LIMIT 1
  `, params);
  if (conflict.rows.length) {
    const error = new Error('This worker already has a booking at that time');
    error.status = 409;
    throw error;
  }
  return { startsAt, endsAt };
}

module.exports = { assertBookingSlot };
