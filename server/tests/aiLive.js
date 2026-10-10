const assert=require('node:assert/strict');
const pool=require('../config/db');
const base=process.env.TEST_API_URL || 'http://localhost:5000/api';
const email=`ai-live-${Date.now()}@example.test`;
async function request(endpoint,token,body){const response=await fetch(base+endpoint,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();assert(response.ok,`AI live ${response.status}: ${data.message}`);return data;}
async function main(){
  if(!process.env.GEMINI_API_KEY){console.log('BLOCKED: GEMINI_API_KEY missing');return;}
  const auth=await request('/auth/register',null,{name:'AI live probe',email,password:'testpass123',role:'household',nid_number:`ai-${Date.now()}`});
  const before=(await pool.query('SELECT COUNT(*)::int AS count FROM bookings')).rows[0].count;
  const reply=await request('/chatbot',auth.token,{message:'Name available Electrical workers from the current database if any. Explain how I offer a fee for a booking. Do not create or change anything.'});assert(reply.reply?.length>30);
  const history=await request('/chatbot',auth.token);assert.equal(history.length,2);assert.equal(history[0].role,'user');assert.equal(history[1].role,'model');assert.equal(history[1].content,reply.reply);
  const after=(await pool.query('SELECT COUNT(*)::int AS count FROM bookings')).rows[0].count;assert.equal(after,before);
  console.log('PASS: real Gemini response, user-owned two-message history, booking count unchanged. Answer quality still needs human review.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{await pool.query('DELETE FROM users WHERE email=$1',[email]);await pool.end();});
