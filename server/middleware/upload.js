const multer = require('multer');
const { randomUUID } = require('node:crypto');
const pool = require('../config/db');
const { getStorage } = require('../utils/storage');
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => cb(extensions[file.mimetype] ? null : Object.assign(new Error('Only JPEG, PNG, WebP or GIF photos are allowed'), { status: 400 }), Boolean(extensions[file.mimetype])),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 30 },
});
function validated(middleware) {
  return (req, res, next) => middleware(req, res, async error => {
    const files = req.file ? [req.file] : (req.files || []), saved = [];
    const cleanup = async () => {
      for (const file of saved) {
        try {
          const linked = await pool.query(`SELECT EXISTS(SELECT 1 FROM users WHERE avatar_url=$1) OR EXISTS(SELECT 1 FROM bookings WHERE photos LIKE '%'||$1||'%') OR EXISTS(SELECT 1 FROM jobs WHERE photos LIKE '%'||$1||'%') AS present`, [`/uploads/${file.filename}`]);
          if (!linked.rows[0].present) { await getStorage().remove(file.filename); await pool.query('DELETE FROM media_uploads WHERE key=$1', [file.filename]); }
        }
        catch (err) { console.error('Media cleanup deferred:', err.code || err.name); }
      }
    };
    if (error) { error.status = 400; return next(error); }
    try {
      for (const file of files) {
        const bytes = file.buffer;
        const valid = {
          'image/png': bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
          'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
          'image/gif': ['GIF87a','GIF89a'].includes(bytes.toString('ascii', 0, 6)),
          'image/webp': bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
        }[file.mimetype];
        if (!valid) throw Object.assign(new Error('Photo content does not match its image type'), { status: 400 });
      }
      for (const file of files) {
        file.filename = randomUUID() + extensions[file.mimetype];
        await pool.query('INSERT INTO media_uploads(key,owner_id) VALUES($1,$2)', [file.filename, req.user.id]);
        saved.push(file);
        await getStorage().put(file.filename, file.buffer, file.mimetype);
        delete file.buffer;
      }
      res.on('finish', () => { if (res.statusCode >= 400 || res.locals.discardUploads) cleanup(); });
      require('./validateRequest')(req, res, next);
    } catch (err) { await cleanup(); next(err); }
  });
}
module.exports = { array: (...args) => validated(upload.array(...args)), single: (...args) => validated(upload.single(...args)) };
