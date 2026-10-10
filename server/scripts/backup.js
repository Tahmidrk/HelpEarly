const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
async function main(){
  const destination=process.argv[2];if(!destination)throw new Error('Usage: node scripts/backup.js ABSOLUTE_PRIVATE_BACKUP_DIRECTORY');
  if(!path.isAbsolute(destination))throw new Error('Use an absolute directory outside the repository');
  const root=path.resolve(__dirname,'../..'),target=path.resolve(destination);
  if(target===root || target.startsWith(root+path.sep))throw new Error('Backup directory must be outside the repository');
  const folder=path.join(target,`helpearly-${new Date().toISOString().replace(/[:.]/g,'-')}`);await fs.mkdir(folder,{recursive:true});
  const url=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null,host=url?.hostname || process.env.DB_HOST || 'localhost';
  const local=['localhost','127.0.0.1','db'].includes(host);
  const env={...process.env,PGHOST:host,PGPORT:url?.port || process.env.DB_PORT || '5432',PGUSER:url?decodeURIComponent(url.username):process.env.DB_USER || 'postgres',PGPASSWORD:url?decodeURIComponent(url.password):process.env.DB_PASSWORD || '',PGDATABASE:url?decodeURIComponent(url.pathname.slice(1)):process.env.DB_NAME || 'at_your_service',PGSSLMODE:process.env.DB_SSL==='false' || local?'disable':process.env.DB_SSL_ALLOW_SELF_SIGNED==='true'?'require':'verify-full'};
  if(process.env.DB_SSL_CA){const ca=path.join(folder,'postgres-ca.pem');await fs.writeFile(ca,process.env.DB_SSL_CA.replace(/\\n/g,'\n'),{mode:0o600});env.PGSSLROOTCERT=ca;}
  const defaultWindows='C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe';
  const executable=process.env.PG_DUMP_BIN || (process.platform==='win32'?defaultWindows:'pg_dump');
  await new Promise((resolve,reject)=>{
    const process=spawn(executable,['--format=custom','--file',path.join(folder,'database.dump')],{env,stdio:['ignore','ignore','pipe'],windowsHide:true});
    process.on('error',()=>reject(new Error('pg_dump unavailable; set PG_DUMP_BIN')));process.on('close',code=>code===0?resolve():reject(new Error(`pg_dump failed (${code}); check credentials, TLS and version privately`)));
    process.stderr.resume();
  });
  const media=process.env.UPLOAD_DIR || path.join(__dirname,'..','uploads');await fs.cp(media,path.join(folder,'uploads'),{recursive:true});
  await fs.writeFile(path.join(folder,'README.txt'),'PostgreSQL custom-format dump plus uploaded media. Keep private and encrypt offsite. Take backups while writes are stopped for cross-store consistency. Restore into a separate database first; see docs/DEPLOYMENT.md.\n');
  console.log(`Backup saved: ${folder}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
