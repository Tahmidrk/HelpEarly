const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const pool=require('../config/db'),base=process.env.TEST_API_URL,results={};
const pass=name=>{results[name]='PASS';console.log('PASS '+name);};
async function req(route,token,method='GET',body,status=200){
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,status,`${method} ${route}: ${data.message||''}`);return data;
}
async function clients(){
  const esbuild=require('../../client/node_modules/esbuild'),root=path.resolve(__dirname,'../..');
  const compile=async(file,options)=>{const out=await esbuild.build({entryPoints:[path.join(root,file)],bundle:true,write:false,platform:'node',format:'esm',...options});return import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));};
  const web=await compile('client/src/utils/api.js',{define:{'import.meta.env':JSON.stringify({VITE_API_URL:base})}});
  const mobile=await compile('mobile/src/api/client.js',{define:{'process.env.EXPO_PUBLIC_API_URL':JSON.stringify(base)},plugins:[{name:'native-protocol',setup(b){b.onResolve({filter:/^(react-native|@react-native-async-storage\/async-storage|expo-constants|expo-file-system)$/},a=>({path:a.path,namespace:'native-protocol'}));b.onLoad({filter:/.*/,namespace:'native-protocol'},a=>({loader:'js',contents:a.path==='react-native'?"export const Platform={OS:'android'};":a.path.includes('async-storage')?"export default {getItem:async k=>globalThis.__adminMobile[k]||null};":a.path==='expo-file-system'?'export class File {}':'export default {};'}));}}]});
  return {web,mobile};
}
async function main(){
  assert(/^http:\/\/127\.0\.0\.1:\d+\/api$/.test(base||''));assert(/^helpearly_free_test_\d+$/.test(pool.options.database),'Admin tests refuse non-suite database');
  const login=email=>req('/auth/login',null,'POST',{email,password:'fixture-password'});
  const admin=await login('admin@fixture.test'),home=await login('home@fixture.test'),worker=await login('worker@fixture.test'),helper=worker.user.helperProfile.id;
  const second=(await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES('Second admin','admin2@fixture.test',$1,'admin') RETURNING id",[await bcrypt.hash('fixture-password',10)])).rows[0];
  const admin2=await login('admin2@fixture.test');
  await req('/admin/stats',null,'GET',undefined,401);
  const resources=['workers','categories','services','bookings','jobs','proposals','emergencies','reviews','complaints','audit'];
  for(const role of [home,worker])for(const resource of resources)await req('/admin/monitor/'+resource,role.token,'GET',undefined,403);
  for(const route of ['/admin/users/'+home.user.id,'/admin/helpers/'+helper,'/admin/categories/1','/admin/services/1','/admin/jobs/1','/admin/reviews/1','/admin/complaints/1'])await req(route,home.token,'PUT',{is_hidden:true},403);
  const forged=jwt.sign({id:home.user.id,role:'admin'},process.env.JWT_SECRET);await req('/admin/stats',forged,'GET',undefined,403);
  await req('/auth/register',null,'POST',{name:'Escalate',email:'escalate@fixture.test',password:'fixture-password',nid_number:'test',role:'admin'},400);
  await req('/auth/profile',home.token,'PUT',{role:'admin',name:'Fixture Home'});assert.equal((await pool.query('SELECT role FROM users WHERE id=$1',[home.user.id])).rows[0].role,'household');
  pass('Every admin resource/mutation rejects non-admins; DB role overrides forged JWT; registration/profile cannot promote');
  const filtered=await req('/admin/users?role=helper&search=Fixture&limit=1',admin.token);assert.equal(filtered.total,1);assert.equal(filtered.users[0].id,worker.user.id);
  assert(!Object.keys(filtered.users[0]).some(k=>/password|nid|phone|location/.test(k)));
  await req('/admin/users?role=invalid',admin.token,'GET',undefined,400);await req('/admin/users?page=-1',admin.token,'GET',undefined,400);
  await req(`/admin/users/${admin.user.id}`,admin.token,'PUT',{is_active:false},409);await req(`/admin/users/${admin.user.id}`,admin.token,'PUT',{role:'household'},409);
  await req(`/admin/users/${home.user.id}`,admin.token,'DELETE',undefined,409);await req(`/admin/jobs/1`,admin.token,'DELETE',undefined,409);await req(`/admin/reviews/1`,admin.token,'DELETE',undefined,409);
  await req(`/admin/users/${home.user.id}`,admin.token,'PUT',{password_hash:'illegal'},400);
  pass('Filtered counts, private-field exclusion, validation, self-lockout and destructive endpoint rejection');
  const {web,mobile}=await clients();global.localStorage={getItem:k=>k==='token'?home.token:k==='activeRole'?'household':null};global.__adminMobile={token:home.token,activeRole:'household'};
  const io=require('../../mobile/node_modules/socket.io-client').io;
  const socket=io(base.replace('/api',''),{auth:{token:worker.token},transports:['websocket'],reconnection:false});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  try{
    const before=await req('/sync',worker.token);
    const hinted=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Admin sync hint missing')),5000);socket.once('sync_hint',()=>{clearTimeout(t);resolve();});});
    await req(`/admin/helpers/${helper}/verify`,admin.token,'PUT',{is_verified:true});await hinted;
    assert((await web.helpersAPI.getOne(helper)).is_verified);assert((await mobile.helpersAPI.getById(helper)).is_verified);
    assert.notEqual((await req('/sync',worker.token)).helpers,before.helpers);assert((await req('/notifications',worker.token)).some(n=>n.type==='verification_updated'));
    await req(`/admin/helpers/${helper}`,admin.token,'PUT',{bio:'Moderated profile',is_available:false});assert.equal((await mobile.helpersAPI.getById(helper)).bio,'Moderated profile');
    await req(`/admin/helpers/${helper}`,admin.token,'PUT',{is_available:true,bio:worker.user.helperProfile.bio||''});
    await req(`/admin/helpers/${helper}/verify`,admin.token,'PUT',{is_verified:false});
    pass('Web admin verification/profile changes reach actual Web/Android modules; authenticated Socket.IO hint and persisted revisions/inbox');
    const category=await req('/admin/categories',admin.token,'POST',{name:'Admin test trade',icon:'T',description:'Category test',is_visible:true});
    const revisions=await req('/sync',home.token);
    await req('/admin/categories',admin.token,'POST',{name:category.name.toUpperCase()},409);
    await req(`/admin/categories/${category.id}`,admin.token,'PUT',{name:'Admin edited trade',is_visible:false});
    assert(!(await web.categoriesAPI.getAll()).some(c=>c.id===category.id));assert(!(await mobile.apiRequest('/categories')).some(c=>c.id===category.id));await req(`/categories/${category.id}`,home.token,'GET',undefined,404);
    const now=await req('/sync',home.token);for(const key of ['categories','helpers','jobs'])assert.notEqual(now[key],revisions[key]);
    const electrical=(await req('/categories')).find(c=>c.name==='Electrical');
    const service=(await pool.query('SELECT id FROM helper_services WHERE helper_id=$1 LIMIT 1',[helper])).rows[0];
    if(service){await req(`/admin/services/${service.id}`,admin.token,'PUT',{is_hidden:true});assert(!(await mobile.helpersAPI.getById(helper)).services.some(s=>s.id===service.id));await req(`/admin/services/${service.id}`,admin.token,'PUT',{is_hidden:false});}
    await req(`/admin/categories/${electrical.id}`,admin.token,'PUT',{is_visible:false});assert(!(await web.helpersAPI.getAll({category:electrical.id})).helpers.some(h=>h.id===helper));await req(`/admin/categories/${electrical.id}`,admin.token,'PUT',{is_visible:true});
    pass('Category creation/edit/visibility and service moderation synchronize; reconnect authority invalidates discovery without deleting relationships');
    const job=(await pool.query("INSERT INTO jobs(user_id,category_id,title,description,budget,preferred_date) VALUES($1,$2,'Admin monitoring job','Preserved description',200,CURRENT_TIMESTAMP+INTERVAL '20 days') RETURNING *",[home.user.id,electrical.id])).rows[0];
    global.__adminMobile={token:worker.token,activeRole:'helper'};
    await req(`/admin/jobs/${job.id}`,admin.token,'PUT',{is_hidden:true});assert(!(await mobile.jobsAPI.getAll()).some(j=>j.id===job.id));
    await req(`/jobs/${job.id}/apply`,worker.token,'POST',{proposed_price:100},404);
    assert.equal((await pool.query('SELECT description FROM jobs WHERE id=$1',[job.id])).rows[0].description,job.description);
    await req(`/admin/jobs/${job.id}`,admin.token,'PUT',{is_hidden:false});
    const review=(await pool.query('SELECT * FROM reviews WHERE helper_id=$1 LIMIT 1',[helper])).rows[0];
    await req(`/admin/reviews/${review.id}`,admin.token,'PUT',{is_hidden:true});assert(!(await web.reviewsAPI.getForHelper(helper)).reviews.some(r=>r.id===review.id));assert.equal((await pool.query('SELECT rating FROM reviews WHERE id=$1',[review.id])).rows[0].rating,review.rating);await req(`/admin/reviews/${review.id}`,admin.token,'PUT',{is_hidden:false});
    const complaint=(await pool.query('SELECT id FROM complaints WHERE complainant_id=$1 LIMIT 1',[home.user.id])).rows[0];
    global.__adminMobile={token:home.token,activeRole:'household'};
    await req(`/admin/complaints/${complaint.id}`,admin.token,'PUT',{status:'resolved',admin_notes:'Investigated test case'});assert.equal((await mobile.complaintsAPI.getMine()).find(c=>c.id===complaint.id).status,'resolved');assert((await req('/notifications',home.token)).some(n=>n.type==='complaint_updated'));
    await req(`/admin/complaints/${complaint.id}`,admin.token,'PUT',{status:'open',admin_notes:'Preserve'});
    pass('Reversible jobs/reviews moderation preserves source and rating rows; complaint decision reaches mobile and durable inbox');
    for(const resource of resources){const read=await req('/admin/monitor/'+resource,admin.token);assert(Array.isArray(read.rows));assert(read.total>=read.rows.length);assert(!JSON.stringify(read).includes('password_hash'));}
    const expired=(await pool.query("INSERT INTO emergency_requests(household_id,description,location,contact_phone,expires_at) VALUES($1,'Expired monitoring fixture','Fixture location','fixture',CURRENT_TIMESTAMP-INTERVAL '1 minute') RETURNING id",[home.user.id])).rows[0];
    assert((await req('/admin/monitor/emergencies?status=expired',admin.token)).rows.some(r=>r.id===expired.id&&r.status==='expired'));
    assert(!(await req('/admin/monitor/emergencies?status=pending',admin.token)).rows.some(r=>r.id===expired.id));
    const stats=await req('/admin/stats',admin.token);assert.equal(stats.bookings.total,Number((await pool.query('SELECT count(*) FROM bookings')).rows[0].count));assert.equal(stats.complaints,Number((await pool.query('SELECT count(*) FROM complaints')).rows[0].count));
    pass('All ten monitor queries execute on PostgreSQL; statistics match real records including inactive/history');
    const disconnected=new Promise(resolve=>socket.once('disconnect',resolve));
    await req(`/admin/users/${worker.user.id}`,admin.token,'PUT',{is_active:false});await disconnected;
    await req('/helpers/me',worker.token,'GET',undefined,403);
    const denied=io(base.replace('/api',''),{auth:{token:worker.token},transports:['websocket'],reconnection:false});await new Promise((resolve,reject)=>{denied.once('connect_error',resolve);denied.once('connect',()=>reject(new Error('Inactive socket accepted')));});denied.disconnect();
    await req(`/admin/users/${worker.user.id}`,admin.token,'PUT',{is_active:true});
    pass('Account suspension disconnects live socket and denies existing REST/token/reconnect access');
  }finally{socket.disconnect();}
  const dbRace=await Promise.allSettled([admin.user.id,admin2.user.id].map(id=>pool.query("UPDATE users SET role='household' WHERE id=$1",[id])));
  assert.equal(dbRace.filter(r=>r.status==='fulfilled').length,1);assert.equal(dbRace.find(r=>r.status==='rejected').reason.code,'23514');
  await pool.query("UPDATE users SET role='admin',is_active=true WHERE id=ANY($1::int[])",[[admin.user.id,admin2.user.id]]);
  const repeatable=await Promise.all([pool.connect(),pool.connect()]);
  try{
    for(const db of repeatable){await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await db.query('SELECT id FROM users');}
    const race=await Promise.allSettled(repeatable.map(async(db,i)=>{try{await db.query("UPDATE users SET role='household' WHERE id=$1",[[admin.user.id,admin2.user.id][i]]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}}));
    assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert(['23514','40001','40P01'].includes(race.find(r=>r.status==='rejected').reason.code));
  }finally{for(const db of repeatable)db.release();}
  assert.equal(Number((await pool.query("SELECT count(*) FROM users WHERE role='admin' AND is_active")).rows[0].count),1);
  await pool.query("UPDATE users SET role='admin',is_active=true WHERE id=ANY($1::int[])",[[admin.user.id,admin2.user.id]]);
  const raced=await Promise.all([[admin,admin2],[admin2,admin]].map(async([actor,victim])=>{const r=await fetch(base+`/admin/users/${victim.user.id}`,{method:'PUT',headers:{Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},body:JSON.stringify({role:'household'})});return r.status;}));
  assert.equal(raced.filter(s=>s===200).length,1);assert(raced.some(s=>s===403||s===409));assert.equal(Number((await pool.query("SELECT count(*) FROM users WHERE role='admin' AND is_active")).rows[0].count),1);
  const last=(await pool.query("SELECT id FROM users WHERE role='admin' AND is_active")).rows[0];
  await assert.rejects(pool.query('UPDATE users SET is_active=false WHERE id=$1',[last.id]),e=>e.code==='23514');await assert.rejects(pool.query('DELETE FROM users WHERE id=$1',[last.id]),e=>e.code==='23514');
  await pool.query("UPDATE users SET role='admin',is_active=true WHERE id=$1",[admin.user.id]);
  if(second.id!==admin.user.id)await pool.query("UPDATE users SET role='household' WHERE id=$1",[second.id]);
  pass('Concurrent mutual demotion retains administrator under READ COMMITTED and REPEATABLE READ; DB rejects last-admin deactivation/deletion');
  const audit=await pool.query('SELECT * FROM admin_audit_logs ORDER BY id');assert(audit.rows.some(r=>r.outcome==='SUCCESS'&&r.actor_id===admin.user.id));assert(audit.rows.some(r=>r.outcome==='REJECTED'));assert(audit.rows.some(r=>r.outcome==='DENIED'));assert(audit.rows.every(r=>r.created_at&&r.action&&r.target));assert(!JSON.stringify(audit.rows).includes('fixture-password'));
  await pool.query("CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='user.update' THEN RAISE EXCEPTION 'Isolated audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_audit_failure BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION test_reject_audit()");
  try{await req(`/admin/users/${home.user.id}`,admin.token,'PUT',{is_active:false},503);assert((await pool.query('SELECT is_active FROM users WHERE id=$1',[home.user.id])).rows[0].is_active);}finally{await pool.query('DROP TRIGGER test_audit_failure ON admin_audit_logs; DROP FUNCTION test_reject_audit()');}
  pass('Real PostgreSQL audit-write failure rolls back account mutation and surfaces 503');
  for(const sql of ['UPDATE admin_audit_logs SET action=\'tamper\'','DELETE FROM admin_audit_logs','TRUNCATE admin_audit_logs'])await assert.rejects(pool.query(sql),e=>e.code==='23514');
  const checkpoint=Number((await pool.query('SELECT count(*) FROM admin_audit_logs')).rows[0].count);await require('../db/ensureSchema')();assert.equal(Number((await pool.query('SELECT count(*) FROM admin_audit_logs')).rows[0].count),checkpoint);
  pass('Audit actor/action/target/time/outcomes persist across migration rerun; append-only UPDATE/DELETE/TRUNCATE enforcement');
  await fs.writeFile(path.resolve(__dirname,'../../docs/test-results/admin-local.json'),JSON.stringify({executed_at:new Date().toISOString(),database:'suite-owned isolated PostgreSQL; synthetic records',results,physicalAndroid:'IMPLEMENTED/UNVERIFIED: phone required',production:'BLOCKED: separate migration/deployment approval required'},null,2)+'\n');
}
main().catch(e=>{console.error('Admin tests failed:',e.message);process.exitCode=1;}).finally(()=>pool.end());
