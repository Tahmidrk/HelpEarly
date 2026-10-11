const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { currentPasswordSession } = require('../utils/passwordSession');

// Verify JWT token middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const activeUser = await pool.query(
      'SELECT id, email, role, password_hash FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    if (activeUser.rows.length === 0) {
      return res.status(403).json({ message: 'Account is unavailable' });
    }

    const { password_hash, ...user } = activeUser.rows[0];
    if (!currentPasswordSession(decoded, password_hash)) return res.status(401).json({ message: 'Session expired; sign in again' });
    req.user = { ...decoded, ...user };
    const mode = req.header('X-Active-Role');
    if (mode && !['helper','household','admin'].includes(mode)) return res.status(400).json({message:'Invalid active role'});
    if (mode && req.user.role !== 'both' && mode !== req.user.role) return res.status(403).json({message:'Role is not available to this account'});
    if (mode === 'admin' && req.user.role === 'both') return res.status(403).json({message:'Role is not available to this account'});
    req.activeRole = req.user.role === 'both' ? (mode || 'household') : req.user.role;
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
      'SELECT id, email, role, password_hash FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    if (activeUser.rows.length === 0) {
      return next();
    }

    const { password_hash, ...user } = activeUser.rows[0];
    if (!currentPasswordSession(decoded, password_hash)) return res.status(401).json({ message: 'Session expired; sign in again' });
    req.user = { ...decoded, ...user };
    const mode = req.header('X-Active-Role');
    if (mode && !['helper','household','admin'].includes(mode)) return res.status(400).json({message:'Invalid active role'});
    if (mode && req.user.role !== 'both' && mode !== req.user.role) return res.status(403).json({message:'Role is not available to this account'});
    if (mode === 'admin' && req.user.role === 'both') return res.status(403).json({message:'Role is not available to this account'});
    req.activeRole = req.user.role === 'both' ? (mode || 'household') : req.user.role;
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
    if (!roles.includes(req.activeRole || req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { auth, optionalAuth, requireRole };
