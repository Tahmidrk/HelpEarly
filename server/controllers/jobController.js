const pool = require('../config/db');
const { assertBookingSlot } = require('../utils/bookingAvailability');

async function getHelperProfile(userId) {
  const helperResult = await pool.query('SELECT id FROM helpers WHERE user_id = $1', [userId]);
  return helperResult.rows[0] || null;
}

async function getHelperCategoryIds(helperId) {
  const categoriesResult = await pool.query(
    'SELECT category_id FROM helper_categories WHERE helper_id = $1 UNION SELECT category_id FROM helper_services WHERE helper_id = $1',
    [helperId]
  );

  return categoriesResult.rows.map((row) => row.category_id);
}

// Create a job posting (household only)
exports.createJob = async (req, res) => {
  try {
    let { category_id, category, title, description, budget, location, latitude, longitude, preferred_date } = req.body;

    // Resolve numeric category_id if text category name is sent
    if (!category_id && (category || req.body.category_name)) {
      const catName = category || req.body.category_name;
      const catRes = await pool.query('SELECT id FROM categories WHERE name ILIKE $1 LIMIT 1', [catName]);
      if (catRes.rows.length > 0) {
        category_id = catRes.rows[0].id;
      }
    }

    const preferredDate = new Date(preferred_date);
    if (!category_id || !title?.trim() || !description?.trim() || !Number.isFinite(Number(budget)) || Number(budget) <= 0 || Number.isNaN(preferredDate.getTime())) {
      return res.status(400).json({ message: 'Category, title, description, a positive budget, and preferred date are required' });
    }

    // Collect uploaded photo paths (relative URLs the client can fetch)
    const photoPaths = (req.files || []).map(f => `/uploads/${f.filename}`);
    const photosJson = photoPaths.length > 0 ? JSON.stringify(photoPaths) : null;

    const result = await pool.query(
      `INSERT INTO jobs (user_id, category_id, title, description, budget, location, latitude, longitude, preferred_date, photos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.id, category_id, title, description, budget, location, latitude, longitude, preferredDate, photosJson]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateJob error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Get all jobs with filters
exports.getJobs = async (req, res) => {
  try {
    const { category, location, status = 'open', page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = ['j.status = $1'];
    const params = [status];

    if ((req.activeRole === 'helper' || req.user?.role === 'helper') && !conditions.some(c => c.includes('user_id'))) {
      params.push(req.user.id);
      conditions.push(`j.user_id <> $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`j.category_id = $${params.length}`);
    }

    if (location) {
      params.push(`%${location}%`);
      conditions.push(`j.location ILIKE $${params.length}`);
    }

    let query = `
      SELECT j.*, u.id as poster_id, u.name as poster_name, u.avatar_url as poster_avatar, c.name as category_name, c.icon as category_icon,
             (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count
      FROM jobs j
      JOIN users u ON j.user_id = u.id
      LEFT JOIN categories c ON j.category_id = c.id
      WHERE u.is_active = true AND ${conditions.join(' AND ')}
    `;

    query += ` ORDER BY j.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('GetJobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get jobs matching helper's categories
exports.getJobsForHelper = async (req, res) => {
  try {
    const { category, status = 'open' } = req.query;
    const helper = await getHelperProfile(req.user.id);
    if (!helper) {
      return res.status(400).json({ message: 'Helper profile not found' });
    }

    const helperCategoryIds = await getHelperCategoryIds(helper.id);
    if (helperCategoryIds.length === 0) {
      return res.json([]);
    }

    const params = [status];
    const conditions = ['j.status = $1'];
    const helperPlaceholders = helperCategoryIds.map((_, index) => `$${params.length + index + 1}`).join(', ');
    conditions.push(`j.category_id IN (${helperPlaceholders})`);
    params.push(...helperCategoryIds);

    if ((req.activeRole === 'helper' || req.user?.role === 'helper') && !conditions.some(c => c.includes('user_id'))) {
      params.push(req.user.id);
      conditions.push(`j.user_id <> $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`j.category_id = $${params.length}`);
    }

    const result = await pool.query(`
      SELECT j.*, u.id as poster_id, u.name as poster_name, c.name as category_name, c.icon as category_icon,
             (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count
      FROM jobs j
      JOIN users u ON j.user_id = u.id
      LEFT JOIN categories c ON j.category_id = c.id
      WHERE u.is_active = true AND ${conditions.join(' AND ')}
      ORDER BY j.created_at DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('GetJobsForHelper error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single job
exports.getJob = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT j.*, u.id as poster_id, u.name as poster_name, u.avatar_url as poster_avatar,
             c.name as category_name, c.icon as category_icon
      FROM jobs j
      JOIN users u ON j.user_id = u.id
      LEFT JOIN categories c ON j.category_id = c.id
      WHERE j.id = $1 AND u.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = result.rows[0];

    if (req.activeRole === 'household' && job.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only view your own job offers' });
    }

    let viewerApplication = null;

    if (req.activeRole === 'helper') {
      const helper = await getHelperProfile(req.user.id);
      if (!helper) {
        return res.status(400).json({ message: 'Helper profile not found' });
      }

      const helperCategoryIds = await getHelperCategoryIds(helper.id);
      if (!helperCategoryIds.includes(job.category_id)) {
        return res.status(403).json({ message: 'This job does not match your categories' });
      }

      const applicationResult = await pool.query(`
        SELECT ja.*
        FROM job_applications ja
        WHERE ja.job_id = $1 AND ja.helper_id = $2
        LIMIT 1
      `, [id, helper.id]);

      viewerApplication = applicationResult.rows[0] || null;
    }

    let applications = [];
    if (req.user?.id === job.user_id) {
      const apps = await pool.query(`
        SELECT ja.*, u.id as helper_user_id, u.name as helper_name, u.avatar_url as helper_avatar, h.avg_rating, h.total_reviews
        FROM job_applications ja
        JOIN helpers h ON ja.helper_id = h.id
        JOIN users u ON h.user_id = u.id
        WHERE ja.job_id = $1 AND u.is_active = true
        ORDER BY ja.created_at DESC
      `, [id]);
      applications = apps.rows;
    }

    res.json({ ...job, applications, viewer_application: viewerApplication });
  } catch (error) {
    console.error('GetJob error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's posted jobs
exports.getMyJobs = async (req, res) => {
  try {
    const { category, status } = req.query;
    const params = [req.user.id];
    const conditions = ['j.user_id = $1'];

    if ((req.activeRole === 'helper' || req.user?.role === 'helper') && !conditions.some(c => c.includes('user_id'))) {
      params.push(req.user.id);
      conditions.push(`j.user_id <> $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`j.category_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`j.status = $${params.length}`);
    }

    const result = await pool.query(`
      SELECT j.*, u.id as poster_id, u.name as poster_name, c.name as category_name, c.icon as category_icon,
             (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count
      FROM jobs j
      JOIN users u ON j.user_id = u.id
      LEFT JOIN categories c ON j.category_id = c.id
      WHERE u.is_active = true AND ${conditions.join(' AND ')}
      ORDER BY j.created_at DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('GetMyJobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Apply for a job (helper)
exports.applyForJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { cover_message, proposed_price } = req.body;
    if (proposed_price !== undefined && (!Number.isFinite(Number(proposed_price)) || Number(proposed_price)<=0)) return res.status(400).json({message:'Offer a positive proposal price'});

    const helper = await getHelperProfile(req.user.id);
    if (!helper) {
      return res.status(400).json({ message: 'Helper profile not found' });
    }

    const jobResult = await pool.query(
      `SELECT j.id, j.user_id, j.category_id, j.status
       FROM jobs j
       JOIN users u ON j.user_id = u.id
       WHERE j.id = $1 AND u.is_active = true`,
      [id]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = jobResult.rows[0];
    if (job.user_id === req.user.id) return res.status(400).json({ message: 'You cannot apply to your own job' });
    if (job.status !== 'open') {
      return res.status(400).json({ message: 'This job is no longer open for applications' });
    }

    const helperCategoryIds = await getHelperCategoryIds(helper.id);
    if (!helperCategoryIds.includes(job.category_id)) {
      return res.status(403).json({ message: 'You can only apply to jobs in your service categories' });
    }

    const result = await pool.query(
      `INSERT INTO job_applications (job_id, helper_id, cover_message, proposed_price)
       SELECT $1, $2, $3, $4 FROM (SELECT id FROM jobs WHERE id=$1 AND status='open' FOR UPDATE) locked_job RETURNING *`,
      [id, helper.id, cover_message, proposed_price]
    );

    if (!result.rows.length) return res.status(409).json({message:'This job is no longer open'});
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'You already applied for this job' });
    }
    console.error('ApplyForJob error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update job application status (household accepts/rejects)
exports.updateApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Application status must be accepted or rejected' });
    }

    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // Lock the shared job before individual proposals to avoid cross-proposal deadlocks.
      await db.query('SELECT id FROM jobs WHERE id=(SELECT job_id FROM job_applications WHERE id=$1) FOR UPDATE',[applicationId]);
      const applicationResult = await db.query(`
      SELECT ja.*, j.user_id, j.title, j.description, j.budget, j.location, j.preferred_date, j.status AS job_status
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE ja.id = $1
      FOR UPDATE OF ja, j
    `, [applicationId]);

    if (applicationResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ message: 'Application not found' });
    }

    const application = applicationResult.rows[0];
    if (application.user_id !== req.user.id) {
      await db.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only manage applications for your own jobs' });
    }
    if (application.status !== 'pending') {
      await db.query('ROLLBACK');
      return res.status(409).json({ message: 'This application has already been decided' });
    }
    if (status === 'rejected') {
      const result = await db.query('UPDATE job_applications SET status = $1 WHERE id = $2 RETURNING *', [status, applicationId]);
      await db.query('COMMIT');
      return res.json(result.rows[0]);
    }
    if (application.job_status !== 'open') {
      await db.query('ROLLBACK');
      return res.status(409).json({ message: 'This job is no longer open for applications' });
    }

    const { startsAt, endsAt } = await assertBookingSlot(db, application.helper_id, application.preferred_date || new Date(), null);
    const booking = await db.query(
      `INSERT INTO bookings (user_id, helper_id, booking_date, end_date, status, notes, total_price, address, service_description, job_application_id)
       VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, application.helper_id, startsAt, endsAt, application.cover_message || '', application.proposed_price || application.budget, application.location || '', `${application.title}: ${application.description}`, application.id]
    );
    const result = await db.query('UPDATE job_applications SET status = $1 WHERE id = $2 RETURNING *', ['accepted', applicationId]);
    await db.query(`UPDATE job_applications SET status = 'rejected' WHERE job_id = $1 AND id <> $2 AND status = 'pending'`, [application.job_id, applicationId]);
    await db.query(`UPDATE jobs SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [application.job_id]);
    await db.query('COMMIT');
    res.json({ ...result.rows[0], booking: booking.rows[0] });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    console.error('UpdateApplication error:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Application could not be updated' });
  }
};

// Get helper's job applications
exports.getMyApplications = async (req, res) => {
  try {
    const helper = await getHelperProfile(req.user.id);
    if (!helper) {
      return res.status(400).json({ message: 'Helper profile not found' });
    }

    const result = await pool.query(`
      SELECT ja.*, j.title, j.description, j.budget, j.location, j.preferred_date, j.status as job_status,
             c.name as category_name, c.icon as category_icon, u.id as poster_id, u.name as poster_name
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      JOIN users u ON j.user_id = u.id
      LEFT JOIN categories c ON j.category_id = c.id
      WHERE ja.helper_id = $1 AND u.is_active = true
      ORDER BY ja.created_at DESC
    `, [helper.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('GetMyApplications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
