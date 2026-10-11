require('dotenv').config();
const fs=require('node:fs'),path=require('node:path'),pool=require('../config/db');
async function main(){
  if(!process.argv.includes('--approved'))throw new Error('No changes made. Fresh verified backup/restore and explicit production approval are required; use --approved only after review.');
  const db=await pool.connect();
  try{
    await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(724031)');
    if(!(await db.query('SELECT version FROM helpearly_schema WHERE version=2')).rows.length)throw new Error('Existing schema version 2 required');
    await db.query(fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261011073853_centralized_web_admin.sql'),'utf8'));
    await db.query('COMMIT');console.log('Central admin schema version 3 applied');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;}).finally(()=>pool.end());
