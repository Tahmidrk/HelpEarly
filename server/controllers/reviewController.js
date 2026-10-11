const pool = require('../config/db');

// Submit a review
exports.createReview = async (req, res) => {
  try {
    const { helper_id, booking_id, rating, comment } = req.body;

    if (!booking_id || !Number.isInteger(rating) || rating < 1 || rating > 5 || !['household','both'].includes(req.user.role) || req.activeRole === 'helper') return res.status(400).json({ message: 'Rate a completed booking from household mode with 1 to 5 stars' });
    const booking = await pool.query(`SELECT b.id FROM bookings b JOIN helpers h ON h.id=b.helper_id WHERE b.id=$1 AND b.user_id=$2 AND b.helper_id=$3 AND b.status='completed' AND h.user_id<>$2`, [booking_id,req.user.id,helper_id]);
    if (!booking.rows.length) return res.status(400).json({ message: 'You can only review your own completed booking with another worker' });

    const result = await pool.query(
      `INSERT INTO reviews (user_id, helper_id, booking_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, helper_id, booking_id, rating, comment]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'You already reviewed this booking' });
    console.error('CreateReview error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get reviews for a helper
exports.getHelperReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT r.*, u.id as reviewer_id, u.name as reviewer_name, u.avatar_url as reviewer_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.helper_id = $1 AND NOT r.is_hidden
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), parseInt(offset)]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM reviews WHERE helper_id = $1 AND NOT is_hidden', [id]
    );

    res.json({
      reviews: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('GetHelperReviews error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};
