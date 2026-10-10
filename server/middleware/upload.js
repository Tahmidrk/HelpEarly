const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
require('fs').mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const extension = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}[file.mimetype];
    const uniqueName = `${randomUUID()}${extension}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Only JPEG, PNG, WebP or GIF photos are allowed'),{status:400}), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

function validated(middleware) {
  return (req,res,next)=>middleware(req,res,async error=>{
    const files=req.file ? [req.file] : (req.files || []);
    const cleanup=()=>Promise.allSettled(files.map(file=>fs.unlink(file.path)));
    if(error) { await cleanup(); error.status=400; return next(error); }
    try {
      for(const file of files) {
        const handle=await fs.open(file.path,'r');
        const bytes=Buffer.alloc(16);
        try { await handle.read(bytes,0,16,0); } finally { await handle.close(); }
        const valid={
          'image/png':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
          'image/jpeg':bytes[0]===255 && bytes[1]===216 && bytes[2]===255,
          'image/gif':['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)),
          'image/webp':bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP',
        }[file.mimetype];
        if(!valid) throw Object.assign(new Error('Photo content does not match its image type'),{status:400});
      }
      res.on('finish',()=>{ if(res.statusCode>=400 || res.locals.discardUploads) cleanup(); });
      require('./validateRequest')(req,res,next);
    } catch(err) { await cleanup(); next(err); }
  });
}
module.exports = {array:(...args)=>validated(upload.array(...args)),single:(...args)=>validated(upload.single(...args))};
