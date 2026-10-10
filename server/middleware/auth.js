const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Verify JWT token middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const activeUser = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    if (activeUser.rows.length === 0) {
      return res.status(403).json({ message: 'Account is unavailable' });
    }

    req.user = { ...decoded, ...activeUser.rows[0] };
    const mode = req.header('X-Active-Role');
    req.activeRole = req.user.role === 'both' && ['helper', 'household'].includes(mode) ? mode : req.user.role;
    next();
  } catch (error) {
    const invalid=['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(error.name);
    res.status(invalid?401:503).json({ message: invalid?'Token is not valid':'Authentication database unavailable; retry shortly' });
  }
};

// Attach JWT payload when present, but allow public access without a token.
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const activeUser = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    if (activeUser.rows.length === 0) {
      return next();
    }

    req.user = { ...decoded, ...activeUser.rows[0] };
    const mode = req.header('X-Active-Role');
    req.activeRole = req.user.role === 'both' && ['helper', 'household'].includes(mode) ? mode : req.user.role;
    next();
  } catch (error) {
    const invalid=['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(error.name);
    res.status(invalid?401:503).json({ message: invalid?'Token is not valid':'Authentication database unavailable; retry shortly' });
  }
};

// Role-based access control middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!roles.includes(req.activeRole || req.user.role) && !(req.user.role === 'both' && !req.header('X-Active-Role') && roles.some(r => ['helper', 'household'].includes(r)))) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { auth, optionalAuth, requireRole };
