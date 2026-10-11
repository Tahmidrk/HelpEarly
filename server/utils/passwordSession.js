const { createHmac, timingSafeEqual } = require('node:crypto');

// Opaque version, not the password hash: credential changes revoke issued JWTs.
const passwordVersion = hash => createHmac('sha256', process.env.JWT_SECRET).update(hash).digest('hex');
function currentPasswordSession(decoded, hash) {
  const expected = passwordVersion(hash);
  return typeof decoded.pv === 'string' && /^[a-f0-9]{64}$/.test(decoded.pv) && timingSafeEqual(Buffer.from(decoded.pv), Buffer.from(expected));
}
module.exports = { passwordVersion, currentPasswordSession };
