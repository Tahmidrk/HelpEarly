const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../config/db');
const validKey = key => /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i.test(key);
// Stable keys keep the business layer independent of the storage provider.
function createStorage(config = process.env, request = fetch) {
  const provider = config.STORAGE_PROVIDER || 'local';
  if (provider === 'local') {
    const directory = config.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
    return {
      provider, directory,
      async check() {},
      async put(key, bytes) { if (!validKey(key)) throw new Error('Invalid media key'); await fs.mkdir(directory, { recursive: true }); await fs.writeFile(path.join(directory, key), bytes, { flag: 'wx' }); },
      async remove(key) { if (!validKey(key)) throw new Error('Invalid media key'); await fs.rm(path.join(directory, key), { force: true }); },
      async url(key) { if (!validKey(key)) throw new Error('Invalid media key'); return `/uploads/${key}`; },
      async list() { try { return (await fs.readdir(directory)).filter(validKey); } catch (error) { if(error.code==='ENOENT') return []; throw error; } },
      async read(key) { if (!validKey(key)) throw new Error('Invalid media key'); return fs.readFile(path.join(directory,key)); },
    };
  }
  if (provider !== 'supabase') throw new Error('Unknown STORAGE_PROVIDER');
  const origin = (config.SUPABASE_URL || '').replace(/\/$/, '');
  if (!/^https:\/\//.test(origin) || !config.SUPABASE_SERVICE_ROLE_KEY || !config.SUPABASE_STORAGE_BUCKET) throw new Error('Supabase storage configuration is incomplete');
  const bucket = encodeURIComponent(config.SUPABASE_STORAGE_BUCKET);
  async function api(endpoint, options, binary=false) {
    const response = await request(`${origin}/storage/v1/${endpoint}`, {
      ...options, signal: AbortSignal.timeout(15000),
      headers: { apikey: config.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`, ...options.headers },
    });
    if (!response.ok) throw Object.assign(new Error('Persistent media storage unavailable'), { status: 503, code: `STORAGE_${response.status}` });
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  }
  return {
    provider,
    async check() { const info=await api(`bucket/${bucket}`,{method:'GET'}); if(info.public!==false) throw new Error('HelpEarly requires a private media bucket'); },
    async put(key, bytes, type) {
      if (!validKey(key)) throw new Error('Invalid media key');
      await api(`object/${bucket}/${key}`, { method: 'POST', headers: { 'Content-Type': type, 'x-upsert': 'false' }, body: bytes });
    },
    async remove(key) {
      if (!validKey(key)) throw new Error('Invalid media key');
      await api(`object/${bucket}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }) });
    },
    async url(key) {
      if (!validKey(key)) throw new Error('Invalid media key');
      const result = await api(`object/sign/${bucket}/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
      if (!result.signedURL?.startsWith('/object/sign/')) throw new Error('Storage returned an invalid media URL');
      return `${origin}/storage/v1${result.signedURL}`;
    },
    async list() {
      const keys=[];
      for(let offset=0;;offset+=100) {
        const page=await api(`object/list/${bucket}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:100,offset,sortBy:{column:'name',order:'asc'}})});
        for(const item of page) { if(!validKey(item.name)) throw new Error('Unexpected object in managed media bucket; backup needs review'); keys.push(item.name); }
        if(page.length<100) return keys;
      }
    },
    async read(key) { if(!validKey(key)) throw new Error('Invalid media key'); return api(`object/${bucket}/${key}`,{method:'GET'},true); },
  };
}
let storage;
const getStorage = () => storage || (storage = createStorage());
// Sign only media fields in already-authorized API responses. No public remote redirect.
async function decorateMedia(value, adapter = getStorage(), urls = new Map()) {
  if (adapter.provider === 'local' || !value || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  const sign = async link => {
    if (typeof link !== 'string' || !link.startsWith('/uploads/')) return link;
    const key = link.slice(9);
    if (!validKey(key)) return link;
    if (!urls.has(key)) urls.set(key, adapter.url(key));
    return urls.get(key);
  };
  if (Array.isArray(value)) return Promise.all(value.map(item => decorateMedia(item, adapter, urls)));
  const result = { ...value };
  for (const [field, item] of Object.entries(value)) {
    if (/avatar/.test(field)) result[field] = await sign(item);
    else if (field === 'photos' && item) {
      const images = typeof item === 'string' ? JSON.parse(item) : item;
      const signed = await Promise.all(images.map(sign));
      result[field] = typeof item === 'string' ? JSON.stringify(signed) : signed;
    } else if (item && typeof item === 'object') result[field] = await decorateMedia(item, adapter, urls);
  }
  return result;
}
async function cleanupOrphans() {
  const db = await pool.connect(); let locked = false;
  try {
    locked = (await db.query('SELECT pg_try_advisory_lock(724034) AS locked')).rows[0].locked;
    if (!locked) return;
    // Journal survives crashes. Never delete referenced media or pre-existing files.
    const rows = await db.query(`SELECT key FROM media_uploads m WHERE created_at<CURRENT_TIMESTAMP-INTERVAL '1 day'
      AND NOT EXISTS(SELECT 1 FROM users WHERE avatar_url='/uploads/'||m.key)
      AND NOT EXISTS(SELECT 1 FROM bookings WHERE photos LIKE '%/uploads/'||m.key||'%')
      AND NOT EXISTS(SELECT 1 FROM jobs WHERE photos LIKE '%/uploads/'||m.key||'%') ORDER BY created_at LIMIT 20`);
    for (const { key } of rows.rows) { await getStorage().remove(key); await db.query('DELETE FROM media_uploads WHERE key=$1', [key]); }
  } finally { if (locked) await db.query('SELECT pg_advisory_unlock(724034)'); db.release(); }
}
module.exports = { createStorage, getStorage, decorateMedia, cleanupOrphans, validKey };
