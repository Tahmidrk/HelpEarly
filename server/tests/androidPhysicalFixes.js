const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const pool=require('../config/db'),{chat,getContext}=require('../controllers/aiAssistant'),{flushNotifications}=require('../utils/notifications');
const base=process.env.TEST_API_URL,results={};
const pass=name=>{results[name]='PASS';console.log('PASS '+name);};
async function req(endpoint,account,role,method='GET',body,status=200) {
 const response=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json',...(account?{Authorization:'Bearer '+account.token}:{}),...(role?{'X-Active-Role':role}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();assert.equal(response.status,status,`${method} ${endpoint}: ${data.message || ''}`);return data;
}
async function main(){
 assert(/^helpearly_free_test_\d+$/.test(pool.options.database),'Disposable local suite DB required');
 assert(/^http:\/\/127\.0\.0\.1:\d+\/api$/.test(base),'Local API required');
 const stamp=Date.now(),accounts=[];
 for(const [name,role]of [['Dual A','both'],['Dual B','both'],['Unrelated Home','household'],['New Home','household']])accounts.push(await req('/auth/register',null,null,'POST',{name,email:`phone-${stamp}-${accounts.length}@fixture.test`,password:'testpass123',nid_number:'fixture',role,category:'Electrical',location:'Dhanmondi, Dhaka',phone:'01700000000'},201));
 const [a,b,stranger,fresh]=accounts;
 await req('/admin/stats',a,'admin','GET',undefined,403);
 await req('/helpers',a,'admin','GET',undefined,403);
 const first=await req('/messages/conversation/'+b.user.id,a,'household');
 const reverse=await req('/messages/conversation/'+a.user.id,b,'household');assert.notEqual(first.id,reverse.id);
 await req('/messages',a,'household','POST',{recipient_id:b.user.id,content:'A household thread'},201);
 await req('/messages',b,'household','POST',{recipient_id:a.user.id,content:'B household thread'},201);
 assert((await req('/messages/'+first.id,b,'helper')).some(m=>m.content==='A household thread'));
 await req('/messages/'+first.id,b,'household','GET',undefined,403);
 assert.deepEqual((await req('/messages/conversations',a,'household')).map(c=>c.id),[first.id]);
 assert.deepEqual((await req('/messages/conversations',a,'helper')).map(c=>c.id),[reverse.id]);
 await req('/messages/conversation/'+stranger.user.id,a,'helper','GET',undefined,403);
 await req('/messages/contacts?q=Unrelated',a,'helper').then(rows=>assert.equal(rows.length,0));
 const newChat=await req('/messages/conversation/'+a.user.id,fresh,'household');assert(newChat.id);
 await req('/messages/conversation/'+a.user.id,fresh,'helper','GET',undefined,403);
 pass('New-account chat works; opposite dual-role threads and REST authorization remain isolated; unrelated household discovery denied');
 const category=(await pool.query("SELECT id FROM categories WHERE name='Electrical'")).rows[0].id;
 for(const date of ['2026-02-30','2020-01-01','11/10/2026'])await req('/jobs',stranger,'household','POST',{category_id:category,title:'Invalid date',description:'Must reject',budget:100,preferred_date:date,location:'Dhaka'},400);
 pass('Forged admin active mode denied for dual users, including public optional authentication; malformed/rollover/past job dates rejected');
 const job=await req('/jobs',stranger,'household','POST',{category_id:category,title:'Eligible contact job',description:'Isolated job',budget:100,preferred_date:new Date(Date.now()+86400000).toISOString(),location:'Dhaka'},201);
 await req('/jobs/'+job.id+'/apply',a,'helper','POST',{proposed_price:100,message:'Can help'},201);
 const contacts=await req('/messages/contacts?q=Unrelated',a,'helper');assert(contacts.some(c=>c.id===stranger.user.id));assert(contacts.every(c=>Object.keys(c).every(k=>['id','name','avatar_url'].includes(k))));
 await req('/messages/conversation/'+stranger.user.id,a,'helper');pass('Worker contact search and first contact require real job interaction; no phone/address/email returned');
 const oldFetch=global.fetch,oldKey=process.env.GEMINI_API_KEY;
 try{
  process.env.GEMINI_API_KEY='isolated-provider-stub';global.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Scoped answer'}]}}]})});
  for(const role of ['household','helper']){const response={status(){return this;},json(v){this.data=v;}};await chat({user:a.user,activeRole:role,body:{message:role+' private question'}},response);assert.equal(response.data.reply,'Scoped answer');}
 }finally{global.fetch=oldFetch;process.env.GEMINI_API_KEY=oldKey;}
 const homeHistory=await req('/chatbot',a,'household'),workerHistory=await req('/chatbot',a,'helper');assert(homeHistory.some(m=>m.content==='household private question'));assert(!homeHistory.some(m=>m.content==='helper private question'));assert(workerHistory.some(m=>m.content==='helper private question'));assert(!workerHistory.some(m=>m.content==='household private question'));
 const context=await getContext(a.user,'helper');assert.equal(context.my_jobs.length,0);pass('Real SQL AI history and context scoped to active role; provider stub explicitly used, no fake live AI claim');
 await req('/auth/profile',a,'helper','PUT',{location:'Confirmed service area, Dhaka',latitude:91,longitude:90,location_confirmed:true},400);
 await req('/auth/profile',a,'helper','PUT',{location:'Confirmed service area, Dhaka',latitude:23.746123,longitude:90.374567},400);
 await req('/auth/profile',a,'helper','PUT',{location:'Confirmed service area, Dhaka',latitude:23.746123,longitude:90.374567,location_confirmed:true});
 const helper=await req('/helpers/'+a.user.helperProfile.id,fresh,'household');assert.equal(Number(helper.latitude),23.75);assert.equal(Number(helper.longitude),90.37);assert.equal(helper.location_confirmed,true);
 await req('/auth/profile',a,'helper','PUT',{location:'Corrected service area, Dhaka'});const corrected=await req('/auth/me',a,'helper');assert.equal(corrected.location_confirmed,false);assert.equal(corrected.latitude,null);assert.equal(corrected.longitude,null);pass('Invalid/unconfirmed coordinates rejected; public map rounded; correcting address clears stale map without changing other records');
 await req('/helpers/me',a,'helper','PUT',{is_available:true});await req('/helpers/me',b,'helper','PUT',{is_available:true});
 const emergency=await req('/emergency/notify',fresh,'household','POST',{category_id:category,location:'Confirmed test address',contact_phone:''});assert.equal(emergency.alertDetails.contact_phone,'01700000000');
 const workerInbox=await req('/notifications',a,'helper'),homeInbox=await req('/notifications',a,'household');assert(workerInbox.some(n=>n.type==='emergency_new'&&n.data.request_id===emergency.alertDetails.id));assert(!homeInbox.some(n=>n.type==='emergency_new'));await req('/notifications/'+workerInbox.find(n=>n.type==='emergency_new').id+'/read',a,'household','PUT',undefined,404);
 const request=(await req('/emergency',a,'helper')).find(e=>e.id===emergency.alertDetails.id);assert.equal(request.contact_phone,'01700000000');assert.equal(request.household_name,'New Home');await req('/emergency/'+request.id+'/accept',a,'household','POST',undefined,403);
 await req('/emergency/'+request.id+'/cancel',fresh,'household','POST');pass('Emergency audience/contact fallback, full authenticated details and wrong-role read/accept denial');
 const device=randomUUID(),token=`ExpoPushToken[isolated_phone_${stamp}]`;
 await req('/notifications/devices',a,'helper','POST',{device_id:device,token,platform:'android'},201);
 const before=(await pool.query('SELECT updated_at FROM push_devices WHERE device_id=$1',[device])).rows[0].updated_at;
 await req('/notifications/devices',a,'helper','POST',{device_id:device,token,platform:'android'},201);
 assert.deepEqual((await pool.query('SELECT updated_at FROM push_devices WHERE device_id=$1',[device])).rows[0].updated_at,before);
 await req('/notifications/devices/'+device+'/audience',a,'household','PUT');
 await pool.query("SELECT enqueue_notification($1,$2,'booking_pending','Scoped worker alert','{\"audience\":\"helper\"}')",[a.user.id,'scope:wrong:'+stamp]);
 await pool.query("SELECT enqueue_notification($1,$2,'booking_confirmed','Scoped home alert','{\"audience\":\"household\"}')",[a.user.id,'scope:right:'+stamp]);
 const fetchSaved=global.fetch,pushSaved=process.env.PUSH_ENABLED;let payload=[];
 try{process.env.PUSH_ENABLED='true';global.fetch=async(url,options)=>{assert(String(url).startsWith('https://exp.host/'));const body=JSON.parse(options.body);if(String(url).endsWith('send')){payload.push(...body);return{ok:true,json:async()=>({data:body.map((_,i)=>({status:'ok',id:'isolated-ticket-'+stamp+'-'+i}))})};}return{ok:true,json:async()=>({data:Object.fromEntries(body.ids.map(id=>[id,{status:'ok'}]))})};};await flushNotifications();assert(payload.length>0);assert(payload.filter(p=>p.to===token).every(p=>p.data.audience==='household'));assert(payload.every(p=>!JSON.stringify(p).includes('01700000000')));await pool.query("UPDATE push_deliveries SET next_attempt_at=CURRENT_TIMESTAMP WHERE ticket_id LIKE $1",['isolated-ticket-'+stamp+'%']);await flushNotifications();assert((await pool.query("SELECT count(*)::int n FROM push_deliveries WHERE ticket_id LIKE $1 AND status='delivered'",['isolated-ticket-'+stamp+'%'])).rows[0].n>0);
 }finally{global.fetch=fetchSaved;process.env.PUSH_ENABLED=pushSaved;}
 pass('Push registration timestamp stable, role audience switches, outbox tickets/receipts persisted; provider simulated, physical delivery NOT RUN');
 await req('/notifications/devices/'+device,a,'household','DELETE');assert.equal((await pool.query('SELECT active FROM push_devices WHERE device_id=$1',[device])).rows[0].active,false);
 const resumed=await req('/auth/login',null,null,'POST',{email:a.user.email,password:'testpass123'});assert.equal((await req('/messages/'+first.id,resumed,'household')).length,1);pass('Logout device deactivation and fresh login retain scoped messages');
 await fs.writeFile(path.resolve(__dirname,'../../docs/test-results/android-physical-fixes-backend.json'),JSON.stringify({executed_at:new Date().toISOString(),database:'Disposable isolated PostgreSQL; synthetic records only',results,physical:'NOT RUN',push_provider:'Simulated tickets/receipts; not evidence of FCM delivery'},null,2)+'\n');
}
main().catch(e=>{console.error('Android fixes test failed:',e.message);process.exitCode=1;}).finally(()=>pool.end());
