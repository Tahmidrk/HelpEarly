const pool = require('../config/db');

// Get all helpers with search, filter, and sort
exports.getHelpers = async (req, res) => {
  try {
    const { search, category, location, min_rating, max_rate, sort, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT h.*, u.name, u.location, u.avatar_url, u.latitude, u.longitude,
             COALESCE(
               (SELECT c2.name FROM helper_categories hc2 JOIN categories c2 ON hc2.category_id = c2.id WHERE hc2.helper_id = h.id LIMIT 1),
               (SELECT c3.name FROM helper_services hs3 JOIN categories c3 ON hs3.category_id = c3.id WHERE hs3.helper_id = h.id LIMIT 1)
             ) as primary_category,
             COALESCE(json_agg(DISTINCT jsonb_build_object(
               'id', hs.id, 'service_name', hs.service_name, 'price', hs.price,
               'category_id', hs.category_id, 'category_name', c.name, 'category_icon', c.icon
             )) FILTER (WHERE hs.id IS NOT NULL), '[]') as services
      FROM helpers h
      JOIN users u ON h.user_id = u.id
      LEFT JOIN helper_services hs ON hs.helper_id = h.id
      LEFT JOIN categories c ON hs.category_id = c.id
      WHERE u.is_active = true
    `;
    const params = [];
    let paramCount = 0;

    if (req.user) {
      params.push(req.user.id);
      query += ` AND h.user_id <> $${++paramCount}`;
    }

    // Search by name or service
    if (search) {
      paramCount++;
      query += ` AND (u.name ILIKE $${paramCount} OR hs.service_name ILIKE $${paramCount} OR h.bio ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Filter by category
    if (category) {
      paramCount++;
      query += ` AND (EXISTS (SELECT 1 FROM helper_categories hc WHERE hc.helper_id = h.id AND hc.category_id = $${paramCount}) OR EXISTS (SELECT 1 FROM helper_services sx WHERE sx.helper_id = h.id AND sx.category_id = $${paramCount}))`;
      params.push(category);
    }

    // Filter by location
    if (location) {
      paramCount++;
      query += ` AND u.location ILIKE $${paramCount}`;
      params.push(`%${location}%`);
    }

    // Filter by min rating
    if (min_rating) {
      paramCount++;
      query += ` AND h.avg_rating >= $${paramCount}`;
      params.push(min_rating);
    }

    // Filter by max rate
    if (max_rate) {
      paramCount++;
      query += ` AND h.hourly_rate <= $${paramCount}`;
      params.push(max_rate);
    }

    query += ` GROUP BY h.id, u.id`;

    // Sorting
    switch (sort) {
      case 'rating_desc':
        query += ' ORDER BY h.avg_rating DESC';
        break;
      case 'rating_asc':
        query += ' ORDER BY h.avg_rating ASC';
        break;
      case 'price_asc':
        query += ' ORDER BY h.hourly_rate ASC';
        break;
      case 'price_desc':
        query += ' ORDER BY h.hourly_rate DESC';
        break;
      case 'reviews':
        query += ' ORDER BY h.total_reviews DESC';
        break;
      default:
        query += ' ORDER BY h.avg_rating DESC, h.total_reviews DESC';
    }

    // Count total
    const countQuery = `SELECT COUNT(*) FROM (${query}) matched`;
    const countParams = [...params];

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const [helpersResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    res.json({
      helpers: helpersResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (error) {
    console.error('GetHelpers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single helper profile
exports.getHelper = async (req, res) => {
  try {
    const { id } = req.params;

    const helperResult = await pool.query(`
      SELECT h.*, u.name, u.location, u.avatar_url, u.latitude, u.longitude
      FROM helpers h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = $1 AND u.is_active = true
    `, [id]);

    if (helperResult.rows.length === 0) {
      return res.status(404).json({ message: 'Helper not found' });
    }

    const helper = helperResult.rows[0];
    if (req.user && Number(helper.user_id) === Number(req.user.id)) {
      return res.status(404).json({ message: 'Your worker profile is not shown to your household account' });
    }

    // Get services
    const servicesResult = await pool.query(`
      SELECT hs.*, c.name as category_name, c.icon as category_icon
      FROM helper_services hs
      JOIN categories c ON hs.category_id = c.id
      WHERE hs.helper_id = $1
    `, [id]);

    // Get reviews
    const reviewsResult = await pool.query(`
      SELECT r.*, u.id as reviewer_id, u.name as reviewer_name, u.avatar_url as reviewer_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.helper_id = $1 AND u.is_active = true
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [id]);

    const cats = await pool.query('SELECT c.* FROM categories c JOIN helper_categories hc ON c.id = hc.category_id WHERE hc.helper_id = $1 ORDER BY c.id', [helper.id]);
    helper.categories = cats.rows;
    helper.primary_category = cats.rows[0]?.name || null;
    helper.services = servicesResult.rows;
    helper.reviews = reviewsResult.rows;

    res.json(helper);
  } catch (error) {
    console.error('GetHelper error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update helper profile (for logged-in helper)
exports.updateHelper = async (req, res) => {
  try {
    const { bio, hourly_rate, is_available, experience_years } = req.body;
    if((hourly_rate!==undefined && (!Number.isFinite(Number(hourly_rate)) || Number(hourly_rate)<0)) || (experience_years!==undefined && (!Number.isInteger(Number(experience_years)) || Number(experience_years)<0)) || (is_available!==undefined && typeof is_available!=='boolean')) return res.status(400).json({message:'Valid rate, experience and availability are required'});

    const result = await pool.query(`
      UPDATE helpers SET bio = COALESCE($1, bio), hourly_rate = COALESCE($2, hourly_rate),
      is_available = COALESCE($3, is_available), experience_years = COALESCE($4, experience_years),
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $5
      RETURNING *
    `, [bio, hourly_rate, is_available, experience_years, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Helper profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateHelper error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a service to helper profile
exports.addService = async (req, res) => {
  try {
    const { category_id, service_name, description, price } = req.body;
    if(!category_id || typeof service_name!=='string' || !service_name.trim() || !Number.isFinite(Number(price)) || Number(price)<0) return res.status(400).json({message:'Category, service name and a valid nonnegative price are required'});

    // Get helper id from user id
    const helperResult = await pool.query('SELECT id FROM helpers WHERE user_id = $1', [req.user.id]);
    if (helperResult.rows.length === 0) {
      return res.status(404).json({ message: 'Helper profile not found' });
    }

    const result = await pool.query(
      `INSERT INTO helper_services (helper_id, category_id, service_name, description, price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [helperResult.rows[0].id, category_id, service_name, description, price]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('AddService error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const helperResult = await pool.query('SELECT id FROM helpers WHERE user_id = $1', [req.user.id]);
    if (helperResult.rows.length === 0) {
      return res.status(404).json({ message: 'Helper profile not found' });
    }

    await pool.query(
      'DELETE FROM helper_services WHERE id = $1 AND helper_id = $2',
      [serviceId, helperResult.rows[0].id]
    );

    res.json({ message: 'Service deleted' });
  } catch (error) {
    console.error('DeleteService error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get helper by user ID (for logged-in helper)
exports.getMyHelperProfile = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, u.name, u.email, u.phone, u.location, u.avatar_url
      FROM helpers h
      JOIN users u ON h.user_id = u.id
      WHERE h.user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Helper profile not found' });
    }

    const helper = result.rows[0];

    const servicesResult = await pool.query(`
      SELECT hs.*, c.name as category_name, c.icon as category_icon
      FROM helper_services hs
      JOIN categories c ON hs.category_id = c.id
      WHERE hs.helper_id = $1
    `, [helper.id]);

    const cats = await pool.query('SELECT c.* FROM categories c JOIN helper_categories hc ON c.id = hc.category_id WHERE hc.helper_id = $1 ORDER BY c.id', [helper.id]);
    helper.categories = cats.rows;
    helper.primary_category = cats.rows[0]?.name || null;
    helper.services = servicesResult.rows;
    res.json(helper);
  } catch (error) {
    console.error('GetMyHelperProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
