const router = require('express').Router();
const { auth } = require('../middleware/auth');
const pool = require('../config/db');
router.get('/', auth, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT resource, string_agg(user_id::text||':'||version::text, ',' ORDER BY user_id) AS revision
      FROM sync_revisions WHERE user_id IN (0,$1) AND (resource<>'admin' OR $2='admin') GROUP BY resource ORDER BY resource`, [req.user.id, req.user.role]);
    const ai = await pool.query("SELECT count(*)::text || ':' || COALESCE(max(id),0)::text AS revision FROM ai_messages WHERE user_id=$1", [req.user.id]);
    // Include untouched resources so foreground refresh also renews legacy signed media.
    const resources = ['helpers', 'profile', 'categories', 'bookings', 'jobs', 'messages', 'complaints', 'emergency', 'notifications'];
    if (req.user.role === 'admin') resources.push('admin');
    res.set('Cache-Control', 'no-store').json({ ...Object.fromEntries(resources.map(key => [key, '0'])), ...Object.fromEntries(result.rows.map(row => [row.resource, row.revision])), ai: ai.rows[0].revision });
  } catch (error) { next(error); }
});
module.exports = router;
