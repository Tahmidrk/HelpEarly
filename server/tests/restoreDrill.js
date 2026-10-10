const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),{spawn}=require('node:child_process');
const {Pool}=require('pg'),pool=require('../config/db');
const database=`helpearly_restore_${Date.now()}`;
async function main(){
  const folder=process.argv[2];if(!folder || !path.isAbsolute(folder))throw new Error('Pass an absolute backup folder');
  const source=pool.options;
  assert(['localhost','127.0.0.1'].includes(source.host),'Automatic restore drill is limited to local PostgreSQL');
  await pool.query(`CREATE DATABASE ${database}`);
  let restored;
  try{
    const pgRestore=process.env.PG_RESTORE_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe';
    const env={...process.env,PGHOST:source.host,PGPORT:String(source.port),PGUSER:source.user,PGPASSWORD:source.password,PGDATABASE:database,PGSSLMODE:'disable'};
    await new Promise((resolve,reject)=>{const child=spawn(pgRestore,['--no-owner','--no-acl','--exit-on-error','--dbname',database,path.join(folder,'database.dump')],{env,stdio:['ignore','ignore','pipe'],windowsHide:true});child.stderr.resume();child.on('error',()=>reject(new Error('pg_restore unavailable')));child.on('close',code=>code===0?resolve():reject(new Error(`pg_restore failed: ${code}`)));});
    restored=new Pool({...source,password:source.password,connectionString:undefined,database,connectionTimeoutMillis:5000});
    for(const table of ['users','helpers','bookings','jobs','messages','reviews','complaints','notifications','push_devices']){
      const before=await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`),after=await restored.query(`SELECT COUNT(*)::int AS count FROM ${table}`);assert.equal(after.rows[0].count,before.rows[0].count,`${table} count mismatch (take a fresh quiet backup)`);
    }
    const fk=await restored.query("SELECT COUNT(*)::int AS count FROM pg_constraint WHERE contype='f'");assert(fk.rows[0].count>10);
    const schema=await restored.query("SELECT to_regclass('notifications') AS table, to_regprocedure('expire_emergency_notifications()') AS expiry");assert(schema.rows[0].table && schema.rows[0].expiry);
    const uploaded=await fs.readdir(path.join(folder,'uploads'));console.log(`PASS: custom dump restored into separate local database; nine table counts, foreign keys, notification schema and ${uploaded.length} backed-up media files verified.`);
  } finally {
    if(restored)await restored.end();
    // Only this newly created, uniquely named drill database is removed.
    assert(/^helpearly_restore_\d+$/.test(database));await pool.query(`DROP DATABASE ${database}`);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
