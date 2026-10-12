const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const esbuild=require('../../client/node_modules/esbuild'),jwt=require('jsonwebtoken');
const root=path.resolve(__dirname,'../..'),results={};
async function main(){
 const bundled=await esbuild.build({entryPoints:[path.join(root,'client/src/utils/api.js')],bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env.VITE_API_URL':'"http://fixture.test"','import.meta.env.VITE_SOCKET_URL':'"http://fixture.test"'}});
 const storage=new Map([['token','synthetic-token'],['activeRole','household']]);
 let fetches=0,resolveFetch,lastOptions;
 const fetch=async(url,options)=>{fetches++;lastOptions=options;return new Promise(resolve=>{resolveFetch=resolve;});};
 const module={exports:{}};
 new Function('module','exports','localStorage','fetch','FormData',bundled.outputFiles[0].text)(module,module.exports,{getItem:key=>storage.get(key)},fetch,FormData);
 const api=module.exports;
 const first=api.request('/helpers',{timeoutMs:1000,headers:{'X-Test':'yes'}}),second=api.request('/helpers',{timeoutMs:1000});
 assert.equal(first,second);assert.equal(fetches,1);assert.equal(lastOptions.headers.Authorization,'Bearer synthetic-token');assert.equal(lastOptions.headers['X-Test'],'yes');
 resolveFetch({ok:true,json:async()=>({helpers:[]})});await first;results.readDeduplicationAndHeaders='PASS';
 const start=performance.now();await assert.rejects(api.request('/hung',{timeoutMs:40}),error=>error.code==='TIMEOUT');
 assert(performance.now()-start<300);assert(lastOptions.signal.aborted);results.hungTransportDeadline='PASS: timeout settles even when transport ignores abort';
 const stale=api.request('/slow',{timeoutMs:1000}),checked=assert.rejects(stale,error=>error.name==='AbortError');api.cancelRequests();await checked;
 resolveFetch({ok:true,json:async()=>({stale:true})});results.sessionChangeCancellation='PASS';
 const aborted=new AbortController();aborted.abort();await assert.rejects(api.request('/pre-aborted',{signal:aborted.signal}),error=>error.name==='AbortError');results.callerCancellation='PASS';
 process.env.JWT_SECRET='synthetic-concurrency-unit-secret';
 const limit=require('../middleware/rateLimit')('api',2,60000);
 const tokenA=jwt.sign({id:1},process.env.JWT_SECRET,{jwtid:'A'}),tokenB=jwt.sign({id:1},process.env.JWT_SECRET,{jwtid:'B'});
 function request(token){let status=200;const res={set:()=>{},status:n=>{status=n;return res;},json:()=>{}};limit({ip:'same-fixture-ip',headers:{authorization:'Bearer '+token}},res,()=>{});return status;}
 assert.equal(request(tokenA),200);assert.equal(request(tokenA),200);assert.equal(request(tokenA),429);assert.equal(request(tokenB),200);
 const forged=jwt.sign({id:1},'wrong-secret');assert.equal(request(forged),200);assert.equal(request(forged+'changed'),200);assert.equal(request('invalid'),429);
 results.verifiedSessionRateIsolation='PASS: same-account JWT sessions independent; forged tokens share IP budget';
 // Simulate a checkout rejection through actual controller entry points, not successful transport.
 const configPath=require.resolve('../config/db');const original=require.cache[configPath];
 require.cache[configPath]={id:configPath,filename:configPath,loaded:true,exports:{connect:async()=>{throw Error('Pool unavailable');}}};
 for(const [file,body]of [['../controllers/authController',{name:'Queue fixture',email:'queue@fixture.test',password:'fixture-123',nid_number:'synthetic',role:'household'}],['../controllers/workerSettings',{category:'Electrical',services:[],hourly_rate:200,experience_years:1}]]){
  delete require.cache[require.resolve(file)];const controller=require(file);let status;
  const res={status:n=>{status=n;return res;},json:()=>{}};await (controller.register||controller)({body,user:{id:1}},res);assert.equal(status,500);
 }
 if(original)require.cache[configPath]=original;else delete require.cache[configPath];results.checkoutFailureReturnsResponse='PASS';
 fs.writeFileSync(path.join(root,'docs/test-results/concurrency-guards.json'),JSON.stringify({executed_at:new Date().toISOString(),results,scope:'Actual Web API module, JWT limiter and controllers; controlled transport/pool failures. Independent native integration measured separately.'},null,2)+'\n');
 console.log(JSON.stringify(results));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
