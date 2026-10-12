const pool = require('../config/db');

async function attachHelper(user, db = pool) {
  if (!['helper', 'both'].includes(user.role)) return user;
  const { rows } = await db.query(`SELECT h.*,
    COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM categories c
      JOIN helper_categories hc ON hc.category_id=c.id WHERE hc.helper_id=h.id),'[]'::jsonb) AS categories,
    COALESCE((SELECT jsonb_agg(to_jsonb(hs) || jsonb_build_object('price',hs.price::text,'category_name',c.name) ORDER BY hs.id)
      FROM helper_services hs JOIN categories c ON c.id=hs.category_id WHERE hs.helper_id=h.id),'[]'::jsonb) AS services
    FROM helpers h WHERE h.user_id=$1`, [user.id]);
  if (!rows[0]) return user;
  const helper = rows[0];
  helper.primary_category = helper.categories[0]?.name || null;
  return { ...user, helperProfile: helper, category: helper.primary_category, primary_category: helper.primary_category };
}

module.exports = { attachHelper };
