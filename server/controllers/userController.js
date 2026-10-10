const pool = require('../config/db');

exports.getPublicUser = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT u.id, u.name, u.role, u.location, u.avatar_url, u.created_at,
             h.id as helper_profile_id, h.bio, h.hourly_rate, h.avg_rating,
             h.total_reviews, h.is_verified, h.is_available, h.experience_years
      FROM users u
      LEFT JOIN helpers h ON h.user_id = u.id
      WHERE u.id = $1 AND u.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User is unavailable' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('GetPublicUser error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};
