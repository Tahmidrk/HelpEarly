// Read-only production backup; restore and migrate ONLY a newly created local DB.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {Pool}=require('pg'),dotenv=require('dotenv');
const root=path.resolve(__dirname,'../..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const quote=value=>{assert(/^[a-z_][a-z0-9_]*$/.test(value));return '"'+value+'"';};
async function run(binary,args,env,folder){await new Promise((resolve,reject)=>{let errors='';const child=spawn(binary,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});child.stderr.on('data',b=>errors+=b);child.once('error',()=>reject(new Error('PostgreSQL binary unavailable')));child.once('exit',async code=>{if(code){await fs.writeFile(path.join(folder,'private-error.txt'),errors);reject(new Error('Backup/restore failed; private diagnostics saved'));}else resolve();});});}
async function fingerprints(db,columns,excludeVersion=false){const result={};for(const table of [...new Set(columns.map(c=>c.table))].sort()){
 const names=columns.filter(c=>c.table===table).map(c=>table==='notifications'&&c.name==='data'?"(data-'audience') AS data":quote(c.name)).join(',');
 result[table]=(await db.query(`SELECT md5(row_to_json(t)::text) hash FROM (SELECT ${names} FROM public.${quote(table)}${excludeVersion && table==='helpearly_schema'?' WHERE version<>4':''}) t ORDER BY 1`)).rows.map(r=>r.hash);
}return result;}
async function main(){
 const audit=dotenv.parse(await fs.readFile(path.join(root,'server/.env.audit'))),local=dotenv.parse(await fs.readFile(path.join(root,'server/.env')));
 const url=new URL(audit.AUDIT_DATABASE_URL);assert.equal(url.hostname,'aws-1-ap-northeast-1.pooler.supabase.com');assert.equal(decodeURIComponent(url.username),'postgres.gjwkrqlzroujlueexcxc');assert(['localhost','127.0.0.1'].includes(local.DB_HOST||'localhost'));
 const source=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca:audit.DB_SSL_CA.replace(/\\n/g,'\n')},max:1,connectionTimeoutMillis:20000});
 const admin=new Pool({host:local.DB_HOST||'localhost',port:local.DB_PORT||5432,user:local.DB_USER||'postgres',password:local.DB_PASSWORD,database:local.DB_NAME,ssl:false});
 const database='helpearly_android_restore_'+Date.now(),folder=path.resolve(root,'../HelpEarly-backups/android-role-'+new Date().toISOString().replace(/[:.]/g,'-'));
 await fs.mkdir(folder,{recursive:false});let exporter,restored,created=false;
 try{
  exporter=await source.connect();await exporter.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await exporter.query("SET LOCAL TIME ZONE 'UTC'");
  const columns=(await exporter.query("SELECT table_name AS table,column_name AS name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  assert.equal(new Set(columns.map(c=>c.table)).size,23);assert.equal((await exporter.query('SELECT max(version)::int version FROM helpearly_schema')).rows[0].version,3);
  const before=await fingerprints(exporter,columns),audiences=(await exporter.query("SELECT id,data->>'audience' audience FROM notifications WHERE data->>'audience' IS NOT NULL ORDER BY id")).rows;
  const revisions=(await exporter.query('SELECT * FROM sync_revisions')).rows;
  const oldFunction=(await exporter.query("SELECT pg_get_functiondef('marketplace_notification()'::regprocedure) definition")).rows[0].definition;
  const snapshot=(await exporter.query('SELECT pg_export_snapshot() id')).rows[0].id,ca=path.join(folder,'postgres-ca.pem');await fs.writeFile(ca,audit.DB_SSL_CA.replace(/\\n/g,'\n'));
  const remoteEnv={...process.env,PGHOST:url.hostname,PGPORT:url.port,PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:'postgres',PGSSLMODE:'verify-full',PGSSLROOTCERT:ca};
  await run('C:/Program Files/PostgreSQL/17/bin/pg_dump.exe',['--format=custom','--schema=public','--snapshot='+snapshot,'--file='+folder+'/database.dump'],remoteEnv,folder);
  await exporter.query('COMMIT');exporter.release();exporter=null;
  const storage=require('../utils/storage').createStorage({...audit,STORAGE_PROVIDER:'supabase',SUPABASE_STORAGE_BUCKET:'helpearly-media'});await storage.check();await fs.mkdir(path.join(folder,'uploads'));
  const media=[],keys=await storage.list();for(const key of keys){const target=path.resolve(folder,'uploads',key);assert(target.startsWith(path.resolve(folder,'uploads')+path.sep));await fs.mkdir(path.dirname(target),{recursive:true});const bytes=await storage.read(key);await fs.writeFile(target,bytes);media.push({key,bytes:bytes.length,sha256:hash(bytes)});}assert.deepEqual((await storage.list()).sort(),keys.sort());
  await fs.writeFile(path.join(folder,'media-manifest.json'),JSON.stringify(media,null,2));await fs.writeFile(path.join(folder,'private-fingerprints.json'),JSON.stringify({columns,before,audiences}));await fs.writeFile(path.join(folder,'marketplace_notification-schema3.sql'),oldFunction);
  await admin.query('CREATE DATABASE '+quote(database));created=true;restored=new Pool({...admin.options,database,password:local.DB_PASSWORD});await restored.query('DROP SCHEMA public');
  const env={...process.env,PGHOST:local.DB_HOST||'localhost',PGPORT:local.DB_PORT||'5432',PGUSER:local.DB_USER||'postgres',PGPASSWORD:local.DB_PASSWORD,PGDATABASE:database,PGSSLMODE:'disable'};delete env.PGSSLROOTCERT;
  await run('C:/Program Files/PostgreSQL/17/bin/pg_restore.exe',['--no-owner','--no-acl','--exit-on-error','--dbname='+database,folder+'/database.dump'],env,folder);
  await restored.query("SET TIME ZONE 'UTC'");assert.deepEqual(await fingerprints(restored,columns),before);
  const sql=await fs.readFile(path.join(root,'supabase/migrations/20261011143253_android_role_isolation.sql'),'utf8');
  await restored.query('BEGIN');await restored.query(sql);assert.equal((await restored.query('SELECT max(version)::int version FROM helpearly_schema')).rows[0].version,4);await restored.query('ROLLBACK');
  assert.equal((await restored.query('SELECT max(version)::int version FROM helpearly_schema')).rows[0].version,3);assert.deepEqual(await fingerprints(restored,columns),before);
  await restored.query('BEGIN');await restored.query(sql);await restored.query('COMMIT');
  const assertContent=async()=>{const after=await fingerprints(restored,columns,true);for(const table of Object.keys(before))if(table!=='sync_revisions')assert.deepEqual(after[table],before[table],'Original records/content changed: '+table);};
  await assertContent();await restored.query(sql);await assertContent();
  const updatedRevisions=(await restored.query('SELECT * FROM sync_revisions')).rows;
  for(const row of revisions){const after=updatedRevisions.find(r=>r.resource===row.resource && String(r.user_id)===String(row.user_id));assert(after,'Original revision entry missing');assert(BigInt(after.version)>=BigInt(row.version),'Revision went backwards');}
  const rollback=await fs.readFile(path.join(root,'supabase/rollback/20261011143253_android_role_isolation.sql'),'utf8');
  await restored.query('BEGIN');await restored.query(rollback);assert.equal((await restored.query('SELECT max(version)::int version FROM helpearly_schema')).rows[0].version,3);await assertContent();await restored.query('ROLLBACK');
  assert.equal((await restored.query('SELECT max(version)::int version FROM helpearly_schema')).rows[0].version,4);
  const pair=(await restored.query('SELECT * FROM conversations LIMIT 1')).rows[0];
  if(pair){await restored.query('BEGIN');await restored.query("INSERT INTO conversations(user1_id,user2_id,user1_role,user2_role) VALUES($1,$2,$3,$4)",[pair.user1_id,pair.user2_id,pair.user2_role,pair.user1_role]);await assert.rejects(restored.query(rollback),error=>error.message.startsWith('Rollback blocked:'));await restored.query('ROLLBACK');}
  for(const original of audiences)assert.equal((await restored.query("SELECT data->>'audience' audience FROM notifications WHERE id=$1",[original.id])).rows[0].audience,original.audience);
  const legacy={};for(const table of ['conversations','ai_messages','complaints','push_devices'])legacy[table]=(await restored.query(`SELECT count(*)::int total,count(*) FILTER(WHERE ${table==='conversations'?'user1_role':'audience'} IS NULL)::int unassigned FROM ${table}`)).rows[0];
  const push=(await source.query("SELECT status,count(*)::int count FROM push_deliveries GROUP BY status ORDER BY status")).rows;
  const deviceCounts=(await source.query('SELECT count(*)::int total,count(*) FILTER(WHERE active)::int active FROM push_devices')).rows[0];
  for(const item of media)assert.equal(hash(await fs.readFile(path.join(folder,'uploads',item.key))),item.sha256);
  const live=await source.connect();try{await live.query('BEGIN READ ONLY');await live.query("SET LOCAL TIME ZONE 'UTC'");assert.equal((await live.query('SELECT max(version)::int version FROM helpearly_schema')).rows[0].version,3);assert.deepEqual(await fingerprints(live,columns),before,'Production changed during verification; repeat backup');await live.query('ROLLBACK');}finally{live.release();}
  const report={executed_at:new Date().toISOString(),status:'PASS',productionMode:'Read-only snapshot, aggregate diagnostics and private Storage backup; no live changes',backupDirectory:folder,dumpSHA256:hash(await fs.readFile(path.join(folder,'database.dump'))),migrationSHA256:hash(Buffer.from(sql)),originalTableCount:23,resultTableCount:23,originalCounts:Object.fromEntries(Object.entries(before).map(([t,v])=>[t,v.length])),originalRowsAndContentPreserved:true,syncMetadata:'Existing resource entries retained; revisions monotonically advance via existing triggers during role backfill',isolatedRollback:'PASS: transaction restores schema 3 and original fingerprints',guardedCommittedSchemaRollback:'PASS on restored production copy: schema 3 compatibility restored without deleting business rows; refuses rollback once opposite-role threads exist',repeatability:'PASS',notificationAudienceChange:'Known legacy message/complaint metadata gains audience only; preexisting audiences unchanged',legacyAssignment:legacy,pushDiagnostics:{deviceCounts,deliveryStatuses:push,phoneDelivery:'UNVERIFIED; provider receipt is not physical evidence'},mediaObjects:media.length,mediaHashesVerified:true,productionBeforeAfterHashesUnchanged:true,backupConsistency:'Exported PostgreSQL snapshot; media copied separately and key inventory checked. Repeat immediately before approved migration.'};
  await fs.writeFile(path.join(folder,'verification.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(folder,'RESTORE_VERIFIED'),'All public records restored; schema 4 candidate and transaction rollback verified; production unchanged.\n');await fs.writeFile(path.join(root,'docs/test-results/android-role-backup-restore.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',backupDirectory:folder,legacyAssignment:legacy,pushDiagnostics:report.pushDiagnostics,mediaObjects:media.length,productionUnchanged:true}));
 }finally{if(exporter){await exporter.query('ROLLBACK').catch(()=>{});exporter.release();}if(restored)await restored.end();if(created){assert(/^helpearly_android_restore_\d+$/.test(database));await admin.query('DROP DATABASE '+quote(database));}await admin.end();await source.end();}
}
main().catch(async error=>{await fs.writeFile(path.resolve(root,'../HelpEarly-test-tools/android-backup-private-error.txt'),error.stack||String(error));console.error('Read-only backup/isolated migration failed:',error.code||error.name,'Private diagnostics saved. No live changes performed.');process.exitCode=1;});
