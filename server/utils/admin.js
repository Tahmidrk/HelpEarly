const pool = require('../config/db');
const fail = (status, message) => Object.assign(new Error(message), { status });
function fields(body, allowed) {
  if (!body || !Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) throw fail(400, 'Unsupported administrative fields');
}
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(400, 'Invalid administrative text');
  return value.trim();
}
async function audit(db, req, action, target, outcome) {
  await db.query('INSERT INTO admin_audit_logs(actor_id,action,target,outcome,request_id) VALUES($1,$2,$3,$4,$5)',
    [req.user?.id || null, action, String(target).slice(0,100), outcome, req.requestId || null]);
}
async function adminAccess(req, res, next) {
  if (req.user?.role === 'admin') return next();
  try { await audit(pool, req, 'admin.access', 'admin', 'DENIED'); }
  catch { return res.status(503).json({ message: 'Administrative audit unavailable' }); }
  return res.status(403).json({ message: 'Administrator access required' });
}
function mutation(action, target, work) {
  return async (req, res, next) => {
    let db;
    try {
      db = await pool.connect(); await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      // ponytail: serialize low-volume admin writes; split per-resource locks after
      // load tests, retaining the DB's last-admin guard for all account changes.
      await db.query('SELECT pg_advisory_xact_lock(724033)');
      const actor = await db.query("SELECT id FROM users WHERE id=$1 AND role='admin' AND is_active FOR UPDATE", [req.user.id]);
      if (!actor.rows.length) throw fail(403, 'Administrator access revoked');
      const result = await work(db, req);
      await audit(db, req, action, target(req), 'SUCCESS');
      await db.query('COMMIT');
      if (result?.disconnectUser) require('../socket/chat').getIO()?.in(`user_${result.disconnectUser}`).disconnectSockets(true);
      res.status(typeof result?.status === 'number' ? result.status : 200).json(result?.data ?? result);
    } catch (error) {
      if (db) await db.query('ROLLBACK').catch(() => {});
      if (['23514','23503','23505'].includes(error.code)) error = fail(409, 'Change conflicts with account or marketplace safeguards');
      try { await audit(pool, req, action, target(req), error.status && error.status < 500 ? 'REJECTED' : 'FAILED'); }
      catch { return res.status(503).json({ message: 'Administrative audit unavailable; operation not committed' }); }
      next(error);
    } finally { db?.release(); }
  };
}
module.exports = { fail, fields, text, audit, adminAccess, mutation };
