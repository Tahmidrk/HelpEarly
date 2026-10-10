const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const pool=require('../config/db');
const stateFile=path.join(__dirname,'..','.test-persistence.json'),base=process.env.TEST_API_URL || 'http://localhost:5000/api';
const password='testpass123';
async function api(endpoint,options={}) {const response=await fetch(base+endpoint,options);assert(response.ok,`${endpoint}: ${response.status}`);return response.json();}
async function main(){
  if(process.argv[2]==='create') {
    try{await fs.access(stateFile);throw new Error('Existing test probe state; verify it before creating another');}catch(error){if(error.code!=='ENOENT')throw error;}
    const stamp=Date.now(),email=`persistence-${stamp}@example.test`;
    const auth=await api('/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Persistence probe',email,password,role:'household',nid_number:`probe-${stamp}`,location:'Dhaka'})});
    const categories=await api('/categories'),form=new FormData();
    const fields={category_id:categories.find(c=>c.name==='Electrical').id,title:'Restart probe',description:'Test-owned photo persistence',budget:1000,preferred_date:new Date(Date.now()+86400000).toISOString(),location:'Dhaka'};
    for(const [key,value] of Object.entries(fields))form.append(key,String(value));
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    form.append('photos',new Blob([bytes],{type:'image/png'}),'probe.png');
    const job=await api('/jobs',{method:'POST',headers:{Authorization:`Bearer ${auth.token}`},body:form});
    const photo=JSON.parse(job.photos)[0];await fs.writeFile(stateFile,JSON.stringify({email,userId:auth.user.id,jobId:job.id,photo,base64:bytes.toString('base64')}));
    console.log('Probe created. Restart server, then run verify. No credentials stored in probe file.');
  } else if(process.argv[2]==='verify') {
    const state=JSON.parse(await fs.readFile(stateFile,'utf8'));
    const auth=await api('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:state.email,password})});assert.equal(auth.user.id,state.userId);
    const job=await api(`/jobs/${state.jobId}`,{headers:{Authorization:`Bearer ${auth.token}`}});assert.equal(JSON.parse(job.photos)[0],state.photo);
    const response=await fetch(base.replace(/\/api$/,'')+state.photo);assert.equal(response.status,200);assert.equal(Buffer.from(await response.arrayBuffer()).toString('base64'),state.base64);
    await pool.query('DELETE FROM users WHERE id=$1 AND email=$2',[state.userId,state.email]);
    await fs.unlink(path.join(process.env.UPLOAD_DIR || path.join(__dirname,'..','uploads'),path.basename(state.photo)));await fs.unlink(stateFile);
    console.log('PASS: fresh login, database record and identical photo bytes survived server restart. Test-owned records cleaned.');
  } else throw new Error('Usage: node tests/persistenceProbe.js create|verify');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
