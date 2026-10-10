const { attachHelper } = require('../db/profile');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register a new user
exports.register = async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { name, email, password, phone, nid_number, role, location, latitude, longitude } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof name === 'string' ? name.trim() : '';

    if (!cleanName || cleanName.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length>255 || typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password)>72 || !['household', 'helper', 'both'].includes(role)) {
      return res.status(400).json({ message: 'Valid name, email, password (6+ characters), and user role are required' });
    }
    if (!nid_number) {
      return res.status(400).json({ message: 'NID card number is required for security verification' });
    }

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE LOWER(TRIM(email)) = $1', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, nid_number, role, location, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, phone, nid_number, role, location, avatar_url, created_at`,
      [cleanName, cleanEmail, password_hash, phone, nid_number, role || 'household', location, latitude, longitude]
    );

    let user = result.rows[0];

    // If helper or dual role, create helper profile
    if (role === 'helper' || role === 'both') {
      const { bio, hourly_rate, experience_years } = req.body;
      let selectedCategories = req.body.selectedCategories;
      if (!selectedCategories && req.body.category) {
        const category = await db.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [req.body.category]);
        selectedCategories = category.rows.map(c => c.id);
      }
      if (!Array.isArray(selectedCategories) || !selectedCategories.length || selectedCategories.some(id => !Number.isInteger(Number(id)))) {
        return res.status(400).json({ message: 'Select a valid work category' });
      }
      const valid = await db.query('SELECT id FROM categories WHERE id = ANY($1::int[])', [selectedCategories]);
      if (valid.rows.length !== new Set(selectedCategories.map(Number)).size) return res.status(400).json({ message: 'Unknown work category' });
      const helperResult = await db.query(
        `INSERT INTO helpers (user_id, bio, hourly_rate, experience_years)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [user.id, bio || '', hourly_rate || 0, experience_years || 0]
      );

      // Insert selected categories
      const helperId = helperResult.rows[0].id;
      if (selectedCategories && selectedCategories.length > 0) {
        for (const catId of selectedCategories) {
          await db.query(
            `INSERT INTO helper_categories (helper_id, category_id, experience_years, hourly_rate)
             VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [helperId, catId, experience_years || 0, hourly_rate || 0]
          );
        }
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    user = await attachHelper(user, db);
    await db.query('COMMIT');
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error.code || error.name);
    res.status(error.code === '23505' ? 400 : 500).json({ message: error.code === '23505' ? 'Email already registered' : 'Registration could not be saved' });
  } finally {
    await db.query('ROLLBACK');
    db.release();
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password.trim() : '';


    // Find user
    const result = await pool.query(
      'SELECT id, name, email, password_hash, phone, role, location, avatar_url, is_active FROM users WHERE LOWER(TRIM(email)) = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account has been deactivated' });
    }

    const isMatch = (await bcrypt.compare(cleanPassword, user.password_hash)) || (await bcrypt.compare(password || '', user.password_hash));

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password_hash from response
    delete user.password_hash;

    res.json({ token, user: await attachHelper(user) });
  } catch (error) {
    console.error('Login error:', error.code || error.name);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Get current user profile
exports.getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, location, latitude, longitude, avatar_url, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    res.json(await attachHelper(user));
  } catch (error) {
    console.error('GetMe error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, location, latitude, longitude } = req.body;
    if((name!==undefined && !name.trim()) || (req.body.hourly_rate!==undefined && (!Number.isFinite(Number(req.body.hourly_rate)) || Number(req.body.hourly_rate)<0)) || (req.body.experience_years!==undefined && (!Number.isInteger(Number(req.body.experience_years)) || Number(req.body.experience_years)<0)) || (req.body.is_available!==undefined && typeof req.body.is_available!=='boolean')) return res.status(400).json({message:'Valid profile name, rate, experience and availability are required'});
    const avatar_url = req.file ? `/uploads/${req.file.filename}` : undefined;

    let query = `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone),
                  location = COALESCE($3, location), latitude = COALESCE($4, latitude),
                  longitude = COALESCE($5, longitude), updated_at = CURRENT_TIMESTAMP`;
    const params = [name, phone, location, latitude, longitude];

    if (avatar_url) {
      query += `, avatar_url = $${params.length + 1}`;
      params.push(avatar_url);
    }

    query += ` WHERE id = $${params.length + 1} RETURNING id, name, email, phone, role, location, avatar_url`;
    params.push(req.user.id);

    const result = await pool.query(query, params);

    // If helper, update helper-specific fields
    if (['helper', 'both'].includes(req.user.role)) {
      const { bio, hourly_rate, is_available, experience_years } = req.body;
      await pool.query(
        `UPDATE helpers SET bio = COALESCE($1, bio), hourly_rate = COALESCE($2, hourly_rate),
         is_available = COALESCE($3, is_available), experience_years = COALESCE($4, experience_years),
         updated_at = CURRENT_TIMESTAMP WHERE user_id = $5`,
        [bio, hourly_rate, is_available, experience_years, req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateProfile error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Change password for the logged-in user
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (typeof new_password!=='string' || new_password.length < 6 || Buffer.byteLength(new_password)>72) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const matches = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!matches) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [password_hash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('ChangePassword error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};
