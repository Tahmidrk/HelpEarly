const pool = require('../config/db');

exports.getComplaintContacts = async (req, res) => {
  try {
    const result=await pool.query(`SELECT DISTINCT u.id,u.name,u.role FROM users u JOIN (
      SELECT CASE WHEN $2='household' THEN h.user_id ELSE b.user_id END AS id FROM bookings b JOIN helpers h ON h.id=b.helper_id
      WHERE ($2='household' AND b.user_id=$1) OR ($2='helper' AND h.user_id=$1)
      UNION SELECT CASE WHEN $2='household' THEN h.user_id ELSE j.user_id END FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN helpers h ON h.id=a.helper_id
      WHERE a.status='accepted' AND (($2='household' AND j.user_id=$1) OR ($2='helper' AND h.user_id=$1))
    ) contacts ON contacts.id=u.id WHERE u.id<>$1 AND u.is_active ORDER BY u.name`,[req.user.id,req.activeRole]);

    res.json(result.rows);
  } catch (error) {
    console.error('GetComplaintContacts error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createComplaint = async (req, res) => {
  try {
    const { accused_id, subject, description } = req.body;

    if (!Number.isInteger(Number(accused_id)) || typeof subject!=='string' || typeof description!=='string' || !subject.trim() || subject.length>200 || !description.trim() || description.length>5000) {
      return res.status(400).json({ message: 'Accused user, subject, and details are required' });
    }

    if (Number(accused_id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot complain about yourself' });
    }

    const accused = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [accused_id]
    );
    if (accused.rows.length === 0) {
      return res.status(404).json({ message: 'User is unavailable' });
    }

    const relationship = await pool.query(`
      SELECT 1
      FROM bookings b
      JOIN helpers h ON h.id = b.helper_id
      WHERE ($3='household' AND b.user_id = $1 AND h.user_id = $2)
         OR ($3='helper' AND b.user_id = $2 AND h.user_id = $1)
      UNION ALL
      SELECT 1
      FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      JOIN helpers h ON h.id = ja.helper_id
      WHERE ja.status = 'accepted'
        AND (($3='household' AND j.user_id = $1 AND h.user_id = $2) OR ($3='helper' AND j.user_id = $2 AND h.user_id = $1))
      LIMIT 1
    `, [req.user.id, accused_id,req.activeRole]);
    if (relationship.rows.length === 0) {
      return res.status(403).json({ message: 'Complaints can only be filed about someone you booked or worked with' });
    }

    if(req.body.booking_id && !(await pool.query(`SELECT 1 FROM bookings b JOIN helpers h ON h.id=b.helper_id WHERE b.id=$1 AND (($4='household' AND b.user_id=$2 AND h.user_id=$3) OR ($4='helper' AND b.user_id=$3 AND h.user_id=$2))`,[req.body.booking_id,req.user.id,accused_id,req.activeRole])).rows.length)return res.status(403).json({message:'Related booking is unavailable'});
    const result = await pool.query(
      `INSERT INTO complaints (complainant_id, accused_id, subject, description,audience,booking_id)
       VALUES ($1, $2, $3, $4,$5,$6) RETURNING *`,
      [req.user.id, accused_id, subject.trim(), description.trim(),req.activeRole,req.body.booking_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateComplaint error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyComplaints = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, au.name as accused_name, au.role as accused_role,
             ah.id as accused_helper_profile_id
      FROM complaints c
      JOIN users au ON c.accused_id = au.id
      LEFT JOIN helpers ah ON ah.user_id = au.id
      WHERE c.complainant_id = $1 AND c.audience=$2
      ORDER BY c.created_at DESC
    `, [req.user.id,req.activeRole]);

    res.json(result.rows);
  } catch (error) {
    console.error('GetMyComplaints error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllComplaints = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';

    if (status) {
      params.push(status);
      where = `WHERE c.status = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT c.*, cu.name as complainant_name, cu.role as complainant_role,
             ch.id as complainant_helper_profile_id,
             au.name as accused_name, au.role as accused_role,
             ah.id as accused_helper_profile_id
      FROM complaints c
      JOIN users cu ON c.complainant_id = cu.id
      JOIN users au ON c.accused_id = au.id
      LEFT JOIN helpers ch ON ch.user_id = cu.id
      LEFT JOIN helpers ah ON ah.user_id = au.id
      ${where}
      ORDER BY c.created_at DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('GetAllComplaints error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (status !== undefined && !['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid complaint status' });
    }

    const result = await pool.query(
      `UPDATE complaints
       SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, admin_notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateComplaint error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};
