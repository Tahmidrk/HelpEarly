const pool = require('../config/db');
const { getIO } = require('../socket/chat');

async function conversationFor(first, second) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [[Number(first),Number(second)].sort((a,b)=>a-b).join(':')]);
    let result = await db.query('SELECT * FROM conversations WHERE (user1_id=$1 AND user2_id=$2) OR (user1_id=$2 AND user2_id=$1) ORDER BY id LIMIT 1',[first,second]);
    if (!result.rows.length) result = await db.query('INSERT INTO conversations(user1_id,user2_id) VALUES($1,$2) RETURNING *',[first,second]);
    await db.query('COMMIT');
    return result.rows[0];
  } catch(error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}

// Get user's conversations
exports.getConversations = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        CASE
          WHEN c.user1_id = $1 AND u2.is_active = false THEN 'Unavailable'
          WHEN c.user1_id = $1 THEN u2.name
          WHEN u1.is_active = false THEN 'Unavailable'
          ELSE u1.name
        END as other_name,
        CASE WHEN c.user1_id = $1 THEN u2.avatar_url ELSE u1.avatar_url END as other_avatar,
        CASE WHEN c.user1_id = $1 THEN u2.id ELSE u1.id END as other_id,
        CASE WHEN c.user1_id = $1 THEN u2.role ELSE u1.role END as other_role,
        CASE WHEN c.user1_id = $1 THEN h2.id ELSE h1.id END as other_helper_profile_id,
        CASE WHEN c.user1_id = $1 THEN u2.is_active ELSE u1.is_active END as is_other_active,
        m.content as last_message,
        m.sender_id as last_sender_id,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = false) as unread_count
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN helpers h1 ON h1.user_id = u1.id
      LEFT JOIN helpers h2 ON h2.user_id = u2.id
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC,id DESC LIMIT 1
      )
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.last_message_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('GetConversations error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages in a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Verify user is part of conversation
    const conv = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, req.user.id]
    );
    if (conv.rows.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Mark messages as read
    await pool.query(
      `UPDATE messages SET is_read = true
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [conversationId, req.user.id]
    );

    const result = await pool.query(`
      SELECT * FROM (SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC,m.id DESC
      LIMIT $2 OFFSET $3) recent ORDER BY created_at ASC,id ASC
    `, [conversationId, parseInt(limit), parseInt(offset)]);

    res.json(result.rows);
  } catch (error) {
    console.error('GetMessages error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { recipient_id, content } = req.body;

    if (Number(recipient_id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot message yourself' });
    }
    if (!Number.isInteger(Number(recipient_id)) || typeof content !== 'string' || !content.trim() || content.length>10000) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const recipient = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [recipient_id]
    );
    if (recipient.rows.length === 0) {
      return res.status(403).json({ message: 'This user is unavailable' });
    }

    // Find or create conversation
    const conversationId = (await conversationFor(req.user.id,recipient_id)).id;

    // Insert message
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [conversationId, req.user.id, content.trim()]
    );

    // Get sender info
    const sender = await pool.query('SELECT name, avatar_url FROM users WHERE id = $1', [req.user.id]);

    const message = {
      ...result.rows[0],
      sender_name: sender.rows[0].name,
      sender_avatar: sender.rows[0].avatar_url,
    };
    await pool.query('UPDATE conversations SET last_message_at=CURRENT_TIMESTAMP WHERE id=$1',[conversationId]);
    getIO()?.to(`user_${recipient_id}`).to(`user_${req.user.id}`).emit('new_message',message);
    res.status(201).json({ message, conversationId });
  } catch (error) {
    console.error('SendMessage error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};

// Start or get a conversation with a specific user
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    if (Number(userId) === req.user.id) {
      return res.status(400).json({ message: 'You cannot start a conversation with yourself' });
    }

    const otherUser = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.role, u.is_active, h.id as helper_profile_id
       FROM users u
       LEFT JOIN helpers h ON h.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (otherUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    let conv = await pool.query(
      `SELECT * FROM conversations
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [req.user.id, userId]
    );

    if (conv.rows.length === 0) {
      if (!otherUser.rows[0].is_active) {
        return res.status(403).json({ message: 'This user is unavailable' });
      }

      conv = { rows: [await conversationFor(req.user.id,userId)] };
    }

    res.json({
      ...conv.rows[0],
      other_id: otherUser.rows[0].id,
      other_role: otherUser.rows[0].role,
      other_helper_profile_id: otherUser.rows[0].helper_profile_id,
      other_name: otherUser.rows[0].is_active ? otherUser.rows[0].name : 'Unavailable',
      is_other_active: otherUser.rows[0].is_active,
      other_user: {
        ...otherUser.rows[0],
        name: otherUser.rows[0].is_active ? otherUser.rows[0].name : 'Unavailable',
      },
    });
  } catch (error) {
    console.error('GetOrCreateConversation error:', error.code || error.name);
    res.status(500).json({ message: 'Server error' });
  }
};
