const pool = require('../config/db');

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GetCategories error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single category with helpers
exports.getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryResult = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Get helpers in this category
    const helpersResult = await pool.query(`
      SELECT DISTINCT h.*, u.name, u.location, u.avatar_url
      FROM helpers h
      JOIN users u ON h.user_id = u.id
      JOIN helper_services hs ON hs.helper_id = h.id
      WHERE hs.category_id = $1 AND u.is_active = true
      ORDER BY h.avg_rating DESC
    `, [id]);

    res.json({
      ...categoryResult.rows[0],
      helpers: helpersResult.rows,
    });
  } catch (error) {
    console.error('GetCategory error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};
