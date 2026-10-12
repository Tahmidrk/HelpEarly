const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),esbuild=require('../../client/node_modules/esbuild');
const modules=process.env.ANDROID_TEST_MODULES||path.resolve(root,'../HelpEarly-test-tools/node_modules');
const React=require(path.join(modules,'react')),renderer=require(path.join(modules,'react-test-renderer'));
const {act}=renderer,storage=new Map(),results={};global.IS_REACT_ACT_ENVIRONMENT=true;
let current,commits=0,reads=0,rows=[{id:1,status:'pending',booking_date:'2027-02-12T12:30:00Z',service_description:'Wiring',total_price:200,address:'Fixture',photo_urls:['fixture.jpg']}];
const user={id:1,role:'both',name:'Fixture'},worker={id:3,role:'helper',name:'Worker'};
const stubs={
 '@react-native-async-storage/async-storage':{getItem:async k=>storage.get(k)||null,setItem:async(k,v)=>storage.set(k,v),removeItem:async k=>storage.delete(k),multiSet:async pairs=>pairs.forEach(([k,v])=>storage.set(k,v)),multiRemove:async keys=>keys.forEach(k=>storage.delete(k))},
 '../api/client':{authAPI:{login:async email=>({token:'synthetic-'+email.email,user:email.email==='worker'?worker:user})},bookingsAPI:{getMyBookings:async()=>{reads++;return rows;}},helpersAPI:{},notificationsAPI:{},setApiSession:()=>{}},
 '../components/Feedback':{Alert:{alert:()=>{}}},
};
async function bundle(file,boundaries=false){const build=await esbuild.build({entryPoints:[path.join(root,file)],bundle:true,write:false,platform:'node',format:'cjs',loader:{'.js':'jsx'},external:['react'],plugins:boundaries?[{name:'test-boundaries',setup(build){build.onResolve({filter:/.*/},args=>stubs[args.path]?{path:args.path,namespace:'boundary'}:undefined);build.onLoad({filter:/.*/,namespace:'boundary'},args=>({contents:`module.exports=globalThis.__sessionStubs[${JSON.stringify(args.path)}]`,loader:'js'}));}}]:[]});const module={exports:{}};global.__sessionStubs=stubs;new Function('require','module','exports',build.outputFiles[0].text)(name=>name==='react'?React:require(name),module,module.exports);return module.exports;}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
async function main(){
 const {AuthProvider,useAuth}=await bundle('mobile/src/context/AuthContext.js',true);
 function Consumer(){current=useAuth();commits++;return null;}
 let tree;await act(async()=>{tree=renderer.create(React.createElement(AuthProvider,null,React.createElement(Consumer)));await flush();});
 await act(async()=>{await current.login('worker','synthetic');await flush();});assert.equal(reads,0);assert.equal(current.activeRole,'helper');results.workerSkipsUnusedHouseholdCache='PASS';
 await act(async()=>{await current.logout();await current.login('dual','synthetic');await flush();});assert.equal(current.userBookings.length,1);
 const initial=current.userBookings,count=commits;await act(async()=>{await current.fetchUserBookings();await flush();});assert.equal(current.userBookings,initial);assert.equal(commits,count);results.unchangedBookingRefreshSkipsContextCommit='PASS';
 rows=[{...rows[0],status:'accepted'}];await act(async()=>{await current.fetchUserBookings();});assert.equal(current.userBookings[0].status,'Accepted');assert.notEqual(current.userBookings,initial);results.changedBookingsStillRefresh='PASS';
 await act(async()=>{await current.switchMode('helper');await flush();});const workerReads=reads;await act(async()=>{await current.fetchUserBookings();});assert.equal(reads,workerReads);assert.equal(current.userBookings.length,0);
 await act(async()=>{await current.switchMode('household');await flush();});assert.equal(current.userBookings.length,1);results.roleRoundTripRestoresBookingCache='PASS';
 let resolve;stubs['../api/client'].bookingsAPI.getMyBookings=()=>new Promise(r=>{resolve=r;});let pending;
 await act(async()=>{pending=current.fetchUserBookings();await flush();await current.logout();});await act(async()=>{resolve(rows);await pending;});assert.equal(current.user,null);assert.equal(current.userBookings.length,0);results.lateBookingResponseCannotRestoreLoggedOutAccount='PASS';await act(async()=>tree.unmount());
 const {formatBookings}=await bundle('mobile/src/utils/bookings.js');
 const oldSource=fs.readFileSync(path.resolve(root,'../HelpEarly-test-tools/concurrency-baseline-20261012/mobile/src/context/AuthContext.js'),'utf8');
 const oldMap=oldSource.match(/setUserBookings\((rows\.map\(b => \(\{[\s\S]*?\}\)\))\);/);assert(oldMap,'Captured original formatter required');const oldFormat=new Function('rows','return '+oldMap[1]);
 const samples=Array.from({length:100},(_,i)=>({...rows[0],id:i+1,booking_date:i===0?null:`2027-02-${String(i%27+1).padStart(2,'0')}T12:30:00Z`}));assert.deepEqual(formatBookings(samples),oldFormat(samples));results.localeAndWireFormatPreserved='PASS';
 const before=[],after=[];oldFormat(samples);formatBookings(samples);
 for(let i=0;i<30;i++){for(const [fn,times]of i%2?[[formatBookings,after],[oldFormat,before]]:[[oldFormat,before],[formatBookings,after]]){const start=performance.now();fn(samples);times.push(performance.now()-start);}}
 const report={executed_at:new Date().toISOString(),results,measurements:{rows:100,pairedRounds:30,before_ms:before,after_ms:after,beforeMedian_ms:median(before),afterMedian_ms:median(after)},scope:'Actual AuthProvider rendered with React test renderer and controlled API/storage boundaries; formatter benchmark on Node/V8, NOT Android/Hermes or button-to-paint latency. Fresh native profiling unavailable; user accepted testing preview with disclosure.'};
 fs.writeFileSync(path.join(root,'docs/test-results/android-session-performance-20261013.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({results,beforeMedian_ms:median(before),afterMedian_ms:median(after),runtime:'Node/V8, native unverified'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
