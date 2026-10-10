const pool = require('../config/db');
const { attachHelper } = require('../db/profile');

module.exports = async (req, res) => {
  const db = await pool.connect();
  try {
    const { category, services, bio, hourly_rate, experience_years } = req.body;
    if (!category || !Array.isArray(services) || services.length > 100 || services.some(s => !s || typeof s.service_name!=='string' || !s.service_name.trim() || s.service_name.length>100 || !Number.isFinite(Number(s.price)) || Number(s.price) < 0) || !Number.isFinite(Number(hourly_rate)) || Number(hourly_rate) < 0 || !Number.isInteger(Number(experience_years)) || Number(experience_years) < 0) {
      return res.status(400).json({ message: 'Valid category, services, prices, and experience are required' });
    }
    await db.query('BEGIN');
    const cats = await db.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [category]);
    if (!cats.rows[0]) return res.status(400).json({ message: 'Unknown category' });
    const catId = cats.rows[0].id;
    const { rows } = await db.query('UPDATE helpers SET bio=$1, hourly_rate=$2, experience_years=$3 WHERE user_id=$4 RETURNING id', [bio || '', hourly_rate, experience_years, req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Worker profile not found' });
    const id = rows[0].id;
    await db.query('DELETE FROM helper_categories WHERE helper_id=$1', [id]);
    await db.query('INSERT INTO helper_categories (helper_id,category_id) VALUES ($1,$2)', [id,catId]);
    const keep = [];
    for (const service of services) {
      if (service.id) {
        const updated = await db.query('UPDATE helper_services SET service_name=$1,price=$2,category_id=$3 WHERE id=$4 AND helper_id=$5 RETURNING id', [service.service_name.trim(),service.price,catId,service.id,id]);
        if (!updated.rows[0]) throw Object.assign(new Error('Unknown service'),{status:400});
        keep.push(service.id);
      } else {
        const added = await db.query('INSERT INTO helper_services (helper_id,category_id,service_name,price) VALUES ($1,$2,$3,$4) RETURNING id', [id,catId,service.service_name.trim(),service.price]);
        keep.push(added.rows[0].id);
      }
    }
    await db.query('DELETE FROM helper_services WHERE helper_id=$1 AND NOT (id=ANY($2::int[]))', [id,keep]);
    const user = await db.query('SELECT id,name,email,phone,role,location FROM users WHERE id=$1', [req.user.id]);
    const result = await attachHelper(user.rows[0],db);
    await db.query('COMMIT');
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Worker settings could not be saved' });
  } finally {
    await db.query('ROLLBACK');
    db.release();
  }
};
