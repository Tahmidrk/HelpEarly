const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),{Pool}=require(root+'/server/node_modules/pg'),dotenv=require(root+'/server/node_modules/dotenv');
const privateRoot=process.env.ADMIN_FIXTURE_DIR;assert(privateRoot && path.isAbsolute(privateRoot),'Set ADMIN_FIXTURE_DIR to a private test-tools directory');const stop=path.join(privateRoot,'stop-admin-browser-fixture');
async function main(){
 const local=dotenv.parse(await fs.readFile(root+'/server/.env'));assert(['localhost','127.0.0.1'].includes(local.DB_HOST||'localhost'));
 const admin=new Pool({host:local.DB_HOST||'localhost',port:local.DB_PORT||5432,user:local.DB_USER||'postgres',password:local.DB_PASSWORD,database:local.DB_NAME});
 const database='helpearly_admin_ui_test_'+Date.now();await admin.query('CREATE DATABASE "'+database+'"');
 const env={...process.env,...local,DATABASE_URL:'',DB_NAME:database,NODE_ENV:'test',PORT:'5074',JWT_SECRET:crypto.randomUUID()+crypto.randomUUID(),STORAGE_PROVIDER:'local',UPLOAD_DIR:privateRoot+'/admin-ui-uploads',PUSH_ENABLED:'false',GEMINI_API_KEY:'',RUN_BACKGROUND_WORKER:'false',CLIENT_URL:'http://localhost:5174'};
 const run=(cmd,args,cwd)=>spawn(cmd,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let api,web,db;
 try{
 const migrate=run(process.execPath,['db/migrate.js','--approved'],root+'/server');migrate.stdout.resume();migrate.stderr.resume();await new Promise((ok,no)=>migrate.once('exit',c=>c===0?ok():no(new Error('Local fixture migration failed'))));
 db=new Pool({...admin.options,database,password:local.DB_PASSWORD});
 const hash=await require(root+'/server/node_modules/bcryptjs').hash('local-admin-fixture',10);
 const users=(await db.query("INSERT INTO users(name,email,password_hash,role) VALUES('Local UI Admin','admin@ui.test',$1,'admin'),('Local UI Household','household@ui.test',$1,'household'),('Local UI Worker','worker@ui.test',$1,'helper') RETURNING id",[hash])).rows;
 const helper=(await db.query('INSERT INTO helpers(user_id,bio) VALUES($1,$2) RETURNING id',[users[2].id,'Profile for isolated UI verification'])).rows[0].id;
 const category=(await db.query("SELECT id FROM categories WHERE name='Electrical'")).rows[0].id;
 await db.query('INSERT INTO helper_categories(helper_id,category_id) VALUES($1,$2)',[helper,category]);await db.query("INSERT INTO helper_services(helper_id,category_id,service_name,price) VALUES($1,$2,'UI wiring',200)",[helper,category]);
 const booking=(await db.query("INSERT INTO bookings(user_id,helper_id,booking_date,status,service_description,total_price) VALUES($1,$2,CURRENT_TIMESTAMP+INTERVAL '10 days','completed','UI test booking',200) RETURNING id",[users[1].id,helper])).rows[0].id;
 await db.query('INSERT INTO reviews(user_id,helper_id,booking_id,rating,comment) VALUES($1,$2,$3,4,$4)',[users[1].id,helper,booking,'UI review']);
 await db.query("INSERT INTO jobs(user_id,category_id,title,description,budget,preferred_date) VALUES($1,$2,'UI test job','UI description',200,CURRENT_TIMESTAMP+INTERVAL '20 days')",[users[1].id,category]);
 await db.query("INSERT INTO complaints(complainant_id,accused_id,subject,description) VALUES($1,$2,'UI complaint','Synthetic case only')",[users[1].id,users[2].id]);
 await db.query("INSERT INTO emergency_requests(household_id,category_id,description,location,contact_phone) VALUES($1,$2,'UI emergency','Fixture location','fixture')",[users[1].id,category]);
 api=run(process.execPath,['server.js'],root+'/server');api.stdout.resume();api.stderr.resume();
 let ready=false;for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5074/api/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready&&api.exitCode===null,'Disposable API failed readiness');
 env.VITE_API_URL='http://127.0.0.1:5074';web=run(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],root+'/client');web.stdout.resume();web.stderr.resume();
 console.log('Isolated admin browser fixture ready: http://localhost:5174/login; production untouched.');
 await new Promise(resolve=>{const timer=setInterval(async()=>{if(await fs.stat(stop).catch(()=>null)){clearInterval(timer);resolve();}},1000);});
 }finally{
 for(const child of [web,api])if(child&&child.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});if(db)await db.end();assert(/^helpearly_admin_ui_test_\d+$/.test(database));await admin.query('DROP DATABASE "'+database+'"');await admin.end();await fs.unlink(stop).catch(()=>{});console.log('Isolated UI fixture stopped and database removed.');
 }
}
main().catch(e=>{console.error('UI fixture failed:',e.code||e.name);process.exitCode=1;});
