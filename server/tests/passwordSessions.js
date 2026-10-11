const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),jwt=require('jsonwebtoken');
const pool=require('../config/db'),base=process.env.TEST_API_URL,results={};
const {io}=require('../../mobile/node_modules/socket.io-client');
async function req(route,token,method='GET',body,status=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,route+': '+data.message);return data;}
async function connect(token,allowed=true){const socket=io(base.replace('/api',''),{auth:{token},transports:['websocket'],reconnection:false});await new Promise((resolve,reject)=>{const t=setTimeout(()=>{socket.disconnect();reject(new Error('Socket assertion timed out'));},5000);socket.once('connect',()=>{clearTimeout(t);allowed?resolve():reject(new Error('Revoked socket was accepted'));});socket.once('connect_error',()=>{clearTimeout(t);allowed?reject(new Error('Current socket rejected')):resolve();});});return socket;}
async function main(){
 assert(/^http:\/\/127\.0\.0\.1:\d+\/api$/.test(base||''));assert(/^helpearly_free_test_\d+$/.test(pool.options.database));
 const old='isolated-session-password',next='replacement-session-password';
 const user=await req('/auth/register',null,'POST',{name:'Session revocation fixture',email:'session-revocation@fixture.test',password:old,nid_number:'session-revocation',role:'household'},201);
 assert(!JSON.stringify(user.user).includes('password_hash'));
 const rawHash=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[user.user.id])).rows[0].password_hash;assert(!user.token.includes(rawHash));assert.notEqual(jwt.decode(user.token).pv,rawHash);
 const legacy=jwt.sign({id:user.user.id,role:'household'},process.env.JWT_SECRET);await req('/auth/me',legacy,'GET',undefined,401);(await connect(legacy,false)).disconnect();
 const malformed=jwt.sign({...jwt.decode(user.token),pv:'坏'.repeat(64)},process.env.JWT_SECRET);await req('/auth/me',malformed,'GET',undefined,401);
 const socket=await connect(user.token);
 try{
  await req('/auth/profile',user.token,'PUT',{name:'Profile edit preserves sessions'});await req('/auth/me',user.token);assert(socket.connected);
  const disconnected=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Password change did not disconnect socket')),5000);socket.once('disconnect',()=>{clearTimeout(t);resolve();});});
  await req('/auth/change-password',user.token,'PUT',{current_password:old,new_password:next});await disconnected;
  await req('/auth/me',user.token,'GET',undefined,401);await req('/helpers',user.token,'GET',undefined,401);await req('/admin/stats',user.token,'GET',undefined,401);(await connect(user.token,false)).disconnect();
  await req('/auth/login',null,'POST',{email:user.user.email,password:old},400);const current=await req('/auth/login',null,'POST',{email:user.user.email,password:next});assert.equal((await req('/auth/me',current.token)).id,user.user.id);(await connect(current.token)).disconnect();
  results.passwordRotation='PASS: real SQL password update revokes REST/optional auth/admin routes, active WSS and reconnect; new login restores access';results.profileUpdates='PASS: do not revoke current session';results.tokenPrivacy='PASS: opaque version, no password hash in response';results.legacyMalformed='PASS: tokens without version and non-hex version rejected';
  const admin=await req('/auth/login',null,'POST',{email:'admin@fixture.test',password:'fixture-password'});await req('/auth/change-password',admin.token,'PUT',{current_password:'fixture-password',new_password:'short-pass'},400);await req('/admin/stats',admin.token);results.administratorPassword='PASS: fewer than 12 characters rejected without changing account';
 }finally{socket.disconnect();}
 await fs.writeFile(path.join(__dirname,'../../docs/test-results/password-sessions.json'),JSON.stringify({executed_at:new Date().toISOString(),status:'PASS',scope:'Actual isolated PostgreSQL/Express/Socket.IO; no production writes',results,production:'NOT RUN by this isolated suite; see separate password-sessions-live.json'},null,2)+'\n');console.log('PASS Password-session revocation and admin password safeguards');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
