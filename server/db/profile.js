const pool = require('../config/db');

async function attachHelper(user, db = pool) {
  if (!['helper', 'both'].includes(user.role)) return user;
  const { rows } = await db.query('SELECT * FROM helpers WHERE user_id = $1', [user.id]);
  if (!rows[0]) return user;
  const helper = rows[0];
  const categories = await db.query(`SELECT c.* FROM categories c JOIN helper_categories hc ON hc.category_id = c.id WHERE hc.helper_id = $1 ORDER BY c.id`, [helper.id]);
  const services = await db.query(`SELECT hs.*, c.name AS category_name FROM helper_services hs JOIN categories c ON c.id = hs.category_id WHERE hs.helper_id = $1 ORDER BY hs.id`, [helper.id]);
  helper.categories = categories.rows;
  helper.services = services.rows;
  helper.primary_category = categories.rows[0]?.name || null;
  return { ...user, helperProfile: helper, category: helper.primary_category, primary_category: helper.primary_category };
}

module.exports = { attachHelper };
