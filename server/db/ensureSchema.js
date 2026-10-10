const pool = require('../config/db');

async function ensureSchema() {
  const db = await pool.connect();
  try {
    const fs = require('fs');
    const path = require('path');
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(724031)');
    await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    await db.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        complainant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        accused_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_complaints_complainant_id ON complaints(complainant_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_accused_id ON complaints(accused_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

      CREATE TABLE IF NOT EXISTS emergency_requests (
        id SERIAL PRIMARY KEY,
        household_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
        helper_id INTEGER REFERENCES helpers(id) ON DELETE SET NULL,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_household ON emergency_requests(household_id);
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON emergency_requests(status);

      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS photos TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS photos TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_description TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS job_application_id INTEGER REFERENCES job_applications(id) ON DELETE SET NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS bookings_job_application_once ON bookings(job_application_id) WHERE job_application_id IS NOT NULL;
      ALTER TABLE helpers ALTER COLUMN avg_rating DROP DEFAULT;
      CREATE TABLE IF NOT EXISTS ai_messages (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('user','model')), content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_once ON reviews(booking_id) WHERE booking_id IS NOT NULL;
      CREATE OR REPLACE FUNCTION refresh_worker_rating() RETURNS TRIGGER AS $$
      BEGIN
        UPDATE helpers SET avg_rating=(SELECT AVG(rating) FROM reviews WHERE helper_id=COALESCE(NEW.helper_id,OLD.helper_id)), total_reviews=(SELECT COUNT(*) FROM reviews WHERE helper_id=COALESCE(NEW.helper_id,OLD.helper_id)) WHERE id=COALESCE(NEW.helper_id,OLD.helper_id);
        RETURN NULL;
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS worker_rating ON reviews;
      CREATE TRIGGER worker_rating AFTER INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION refresh_worker_rating();
      UPDATE helpers h SET avg_rating=(SELECT AVG(rating) FROM reviews WHERE helper_id=h.id), total_reviews=(SELECT COUNT(*) FROM reviews WHERE helper_id=h.id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nid_number VARCHAR(50);

      -- Update users_role_check constraint to include 'both'
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('household', 'helper', 'admin', 'both'));
    `);
    await db.query(`INSERT INTO categories (name) SELECT name FROM unnest(ARRAY['Cleaning','Plumbing','Electrical','Gardening','Babysitting','Moving','Cooking']) AS name WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.name=name.name)`);
    for (const file of ['production.sql','free-stack.sql','api-security.sql']) {
      await db.query(fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8'));
    }
    await db.query('COMMIT');
    console.log('HelpEarly schema version 2 ready');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally { db.release(); }
}

module.exports = ensureSchema;
