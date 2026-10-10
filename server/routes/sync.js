const router = require('express').Router();
const { auth } = require('../middleware/auth');
const pool = require('../config/db');
router.get('/', auth, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT resource, string_agg(user_id::text||':'||version::text, ',' ORDER BY user_id) AS revision
      FROM sync_revisions WHERE user_id IN (0,$1) AND (resource<>'admin' OR $2='admin') GROUP BY resource ORDER BY resource`, [req.user.id, req.user.role]);
    res.set('Cache-Control', 'no-store').json(Object.fromEntries(result.rows.map(row => [row.resource, row.revision])));
  } catch (error) { next(error); }
});
module.exports = router;
