const pool = require('../config/db');
const {getIO}=require('../socket/chat');

// Get platform statistics
exports.getStats = async (req, res) => {
  try {
    const [users, helpers, userBreakdown, bookings, reviews, jobs] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM helpers h JOIN users u ON h.user_id = u.id WHERE u.is_active = true'),
      pool.query(`SELECT
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE is_active = true)::int as active,
                    COUNT(*) FILTER (WHERE is_active = false)::int as banned,
                    COUNT(*) FILTER (WHERE role = 'household')::int as households,
                    COUNT(*) FILTER (WHERE role = 'helper')::int as helpers,
                    COUNT(*) FILTER (WHERE role = 'admin')::int as admins,
                    COUNT(*) FILTER (WHERE role = 'household' AND is_active = true)::int as active_households,
                    COUNT(*) FILTER (WHERE role = 'helper' AND is_active = true)::int as active_helpers,
                    COUNT(*) FILTER (WHERE role = 'admin' AND is_active = true)::int as active_admins,
                    COUNT(*) FILTER (WHERE role = 'household' AND is_active = false)::int as banned_households,
                    COUNT(*) FILTER (WHERE role = 'helper' AND is_active = false)::int as banned_helpers,
                    COUNT(*) FILTER (WHERE role = 'admin' AND is_active = false)::int as banned_admins
                  FROM users`),
      pool.query(`SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE b.status = 'pending') as pending,
                  COUNT(*) FILTER (WHERE b.status = 'completed') as completed
                  FROM bookings b
                  JOIN users cu ON b.user_id = cu.id
                  JOIN helpers h ON b.helper_id = h.id
                  JOIN users hu ON h.user_id = hu.id
                  WHERE cu.is_active = true AND hu.is_active = true`),
      pool.query(`SELECT COUNT(*) as total, AVG(r.rating)::DECIMAL(3,2) as avg_rating
                  FROM reviews r
                  JOIN users u ON r.user_id = u.id
                  JOIN helpers h ON r.helper_id = h.id
                  JOIN users hu ON h.user_id = hu.id
                  WHERE u.is_active = true AND hu.is_active = true`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE j.status = 'open') as open
                  FROM jobs j JOIN users u ON j.user_id = u.id
                  WHERE u.is_active = true`),
    ]);

    // Revenue
    const revenue = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'");

    // Recent activity
    const recentBookings = await pool.query(`
      SELECT b.*, u.id as client_id, u.name as client_name,
             h.id as helper_profile_id, hu.id as helper_user_id, hu.name as helper_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN helpers h ON b.helper_id = h.id
      JOIN users hu ON h.user_id = hu.id
      WHERE u.is_active = true AND hu.is_active = true
      ORDER BY b.created_at DESC LIMIT 10
    `);

    res.json({
      users: parseInt(users.rows[0].count),
      helpers: parseInt(helpers.rows[0].count),
      bookings: {
        total: parseInt(bookings.rows[0].total),
        pending: parseInt(bookings.rows[0].pending),
        completed: parseInt(bookings.rows[0].completed),
      },
      reviews: {
        total: parseInt(reviews.rows[0].total),
        avgRating: parseFloat(reviews.rows[0].avg_rating) || 0,
      },
      jobs: {
        total: parseInt(jobs.rows[0].total),
        open: parseInt(jobs.rows[0].open),
      },
      userBreakdown: userBreakdown.rows[0],
      revenue: parseFloat(revenue.rows[0].total),
      recentBookings: recentBookings.rows,
    });
  } catch (error) {
    console.error('GetStats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT u.id, u.name, u.email, u.phone, u.nid_number, u.role, u.location, u.avatar_url, u.is_active,
             u.created_at, h.id as helper_profile_id, h.is_verified
      FROM users u
      LEFT JOIN helpers h ON h.user_id = u.id
      WHERE 1=1`;
    const params = [];

    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const userBreakdown = await pool.query(`SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE is_active = true)::int as active,
      COUNT(*) FILTER (WHERE is_active = false)::int as banned,
      COUNT(*) FILTER (WHERE role = 'household')::int as households,
      COUNT(*) FILTER (WHERE role = 'helper')::int as helpers,
      COUNT(*) FILTER (WHERE role = 'admin')::int as admins,
      COUNT(*) FILTER (WHERE role = 'household' AND is_active = true)::int as active_households,
      COUNT(*) FILTER (WHERE role = 'helper' AND is_active = true)::int as active_helpers,
      COUNT(*) FILTER (WHERE role = 'admin' AND is_active = true)::int as active_admins,
      COUNT(*) FILTER (WHERE role = 'household' AND is_active = false)::int as banned_households,
      COUNT(*) FILTER (WHERE role = 'helper' AND is_active = false)::int as banned_helpers,
      COUNT(*) FILTER (WHERE role = 'admin' AND is_active = false)::int as banned_admins
      FROM users`);

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      userBreakdown: userBreakdown.rows[0],
    });
  } catch (error) {
    console.error('GetUsers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user (verify helper, ban user, etc.)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, role } = req.body;
    if((is_active!==undefined && typeof is_active!=='boolean') || (role!==undefined && !['household','helper','both','admin'].includes(role))) return res.status(400).json({message:'Invalid account update'});
    if(Number(id)===req.user.id && (is_active===false || (role && role!=='admin'))) return res.status(400).json({message:'You cannot disable your own admin access'});

    const result = await pool.query(
      `UPDATE users SET is_active = COALESCE($1, is_active), role = COALESCE($2, role), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING id, name, email, role, is_active`,
      [is_active, role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if(is_active===false) getIO()?.in(`user_${id}`).disconnectSockets(true);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify helper
exports.verifyHelper = async (req, res) => {
  try {
    const { id } = req.params;
    const isVerified = req.body.is_verified !== undefined ? Boolean(req.body.is_verified) : true;
    if(req.body.is_verified!==undefined && typeof req.body.is_verified!=='boolean') return res.status(400).json({message:'Verification must be true or false'});
    const result = await pool.query(
      'UPDATE helpers SET is_verified = $1 WHERE id = $2 RETURNING *',
      [isVerified, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Helper not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('VerifyHelper error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete job post (content moderation)
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM jobs WHERE id = $1', [id]);
    res.json({ message: 'Job post deleted by admin' });
  } catch (error) {
    console.error('DeleteJob error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete review (content moderation)
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    res.json({ message: 'Review deleted by admin' });
  } catch (error) {
    console.error('DeleteReview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
