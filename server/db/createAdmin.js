const pool=require('../config/db'),bcrypt=require('bcryptjs');
async function main(){
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length<12 || Buffer.byteLength(password)>72) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters, at most 72 bytes) privately');
  await require('./ensureSchema')();
  const hash=await bcrypt.hash(password,12);
  await pool.query("INSERT INTO users(name,email,password_hash,role,is_active) VALUES('HelpEarly Admin',$1,$2,'admin',true)",[email,hash]);
  console.log('Admin account created. Existing accounts were not changed.');
}
main().catch(error=>{console.error(error.code==='23505'?'Account already exists; no change made':error.message);process.exitCode=1;}).finally(()=>pool.end());
