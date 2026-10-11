const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const admin = require('../config/db');
const fixture = require('./fixtures/supabase-schema-20261010.json');
const { createStorage, decorateMedia } = require('../utils/storage');
const root = path.resolve(__dirname, '..');
const database = `helpearly_free_test_${Date.now()}`, testRole = `${database}_reader`;
const base = 'http://127.0.0.1:5073/api';
const results = {}, sockets = [];
let db, api, directory, created = false, roleCreated = false;
function pass(name) { results[name] = 'PASS'; console.log(`PASS ${name}`); }
function run(file, env, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: root, env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    let output = ''; child.stdout.on('data', value => output += value); child.stderr.on('data', value => output += value);
    child.on('error', reject); child.on('close', code => {
      if (code !== 0) console.error(output.trim());
      code === 0 ? resolve(output) : reject(new Error(`${path.basename(file)} failed (${code})`));
    });
  });
}
async function stopApi() { if (!api) return; const child=api; api=null; await new Promise(resolve => { child.once('exit',resolve); child.kill(); }); }
async function startApi(env) {
  api = spawn(process.execPath,['server.js'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  api.stdout.resume(); api.stderr.on('data', value => process.stderr.write(value));
  const deadline = Date.now()+20000;
  while(Date.now()<deadline) {
    if(api.exitCode!==null) throw new Error('Isolated API startup failed');
    try { const response=await fetch(base+'/ready'); if(response.ok) { assert.equal((await response.json()).schema,4); return; } } catch {}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error('Isolated API did not become ready');
}
async function request(endpoint, token, method='GET', body, expected=200) {
  const response = await fetch(base+endpoint,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
  const value = await response.json(); assert.equal(response.status,expected,`${method} ${endpoint}`); return value;
}
async function socketFor(token) {
  const {io}=require('../../mobile/node_modules/socket.io-client');
  const socket=io(base.replace('/api',''),{auth:{token},transports:['websocket'],reconnection:false}); sockets.push(socket);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Socket connection timeout')),5000);socket.once('connect',()=>{clearTimeout(timer);resolve();});socket.once('connect_error',error=>{clearTimeout(timer);reject(error);});}); return socket;
}
async function snapshot() {
  const result={}; for(const table of ['users','bookings','messages','jobs','reviews','complaints','payments','job_applications','conversations','helper_services','helper_categories']) {
    const columns=fixture.columns.filter(c=>c.table===table).map(c=>'"'+c.name+'"').join(',');
    result[table]=(await db.query(`SELECT ${columns} FROM "${table}" ORDER BY id`)).rows;
  }
  return JSON.stringify(result);
}
async function main() {
  const host=admin.options.connectionString?new URL(admin.options.connectionString).hostname:admin.options.host;
  assert(['localhost','127.0.0.1','::1','db'].includes(host),'Isolated suite refuses remote databases');
  await admin.query(`CREATE DATABASE "${database}"`); created=true;
  const config={...admin.options,password:admin.options.password,connectionString:undefined,database,ssl:false};
  if(admin.options.connectionString) {const u=new URL(admin.options.connectionString);Object.assign(config,{host:u.hostname,port:u.port||5432,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password)});}
  db=new Pool(config); directory=await fs.mkdtemp(path.join(os.tmpdir(),'helpearly-free-'));
  const env={...process.env,DATABASE_URL:'',DB_HOST:config.host,DB_PORT:String(config.port||5432),DB_USER:config.user,DB_PASSWORD:config.password,DB_NAME:database,DB_SSL:'false',NODE_ENV:'test',PORT:'5073',JWT_SECRET:randomUUID()+randomUUID(),UPLOAD_DIR:directory,STORAGE_PROVIDER:'local',PUSH_ENABLED:'false',RUN_BACKGROUND_WORKER:'false',TEST_API_URL:base,CLIENT_URL:'http://localhost:5173,http://localhost:8081'};
  // Reconstruct the 13-table live schema from read-only catalog metadata, not live rows.
  for(const table of [...new Set(fixture.columns.map(c=>c.table))]) {
    const columns=fixture.columns.filter(c=>c.table===table).map(c=>`"${c.name}" ${c.default?.startsWith('nextval(')?'SERIAL':c.type}${c.default && !c.default.startsWith('nextval(')?' DEFAULT '+c.default:''}${c.not_null?' NOT NULL':''}`);
    await db.query(`CREATE TABLE "${table}" (${columns.join(',')})`);
  }
  for(const constraint of fixture.constraints.filter(c=>c.type!=='f').concat(fixture.constraints.filter(c=>c.type==='f'))) await db.query(`ALTER TABLE "${constraint.table}" ADD CONSTRAINT "${constraint.name}" ${constraint.definition}`);
  for(const index of fixture.indexes) await db.query(index.definition);
  await run('-e',{...env,NODE_ENV:'production'},["require('./db/startup').startup().then(()=>{process.exitCode=1}).catch(e=>{if(e.code!=='42P01')process.exitCode=1}).finally(()=>require('./config/db').end())"]);
  assert.equal((await db.query("SELECT to_regclass('helpearly_schema') AS name")).rows[0].name,null);pass('Production startup refuses unmigrated database without changing schema');
  const hash=await require('bcryptjs').hash('fixture-password',10);
  const ids=(await db.query("INSERT INTO users(name,email,password_hash,role) VALUES('Fixture Home','home@fixture.test',$1,'household'),('Fixture Worker','worker@fixture.test',$1,'helper'),('Fixture Admin','admin@fixture.test',$1,'admin') RETURNING id",[hash])).rows.map(row=>row.id);
  const helper=(await db.query('INSERT INTO helpers(user_id) VALUES($1) RETURNING id',[ids[1]])).rows[0].id;
  const category=(await db.query("INSERT INTO categories(name) VALUES('Electrical') RETURNING id")).rows[0].id;
  await db.query('INSERT INTO helper_categories(helper_id,category_id) VALUES($1,$2)',[helper,category]);
  await db.query("INSERT INTO helper_services(helper_id,category_id,service_name) VALUES($1,$2,'Fixture service')",[helper,category]);
  const booking=(await db.query("INSERT INTO bookings(user_id,helper_id,booking_date,status) VALUES($1,$2,CURRENT_TIMESTAMP,'completed') RETURNING id",[ids[0],helper])).rows[0].id;
  const job=(await db.query("INSERT INTO jobs(user_id,title,description) VALUES($1,'Fixture job','Preserve this') RETURNING id",[ids[0]])).rows[0].id;
  await db.query('INSERT INTO job_applications(job_id,helper_id) VALUES($1,$2)',[job,helper]);
  const conversation=(await db.query('INSERT INTO conversations(user1_id,user2_id) VALUES($1,$2) RETURNING id',[ids[0],ids[1]])).rows[0].id;
  await db.query("INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,'Preserve message')",[conversation,ids[0]]);
  await db.query('INSERT INTO reviews(user_id,helper_id,booking_id,rating) VALUES($1,$2,$3,4)',[ids[0],helper,booking]);
  await db.query("INSERT INTO complaints(complainant_id,accused_id,subject,description) VALUES($1,$2,'Fixture complaint','Preserve')",[ids[0],ids[1]]);
  await db.query('INSERT INTO payments(user_id,helper_id,amount) VALUES($1,$2,100)',[ids[0],helper]);
  // A pre-existing duplicate proves an incompatible migration rolls back completely.
  const duplicate=(await db.query('INSERT INTO reviews(user_id,helper_id,booking_id,rating) VALUES($1,$2,$3,5) RETURNING id',[ids[0],helper,booking])).rows[0].id;
  await assert.rejects(run('db/migrate.js',env,['--approved']));
  assert.equal((await db.query("SELECT to_regclass('helpearly_schema') AS name")).rows[0].name,null);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='jobs' AND column_name='photos'")).rows[0].n,0);
  await db.query('DELETE FROM reviews WHERE id=$1',[duplicate]); pass('Migration rollback on legacy conflict');
  const before=await snapshot();
  await run('db/migrate.js',env,['--approved']); assert.equal(await snapshot(),before);
  await run('db/migrate.js',env,['--approved']); assert.equal(await snapshot(),before); pass('Live schema replica migration: records preserved, repeatable');
  await admin.query(`CREATE ROLE "${testRole}" NOLOGIN`); roleCreated=true;
  await db.query(`GRANT USAGE ON SCHEMA public TO "${testRole}"; GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${testRole}"`);
  const security=(await fs.readFile(path.join(root,'db/migrations/api-security.sql'),'utf8')).replaceAll("'anon'",`'${testRole}'`);
  await db.query(security);
  assert((await db.query("SELECT bool_and(relrowsecurity) AS secured FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'")).rows[0].secured);
  assert.equal((await db.query("SELECT has_table_privilege($1,'public.users','SELECT') AS allowed",[testRole])).rows[0].allowed,false);
  const reader=await db.connect();try {await reader.query('SET ROLE "'+testRole+'"');await assert.rejects(reader.query('SELECT password_hash FROM users'),e=>e.code==='42501');await assert.rejects(reader.query("SELECT enqueue_notification(1,'x','x','x','{}')"),e=>e.code==='42501');}finally{await reader.query('RESET ROLE');reader.release();}
  pass('RLS, Data API grants and RPC execution denied for non-owner');
  await startApi(env);
  const corsAllowed=await fetch(base+'/health',{headers:{Origin:'http://localhost:5173'}});assert.equal(corsAllowed.headers.get('access-control-allow-origin'),'http://localhost:5173');
  const corsDenied=await fetch(base+'/health',{headers:{Origin:'https://untrusted.fixture.test'}});assert.equal(corsDenied.headers.get('access-control-allow-origin'),null);pass('HTTP CORS allowlist');
  console.log((await run('tests/mvpFlows.js',env)).trim()); pass('14 database-backed MVP groups');
  console.log((await run('tests/productionFlows.js',env)).trim()); pass('20 authorization/concurrency/outbox groups');
  console.log((await run('tests/nextPhase.js',env)).trim()); pass('Next-phase two-way client workflows and isolated AI provider failures');
  console.log((await run('tests/adminFlows.js',env)).trim()); pass('Central web administration, audit, authorization and cross-platform integration');
  console.log((await run('tests/passwordSessions.js',env)).trim()); pass('Password rotation revokes HTTP and Socket.IO sessions without schema changes');
  console.log((await run('tests/androidPhysicalFixes.js',env)).trim());pass('Android physical-test fixes: isolated role, privacy, chat, AI, location and notification regressions');
  const home=await request('/auth/login',null,'POST',{email:'home@fixture.test',password:'fixture-password'});
  const worker=await request('/auth/login',null,'POST',{email:'worker@fixture.test',password:'fixture-password'});
  const third=await request('/auth/register',null,'POST',{name:'Unrelated',email:'third@fixture.test',password:'fixture-password',role:'household',nid_number:'fixture-third'},201);
  await request('/sync',null,'GET',undefined,401);
  const webText=await fs.readFile(path.join(root,'../client/src/utils/sync.js'),'utf8'), mobileText=await fs.readFile(path.join(root,'../mobile/src/utils/sync.js'),'utf8'); assert.equal(mobileText,webText);
  const {createSynchronizer}=await import('data:text/javascript;base64,'+Buffer.from(webText).toString('base64'));
  const changedWeb=[],changedMobile=[];
  const web=createSynchronizer(()=>request('/sync',home.token),keys=>changedWeb.push(...keys));
  const mobile=createSynchronizer(()=>request('/sync',worker.token),keys=>changedMobile.push(...keys));
  await web.check();await mobile.check();changedWeb.length=0;changedMobile.length=0;
  const unrelated=await request('/sync',third.token);
  // Execute both real client API modules against this disposable PostgreSQL API.
  const esbuild = require('../../client/node_modules/esbuild');
  const webApiBuild = await esbuild.build({entryPoints:[path.join(root,'../client/src/utils/api.js')],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env':JSON.stringify({VITE_API_URL:base})}});
  const clientApi = await import('data:text/javascript;base64,'+Buffer.from(webApiBuild.outputFiles[0].text).toString('base64'));
  global.localStorage={getItem:key=>key==='token'?home.token:key==='activeRole'?'household':null};
  global.__parityMobileSession={token:worker.token,activeRole:'helper'};
  const mobileApiBuild=await esbuild.build({entryPoints:[path.join(root,'../mobile/src/api/client.js')],bundle:true,write:false,platform:'node',format:'esm',define:{'process.env.EXPO_PUBLIC_API_URL':JSON.stringify(base)},plugins:[{name:'native-test-bindings',setup(build){
    build.onResolve({filter:/^(react-native|@react-native-async-storage\/async-storage|expo-constants|expo-file-system)$/},args=>({path:args.path,namespace:'native-test'}));
    build.onLoad({filter:/.*/,namespace:'native-test'},args=>({contents:args.path==='react-native'?"export const Platform={OS:'android'};":args.path.includes('async-storage')?"export default {getItem:async key=>globalThis.__parityMobileSession[key]||null};":args.path==='expo-file-system'?"export class File {}":"export default {};",loader:'js'}));
  }}]});
  const androidApi=await import('data:text/javascript;base64,'+Buffer.from(mobileApiBuild.outputFiles[0].text).toString('base64'));
  await clientApi.authAPI.updateProfile({name:'Web changed household',location:'Dhaka'});
  const sameAccountSession=global.__parityMobileSession;global.__parityMobileSession={token:home.token,activeRole:'household'};
  assert.equal((await androidApi.authAPI.getMe()).name,'Web changed household');
  global.__parityMobileSession=sameAccountSession;
  await androidApi.helpersAPI.saveSettings({category:'Electrical',bio:'Android updated services',hourly_rate:400,experience_years:2,services:[{service_name:'Parity wiring',price:400}]});
  assert.equal((await clientApi.helpersAPI.getOne(helper)).services[0].service_name,'Parity wiring');
  pass('Actual web and Android API modules share persisted profiles and worker services');
  const aiBefore=await clientApi.syncAPI.revisions();
  await db.query("INSERT INTO ai_messages(user_id,role,content,audience) VALUES($1,'user','Private cross-platform question','household'),($1,'model','Private cross-platform answer','household')",[home.user.id]);
  await web.check();assert(changedWeb.includes('ai'));assert.notEqual((await clientApi.syncAPI.revisions()).ai,aiBefore.ai);
  global.__parityMobileSession={token:home.token,activeRole:'household'};
  assert((await androidApi.chatbotAPI.history()).some(row=>row.content==='Private cross-platform answer'));
  assert.deepEqual(await clientApi.chatbotAPI.history(),await androidApi.chatbotAPI.history());
  assert.equal((await request('/sync',third.token)).ai,unrelated.ai);assert.equal((await request('/chatbot',third.token)).length,0);
  await db.query("SELECT enqueue_notification($1,'parity:inbox','test','Web inbox parity','{}')",[home.user.id]);
  const inboxItem=(await clientApi.notificationsAPI.list()).find(row=>row.title==='Web inbox parity');assert(inboxItem);
  await clientApi.notificationsAPI.read(inboxItem.id);assert((await androidApi.notificationsAPI.list()).find(row=>row.id===inboxItem.id).read_at);
  global.__parityMobileSession=sameAccountSession;changedWeb.length=0;changedMobile.length=0;
  pass('AI history and inbox read state synchronize across real APIs; unrelated user denied private history');
  const socket=await socketFor(worker.token);
  const deniedSocket=require('../../mobile/node_modules/socket.io-client').io(base.replace('/api',''),{auth:{token:worker.token},transports:['websocket'],reconnection:false,extraHeaders:{Origin:'https://untrusted.fixture.test'}});sockets.push(deniedSocket);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Origin rejection timeout')),5000);deniedSocket.once('connect_error',()=>{clearTimeout(timer);resolve();});deniedSocket.once('connect',()=>{clearTimeout(timer);reject(new Error('Unapproved Socket.IO origin accepted'));});});pass('Socket.IO browser origin allowlist');
  const hinted=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Sync hint missing')),5000);socket.once('sync_hint',()=>{clearTimeout(timer);resolve();});});
  const date=new Date(Date.now()+14*86400000).toISOString();
  const createdBooking=await request('/bookings',home.token,'POST',{helper_id:helper,booking_date:date,address:'Test',service_description:'Sync test',total_price:200},201);
  await hinted;await mobile.check();assert(changedMobile.includes('bookings'));
  assert.equal((await request('/sync',third.token)).bookings,unrelated.bookings);pass('Web mutation to worker sync; private revision isolation; authenticated hints');
  socket.disconnect(); changedWeb.length=0;
  await request(`/bookings/${createdBooking.id}`,worker.token,'PUT',{status:'confirmed'});
  await request('/messages',worker.token,'POST',{recipient_id:home.user.id,content:'Offline recovery'},201);
  await web.check();assert(changedWeb.includes('bookings')&&changedWeb.includes('messages'));pass('Android mutation to web; missed updates recovered without socket');
  const revisions=await request('/sync',home.token);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlWQAAAAASUVORK5CYII=','base64');
  const form=new FormData();for(const [key,value]of Object.entries({category_id:category,title:'Photo restart',description:'Persistent',budget:200,preferred_date:date,location:'Test'}))form.append(key,String(value));form.append('photos',new Blob([png],{type:'image/png'}),'photo.png');
  const photoJob=await request('/jobs',home.token,'POST',form,201), key=JSON.parse(photoJob.photos)[0];
  assert(Buffer.from(await (await fetch(base.replace('/api','')+key)).arrayBuffer()).equals(png));
  await stopApi();await startApi(env);
  assert.equal((await request(`/jobs/${photoJob.id}`,home.token)).photos,photoJob.photos);
  assert(Buffer.from(await (await fetch(base.replace('/api','')+key)).arrayBuffer()).equals(png));
  assert.notEqual((await request('/sync',home.token)).jobs,revisions.jobs); pass('API restart preserves media, revisions and database records');
  await db.query("SELECT enqueue_notification($1,'fixture:durable','test','Durable','{}')",[ids[0]]); await stopApi();await startApi(env); assert((await request('/notifications',home.token)).some(row=>row.title==='Durable' && row.type==='test'));pass('Notification job survives process restart');
  const mediaKey=randomUUID()+'.png',calls=[];
  const remote=createStorage({STORAGE_PROVIDER:'supabase',SUPABASE_URL:'https://storage.fixture.test',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',SUPABASE_STORAGE_BUCKET:'private'},async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('/bucket/')?{public:false}:url.includes('/list/')?[{name:mediaKey}]:url.includes('/sign/')?{signedURL:`/object/sign/private/${mediaKey}?token=fixture`}:{},arrayBuffer:async()=>png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength)};});
  const createdAt=new Date();await remote.check();await remote.put(mediaKey,png,'image/png');const decorated=await decorateMedia({created_at:createdAt,photos:JSON.stringify([`/uploads/${mediaKey}`]),avatar_url:`/uploads/${mediaKey}`},remote);await remote.remove(mediaKey);assert.equal(decorated.created_at,createdAt);
  assert(JSON.parse(decorated.photos)[0].startsWith('https://'));assert.equal(calls.filter(c=>c.url.includes('/sign/')).length,1);assert.equal(calls.find(c=>c.options.method==='POST'&&c.options.body===png).options.headers['x-upsert'],'false');assert.deepEqual(await remote.list(),[mediaKey]);assert((await remote.read(mediaKey)).equals(png));
  await assert.rejects(remote.put('../escape',png,'image/png'));pass('Supabase private storage HTTP contract (mock provider, not live)');
  const failing=createStorage({STORAGE_PROVIDER:'supabase',SUPABASE_URL:'https://storage.fixture.test',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',SUPABASE_STORAGE_BUCKET:'private'},async()=>({ok:false,status:503}));await assert.rejects(failing.put(mediaKey,png,'image/png'),e=>e.status===503);pass('Storage failure surfaced, no fake success');
  let attempts=0, changes=0;
  const retry=createSynchronizer(async()=>{if(attempts++===0)throw new Error('offline');return {jobs:'1'};},()=>changes++);
  await retry.check();assert.equal(changes,0);await retry.check();assert.equal(changes,1);await retry.check();assert.equal(changes,1);await retry.check(true);assert.equal(changes,2);retry.stop();await retry.check();assert.equal(changes,2);pass('Sync retries offline reads, deduplicates revisions, forces foreground refresh');
  const device=randomUUID();await request('/notifications/devices',worker.token,'POST',{device_id:device,token:`ExpoPushToken[fixture_${Date.now()}]`,platform:'android'},201);
  await db.query("SELECT enqueue_notification($1,'fixture:worker','test','Worker durable job','{}')",[ids[1]]);
  const launchWorker=async()=>{
    const child=spawn(process.execPath,['worker.js'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stderr.resume();
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker start timeout')),5000);child.stdout.on('data',value=>{if(String(value).includes('worker started')){clearTimeout(timer);resolve();}});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Worker exited '+code));});});
    return child;
  };
  const waitForJob=async()=>{for(let i=0;i<30;i++){const rows=await db.query("SELECT p.id,p.status FROM push_deliveries p JOIN notifications n ON n.id=p.notification_id WHERE n.event_key='fixture:worker'");if(rows.rows.length)return rows.rows;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Durable worker job missing');};
  let background=await launchWorker();const queued=await waitForJob();assert.equal(queued[0].status,'pending');await new Promise(resolve=>{background.once('exit',resolve);background.kill();});
  background=await launchWorker();const recovered=await waitForJob();assert.deepEqual(recovered,queued);await new Promise(resolve=>{background.once('exit',resolve);background.kill();});pass('Dedicated worker process restart preserves and deduplicates pending push jobs (delivery disabled)');
  web.stop();mobile.stop();
  await fs.mkdir(path.join(root,'../docs/test-results'),{recursive:true});await fs.writeFile(path.join(root,'../docs/test-results/free-stack.json'),JSON.stringify({executed_at:new Date().toISOString(),database:'isolated local replica of Supabase schema; synthetic records only',results,live_storage_push_device:'NOT RUN in this isolated suite; physical push delivery requires a device'},null,2)+'\n');
}
main().catch(error=>{console.error('Free-stack test failed:',error.message);process.exitCode=1;}).finally(async()=>{
  sockets.forEach(socket=>socket.disconnect()); await stopApi(); if(db)await db.end();
  if(created && /^helpearly_free_test_\d+$/.test(database)) {await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);await admin.query(`DROP DATABASE "${database}"`);}
  if(roleCreated)await admin.query(`DROP ROLE "${testRole}"`);
  if(directory && path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'helpearly-free-'))await fs.rm(directory,{recursive:true,force:true});
  await admin.end();
});
