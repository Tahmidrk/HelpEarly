const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const pool=require('../config/db');
const bcrypt=require('bcryptjs');
const {io}=require('../../mobile/node_modules/socket.io-client');
const {getContext}=require('../controllers/aiAssistant');
const base=process.env.TEST_API_URL || 'http://localhost:5000/api';
const stamp=Date.now(),emails=[],sockets=[],results={};
async function req(path,token,method='GET',body,expected=200,role) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(role?{'X-Active-Role':role}: {})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);return data;
}
async function account(role,label,category) {
  const email=`production-${label}-${stamp}@example.test`;emails.push(email);
  return req('/auth/register',null,'POST',{name:label,email,password:'testpass123',nid_number:`test-${label}-${stamp}`,role,phone:'01700000000',location:'Dhaka',...(category?{selectedCategories:[category]}:{})},201);
}
function pass(name){results[name]='PASS';}
async function connect(token,expected=true){
  const socket=io(base.replace(/\/api$/,''),{auth:{token},transports:['websocket'],reconnection:false});sockets.push(socket);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Socket timeout')),5000);socket.once(expected?'connect':'connect_error',()=>{clearTimeout(timer);resolve();});socket.once(expected?'connect_error':'connect',()=>{clearTimeout(timer);reject(new Error('Unexpected socket authorization result'));});});return socket;
}
async function main(){
  const categories=await req('/categories'),electrical=categories.find(c=>c.name==='Electrical').id,cleaning=categories.find(c=>c.name==='Cleaning').id;
  const household=await account('household','household'),other=await account('household','other'),a=await account('helper','workerA',electrical),b=await account('helper','workerB',electrical),wrong=await account('helper','cleaner',cleaning),dual=await account('both','dual',electrical);
  const at=a.token,bt=b.token,ht=household.token,helper=a.user.helperProfile.id;
  await req('/notifications',null,'GET',undefined,401);
  await req('/admin/stats',at,'GET',undefined,403);
  await req('/helpers/me',dual.token,'GET',undefined,403,'household');
  const discovered=await req('/helpers?limit=1000',dual.token);
  assert(!discovered.helpers.some(h=>h.user_id===dual.user.id));
  assert(discovered.helpers.every(h=>!('email' in h) && !('phone' in h)));
  await req(`/helpers/${dual.user.helperProfile.id}`,dual.token,'GET',undefined,404);pass('roleIsolationAndPublicPrivacy');
  await req('/helpers/settings',at,'PUT',{category:'Electrical',bio:'Wiring specialist',hourly_rate:750,experience_years:2,services:[{service_name:'Wiring inspection',price:750}]});
  const persistedProfile=await req('/auth/me',at);assert.equal(persistedProfile.helperProfile.primary_category,'Electrical');assert.equal(persistedProfile.helperProfile.services[0].service_name,'Wiring inspection');
  const filtered=await req(`/helpers?category=${electrical}&location=Dhaka&search=workerA&max_rate=800`,ht);assert(filtered.helpers.some(h=>h.id===helper));assert(!(await req('/helpers?search=workerA&max_rate=700',ht)).helpers.some(h=>h.id===helper));
  await req('/helpers/me',at,'PUT',{hourly_rate:-1},400);pass('workerSettingsAndDiscoveryFilters');
  await req('/helpers?page=-1',ht,'GET',undefined,400);
  await req('/helpers?category=malformed',ht,'GET',undefined,400);
  await req('/messages',ht,'POST',{recipient_id:a.user.id,content:{text:'invalid'}},400);pass('requestValidation');
  const date=new Date(Date.now()+7*86400000);
  const bookingBody={helper_id:helper,booking_date:date.toISOString(),address:'Dhaka',total_price:900,service_description:'Inspect wiring'};
  const booking=await req('/bookings',ht,'POST',bookingBody,201);
  const repeat=await req('/bookings',ht,'POST',bookingBody,200);assert.equal(booking.id,repeat.id);pass('bookingIdempotency');
  const nextDate=new Date(date.getTime()+2*3600000);
  const second=await req('/bookings',ht,'POST',{...bookingBody,booking_date:nextDate.toISOString()},201);
  await req(`/bookings/${second.id}`,ht,'PUT',{booking_date:date.toISOString()},409);
  const moved=await req(`/bookings/${second.id}`,ht,'PUT',{booking_date:new Date(nextDate.getTime()+3600000).toISOString()});assert.equal(new Date(moved.end_date)-new Date(moved.booking_date),3600000);pass('rescheduleConflictAndDuration');
  await req(`/bookings/${booking.id}`,at,'PUT',{status:'confirmed'});
  await req(`/bookings/${booking.id}`,at,'PUT',{status:'completed'});
  await req(`/bookings/${booking.id}`,ht,'DELETE',undefined,409);pass('completedBookingImmutability');
  const job=await req('/jobs',ht,'POST',{category_id:electrical,title:'Concurrent proposal test',description:'Wiring repair',budget:1000,preferred_date:new Date(date.getTime()+86400000).toISOString(),location:'Dhaka'},201);
  await req(`/jobs/${job.id}/apply`,at,'POST',{proposed_price:-1},400);
  const p1=await req(`/jobs/${job.id}/apply`,at,'POST',{proposed_price:950},201),p2=await req(`/jobs/${job.id}/apply`,bt,'POST',{proposed_price:960},201);
  const accepts=await Promise.all([p1,p2].map(p=>fetch(base+`/jobs/applications/${p.id}`,{method:'PUT',headers:{Authorization:`Bearer ${ht}`,'Content-Type':'application/json'},body:JSON.stringify({status:'accepted'})})));
  assert.deepEqual(accepts.map(r=>r.status).sort(),[200,409]);
  const details=await req(`/jobs/${job.id}`,ht);assert.equal(details.applications.filter(p=>p.status==='accepted').length,1);assert.equal(details.applications.filter(p=>p.status==='rejected').length,1);
  const confirmed=(await pool.query('SELECT * FROM bookings WHERE job_application_id=ANY($1::int[])',[[p1.id,p2.id]])).rows;assert.equal(confirmed.length,1);
  const workerToken=confirmed[0].helper_id===helper?at:bt;
  await req(`/bookings/${confirmed[0].id}`,workerToken,'PUT',{status:'completed'});assert.equal((await req(`/jobs/${job.id}`,ht)).status,'completed');pass('atomicProposalAcceptanceAndJobCompletion');
  const emergency=async()=> (await req('/emergency/notify',ht,'POST',{category_name:'Electrical',location:'Dhaka',contact_phone:'01700000000',description:'Dangerous broken circuit'})).alertDetails;
  const e=await emergency();
  assert((await req('/emergency',at)).some(row=>row.id===e.id));assert(!(await req('/emergency',wrong.token)).some(row=>row.id===e.id));
  await req(`/emergency/${e.id}/accept`,wrong.token,'POST',undefined,403);
  await req(`/emergency/${e.id}/accept`,ht,'POST',undefined,403);
  const accepted=await Promise.all([at,bt].map(token=>fetch(base+`/emergency/${e.id}/accept`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})));
  assert.deepEqual(accepted.map(r=>r.status).sort(),[200,409]);
  const persisted=(await pool.query('SELECT * FROM emergency_requests WHERE id=$1',[e.id])).rows[0];assert.equal(persisted.status,'accepted');assert(persisted.booking_id);pass('emergencyEligibilityAndAtomicAcceptance');
  const declined=await emergency();await req(`/emergency/${declined.id}/decline`,at,'POST');
  assert(!(await req('/emergency',at)).some(row=>row.id===declined.id));assert((await req('/emergency',bt)).some(row=>row.id===declined.id));
  await req(`/emergency/${declined.id}/accept`,at,'POST',undefined,403);pass('emergencyDeclineIsPerWorker');
  await req(`/emergency/${declined.id}/cancel`,other.token,'POST',undefined,409);await req(`/emergency/${declined.id}/cancel`,ht,'POST');await req(`/emergency/${declined.id}/accept`,bt,'POST',undefined,409);
  const expired=await emergency();await pool.query("UPDATE emergency_requests SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1",[expired.id]);await req(`/emergency/${expired.id}/accept`,bt,'POST',undefined,409);assert.equal((await req('/emergency',ht)).find(row=>row.id===expired.id).effective_status,'expired');pass('emergencyCancellationAndExpiry');
  await pool.query('SELECT expire_emergency_notifications()');assert((await req('/notifications',ht)).some(n=>n.type==='emergency_expired' && n.data.request_id===expired.id));
  const unavailable=await emergency();await req('/helpers/me',bt,'PUT',{is_available:false});assert(!(await req('/emergency',bt)).some(row=>row.id===unavailable.id));await req(`/emergency/${unavailable.id}/accept`,bt,'POST',undefined,403);await req('/helpers/me',bt,'PUT',{is_available:true});await req(`/emergency/${unavailable.id}/cancel`,ht,'POST');pass('emergencyAvailabilityAndExpiryNotifications');
  const selfEmergency=(await req('/emergency/notify',dual.token,'POST',{category_name:'Electrical',location:'Dhaka',contact_phone:'01700000000'},200,'household')).alertDetails;
  assert(!(await req('/emergency',dual.token,'GET',undefined,200,'helper')).some(row=>row.id===selfEmergency.id));await req(`/emergency/${selfEmergency.id}/accept`,dual.token,'POST',undefined,403,'helper');pass('emergencySelfExclusion');
  const device=randomUUID(),token=`ExpoPushToken[test_${stamp}_tokenA]`,rotated=`ExpoPushToken[test_${stamp}_tokenB]`;
  await req('/notifications/devices',at,'POST',{device_id:'bad',token,platform:'android'},400);
  await req('/notifications/devices',at,'POST',{device_id:device,token,platform:'android',user_id:household.user.id},201);
  assert.equal((await pool.query('SELECT user_id FROM push_devices WHERE device_id=$1',[device])).rows[0].user_id,a.user.id);
  await req('/notifications/devices',bt,'POST',{device_id:randomUUID(),token,platform:'android'},409);
  await req('/notifications/devices',at,'POST',{device_id:device,token:rotated,platform:'android'},201);
  await req(`/notifications/devices/${device}`,bt,'DELETE');assert((await pool.query('SELECT active FROM push_devices WHERE device_id=$1',[device])).rows[0].active);
  await req(`/notifications/devices/${device}`,at,'DELETE');assert.equal((await pool.query('SELECT active,token FROM push_devices WHERE device_id=$1',[device])).rows[0].active,false);pass('pushTokenOwnershipRotationAndDeactivation');
  const conversations=await Promise.all(Array.from({length:4},()=>req(`/messages/conversation/${a.user.id}`,ht)));assert.equal(new Set(conversations.map(c=>c.id)).size,1);
  const conversation=conversations[0];await req(`/messages/${conversation.id}`,other.token,'GET',undefined,403);
  const socket=await connect(at);
  const live=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Persisted chat event missing')),5000);socket.once('new_message',data=>{clearTimeout(timeout);resolve(data);});});
  const sent=await req('/messages',ht,'POST',{recipient_id:a.user.id,content:'Production socket persistence test'},201);assert.equal((await live).id,sent.message.id);
  assert.equal((await req(`/messages/${conversation.id}`,at)).find(m=>m.id===sent.message.id).content,'Production socket persistence test');
  const latest=await req('/messages',at,'POST',{recipient_id:household.user.id,content:'Latest page test'},201);
  assert.equal((await req(`/messages/${conversation.id}?limit=1`,ht))[0].id,latest.message.id);
  const denied=await socket.timeout(3000).emitWithAck('join_conversation',2147483646);assert(denied.error);
  const unsaved=await socket.timeout(3000).emitWithAck('send_message',{conversationId:conversation.id,recipientId:household.user.id,content:'unsaved'});assert(unsaved.error);pass('chatRealtimePersistenceAuthorizationAndConversationRace');
  await pool.query('UPDATE users SET is_active=false WHERE id=$1',[wrong.user.id]);await connect(wrong.token,false);await req('/notifications',wrong.token,'GET',undefined,403);pass('bannedAccountSocketAndRestProtection');
  const inbox=await req('/notifications',at);assert(inbox.some(n=>n.type==='booking_pending'));assert(inbox.some(n=>n.type==='message_new'));assert(inbox.some(n=>n.type==='emergency_new'));
  assert(inbox.filter(n=>n.type.startsWith('booking_') || n.type.startsWith('emergency_')).every(n=>n.data.audience==='helper'));
  const householdInbox=await req('/notifications',ht);
  assert(householdInbox.some(n=>n.type==='emergency_created' && n.data.audience==='household'));
  assert(!householdInbox.some(n=>n.type==='emergency_new'));
  const notification=inbox[0];await req(`/notifications/${notification.id}/read`,ht,'PUT',undefined,404);await req(`/notifications/${notification.id}/read`,at,'PUT');
  await pool.query("SELECT enqueue_notification($1,'test:dedupe','test','Test','{}')",[a.user.id]);await pool.query("SELECT enqueue_notification($1,'test:dedupe','test','Test','{}')",[a.user.id]);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS total FROM notifications WHERE user_id=$1 AND event_key='test:dedupe'",[a.user.id])).rows[0].total,1);
  const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT enqueue_notification($1,'test:rollback','test','Test','{}')",[a.user.id]);await db.query('ROLLBACK');}finally{db.release();}assert.equal((await pool.query("SELECT COUNT(*)::int AS total FROM notifications WHERE user_id=$1 AND event_key='test:rollback'",[a.user.id])).rows[0].total,0);pass('notificationTriggersAuthorizationDeduplicationAndRollback');
  const hash=await bcrypt.hash('testpass123',10),adminEmail=`production-admin-${stamp}@example.test`;emails.push(adminEmail);
  await pool.query("INSERT INTO users(name,email,password_hash,role,nid_number) VALUES('Test admin',$1,$2,'admin',$3)",[adminEmail,hash,`test-admin-${stamp}`]);
  const admin=await req('/auth/login',null,'POST',{email:adminEmail,password:'testpass123'});
  await req(`/admin/helpers/${helper}/verify`,admin.token,'PUT',{is_verified:true});assert((await req('/notifications',at)).some(n=>n.type==='verification_updated'));
  const complaint=await req('/complaints',ht,'POST',{accused_id:a.user.id,subject:'Test investigation',description:'Test only'},201);await req(`/complaints/${complaint.id}`,at,'PUT',{status:'resolved'},403);await req(`/complaints/${complaint.id}`,admin.token,'PUT',{status:'resolved',admin_notes:'Verified'});assert((await req('/notifications',ht)).some(n=>n.type==='complaint_updated'));pass('verificationAndComplaintNotifications');
  const context=await getContext(household.user);assert(context.my_bookings.every(row=>row.user_id===household.user.id));assert(context.my_complaints.every(row=>row.id===complaint.id));assert(!JSON.stringify(context).includes('password_hash'));pass('aiDatabaseContextPrivacy');
  const relogged=await req('/auth/login',null,'POST',{email:household.user.email,password:'testpass123'});assert((await req('/bookings',relogged.token)).some(row=>row.id===booking.id));pass('reloginPersistence');
  const form=new FormData();Object.entries(bookingBody).forEach(([key,value])=>form.append(key,String(value)));form.append('photos',new Blob(['not an image'],{type:'image/png'}),'fake.png');
  const invalid=await fetch(base+'/bookings',{method:'POST',headers:{Authorization:`Bearer ${ht}`},body:form});assert.equal(invalid.status,400);pass('uploadContentValidation');
  console.log(JSON.stringify(results));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  sockets.forEach(socket=>socket.disconnect());
  if(emails.length) {
    await pool.query("DELETE FROM notifications WHERE type LIKE 'emergency_%' AND data->>'request_id' IN (SELECT e.id::text FROM emergency_requests e JOIN users u ON u.id=e.household_id WHERE u.email=ANY($1::text[]))",[emails]);
    await pool.query('DELETE FROM users WHERE email=ANY($1::text[])',[emails]);
  }
  await pool.end();
});
