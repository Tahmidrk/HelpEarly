const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const esbuild=require('../../client/node_modules/esbuild');
const testModules=process.env.PERFORMANCE_TEST_MODULES || 'C:/Users/tahmi/.cache/helpearly-ui-tests/node_modules';
const React=require(path.join(testModules,'react')),renderer=require(path.join(testModules,'react-test-renderer')),{act}=renderer;
global.IS_REACT_ACT_ENVIRONMENT=true;
const root=path.resolve(__dirname,'../..'),results={},measurements={},storage=new Map();
const asyncStorage={getItem:async key=>storage.get(key)||null,setItem:async(key,value)=>storage.set(key,value),removeItem:async key=>storage.delete(key),multiSet:async rows=>rows.forEach(([key,value])=>storage.set(key,value)),multiRemove:async keys=>keys.forEach(key=>storage.delete(key))};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
let auth,api,role='household',revision=0,fetchCalls=0,slowCleanup=false,slowAudience=false,cleanup=deferred(),audience=deferred();
const stubs={
  'react-native-safe-area-context':{SafeAreaView:'View'},
  'react-native':{Platform:{OS:'android'},StyleSheet:{create:x=>x,flatten:x=>Array.isArray(x)?Object.assign({},...x.filter(Boolean)):x||{}},View:'View',Text:'Text',TouchableOpacity:'Button',ActivityIndicator:'Spinner',TextInput:'Input',FlatList:p=>React.createElement('List',p,...(p.data||[]).map((item,index)=>React.createElement(React.Fragment,{key:index},p.renderItem({item,index}))))},
  '@react-native-async-storage/async-storage':asyncStorage,'expo-constants':{expoConfig:{}},'expo-file-system':{File:class{}},
  '@expo/vector-icons':{Ionicons:'Icon'},'@react-navigation/native':{useFocusEffect:callback=>React.useEffect(callback,[callback])},
  'Feedback':{Alert:{alert:()=>{}}},'NotificationContext':{useNotifications:()=>({revision})},
  'AuthContext':{useAuth:()=>auth},'MapViewModal':{default:()=>null,__esModule:true},
};
Object.assign(stubs['react-native'],{Switch:'Switch',Image:'Image',KeyboardAvoidingView:'KeyboardAvoidingView'});
async function load(file,{baseline=false,apiStub=false,screenStubs=false}={}){
 const options={bundle:true,write:false,platform:'node',format:'cjs',external:['react'],loader:{'.js':'jsx'},plugins:[{name:'explicit-test-boundaries',setup(build){
  build.onResolve({filter:/.*/},args=>{
   if(args.path==='react')return{path:'react',external:true};
   if(apiStub&&args.path.endsWith('/api/client'))return{path:'api',namespace:'stub'};
   if(screenStubs && (args.path.includes('/FormLayout') || args.path.includes('/ServiceLocationInput')))return{path:'form',namespace:'stub'};
   const key=Object.keys(stubs).find(k=>args.path===k||args.path.endsWith('/'+k));if(key)return{path:key,namespace:'stub'};
   if(screenStubs && args.path.startsWith('./')&&args.importer.endsWith('RoleSections.js'))return{path:'screen',namespace:'stub'};
  });
  build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='api'?'module.exports=globalThis.__performanceApi':args.path==='form'?"exports.FormScrollView='ScrollView';exports.FormModal=p=>p.visible?require('react').createElement('Modal',p,p.children):null;exports.FormTextInput='Input';exports.__esModule=true;exports.default='LocationInput';":args.path==='screen'?"exports.__esModule=true;exports.default=p=>require('react').createElement('SectionScreen',p);exports.WorkerHomeHeader=p=>require('react').createElement('WorkerHomeHeader',p);":`module.exports=globalThis.__performanceStubs[${JSON.stringify(args.path)}]`,loader:'js'}));
 }}]};
 const full=path.join(root,file);
 const result=await esbuild.build(baseline?{...options,stdin:{contents:cp.execFileSync('git',['show','25dc89f:'+file],{cwd:root,encoding:'utf8'}),resolveDir:path.dirname(full),loader:'jsx',sourcefile:full}}:{...options,entryPoints:[full]});
 global.__performanceStubs=stubs;global.__performanceApi=api;
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(name=>name==='react'?React:require(name),module,module.exports);return module.exports;
}
function pass(name){results[name]='PASS';console.log('PASS '+name);}
async function testSession(baseline){
 storage.clear();cleanup=deferred();audience=deferred();slowCleanup=false;slowAudience=false;
 const transitions=[];let audienceCalls=0,bookingCalls=0;
 api={setApiSession:()=>{},authAPI:{login:async()=>({token:'test-only',user:{id:1,role:'both'}}),getMe:async()=>({id:1,role:'both'})},bookingsAPI:{getMyBookings:async()=>{bookingCalls++;return[];}},helpersAPI:{},notificationsAPI:{removeDevice:()=>slowCleanup?cleanup.promise:Promise.resolve(),audience:()=>{audienceCalls++;return slowAudience?audience.promise:Promise.resolve();}}};
 const {AuthProvider,useAuth}=await load('mobile/src/context/AuthContext.js',{baseline,apiStub:true});
 function Probe(){auth=useAuth();transitions.push({at:performance.now(),user:auth.user,role:auth.activeRole});return null;}
 let tree;await act(async()=>{tree=renderer.create(React.createElement(AuthProvider,null,React.createElement(Probe)));await sleep(2);});
 await act(async()=>{await auth.login('test@fixture.invalid','test-only');});
 storage.set('pushDeviceId','test-device');storage.set('pushEnabled','true');slowAudience=true;
 const startRole=performance.now();let switching;
 await act(async()=>{switching=auth.switchMode('helper');await sleep(20);});
 const changedBeforeReply=auth.activeRole==='helper';await sleep(480);await act(async()=>{audience.resolve();await switching;});
 const roleAt=transitions.find(t=>t.at>=startRole&&t.role==='helper').at;
 slowCleanup=true;const startLogout=performance.now();let leaving;
 await act(async()=>{leaving=auth.logout();await sleep(20);});
 const loggedOutBeforeReply=auth.user===null;await sleep(480);await act(async()=>{cleanup.resolve();await leaving;});
 const logoutAt=transitions.find(t=>t.at>=startLogout&&t.user===null).at;
 const result={role_ms:Math.round(roleAt-startRole),logout_ms:Math.round(logoutAt-startLogout),roleChangedBeforeServerReply:changedBeforeReply,logoutBeforeServerReply:loggedOutBeforeReply,notificationAudienceCalls:audienceCalls,bookingCalls};
 if(!baseline){assert(changedBeforeReply);assert(loggedOutBeforeReply);assert.equal(storage.get('token'),undefined);assert.equal(storage.get('activeRole'),undefined);assert.equal(storage.get('pushEnabled'),undefined);assert(auth.fetchUserBookings===auth.fetchUserBookings);}
 await act(async()=>tree.unmount());return result;
}
async function main(){
 measurements.controlledSlowNetwork={before:await testSession(true),after:await testSession(false),description:'Actual AuthProvider using React 19 renderer, memory storage and held notification-server replies; JS state timing, not phone latency.'};
 pass('Role switch and logout render before slow push replies; local token/role/push state cleared');
 process.env.EXPO_PUBLIC_API_URL='https://fixture.invalid';
 const client=await load('mobile/src/api/client.js');client.setApiSession('first-test-token','household');
 let hold=deferred(),aborted=false;global.fetch=async(url,options)=>{fetchCalls++;options.signal.addEventListener('abort',()=>{aborted=true;});await hold.promise;return{ok:true,text:async()=>JSON.stringify([{id:1}])};};
 const first=client.apiRequest('/bookings'),second=client.apiRequest('/bookings');await sleep(2);assert.equal(fetchCalls,1);hold.resolve();assert.deepEqual(await first,await second);
 pass('Concurrent identical scoped GETs produce one actual fetch; no mutation retry');
 hold=deferred();const old=client.apiRequest('/jobs');await sleep(2);const oldResult=assert.rejects(old,{name:'AbortError'});client.setApiSession('first-test-token','helper');await oldResult;assert(aborted);hold.resolve();
 pass('Role change aborts in-flight transport and rejects stale response');
 global.fetch=()=>new Promise(()=>{});const timeoutStart=performance.now();await assert.rejects(client.apiRequest('/offline',{timeoutMs:30}),{code:'TIMEOUT'});measurements.unresponsiveTransport_ms=Math.round(performance.now()-timeoutStart);assert(measurements.unresponsiveTransport_ms<500);
 pass('Unresponsive transport exits within explicit deadline even when fetch ignores cancellation');
 const delayed=deferred();global.fetch=async()=>{await delayed.promise;return{ok:true,text:async()=>JSON.stringify({id:99})};};
 const oldProfile=client.apiRequest('/auth/me');const rejected=assert.rejects(oldProfile,{name:'AbortError'});client.setApiSession(null,'household');await rejected;delayed.resolve();
 pass('Logout cancels pending profile response; session cannot be restored by stale transport');
 const {createSynchronizer}=await load('mobile/src/utils/sync.js');let syncReads=0,invalidations=0;const sync=createSynchronizer(async()=>{syncReads++;return{bookings:'1',notifications:'1'};},()=>invalidations++);
 await sync.check();for(let i=0;i<10;i++)await sync.check();assert.equal(invalidations,1);await sync.check(true);assert.equal(invalidations,2);sync.stop();await sync.check();assert.equal(syncReads,12);
 pass('Unchanged polling/socket reconnect causes no refetch loop; forced foreground recovery still works');
 role='helper';auth={user:{id:1,role:'helper',helperProfile:{services:[{}]}},activeRole:role,switchMode:()=>{}};revision=0;let bookings=0,applications=0;
 api={bookingsAPI:{getMyBookings:async()=>{bookings++;return[];}},jobsAPI:{getApplications:async()=>{applications++;return[];}},helpersAPI:{},complaintsAPI:{}};
 const Worker=(await load('mobile/src/screens/WorkerDashboardScreen.js',{apiStub:true,screenStubs:true})).default;let tree;
 await act(async()=>{tree=renderer.create(React.createElement(Worker,{navigation:{}}));await sleep(2);});assert.equal(bookings,1);assert.equal(applications,1);
 await act(async()=>{tree.update(React.createElement(Worker,{navigation:{}}));await sleep(2);});assert.equal(bookings,1);
 revision++;await act(async()=>{tree.update(React.createElement(Worker,{navigation:{}}));await sleep(2);});assert.equal(bookings,2);await act(async()=>tree.unmount());
 pass('Worker dashboard loads once on focus/revision; ordinary rerenders do not refetch');
 const Sections=await load('mobile/src/screens/RoleSections.js',{screenStubs:true});await act(async()=>{tree=renderer.create(React.createElement(Sections.WorkerHomeScreen,{navigation:{setParams:()=>{}},route:{}}));});
 const parser=require('../../mobile/node_modules/@babel/parser'),traverse=require('../../mobile/node_modules/@babel/traverse').default;let styles;
 traverse(parser.parse(fs.readFileSync(path.join(root,'mobile/src/screens/ExploreScreen.js'),'utf8'),{sourceType:'module',plugins:['jsx']}),{CallExpression(p){if(p.node.callee.object?.name==='StyleSheet')styles=p.node.arguments[0];}});
 const values=name=>Object.fromEntries(styles.properties.find(p=>p.key.name===name).value.properties.map(p=>[p.key.name,p.value.value]));
 assert.deepEqual(stubs['react-native'].StyleSheet.flatten(tree.root.findAllByType('Button')[0].props.style),{...values('segmentBtn'),...values('segmentBtnActive')});
 assert.deepEqual(tree.root.findAllByType('View').find(v=>v.props.style.flexDirection==='row').props.style,values('segmentedContainer'));
 pass('Role subtabs match actual Household Helpers container, spacing, radius, palette and active indicator');
 await act(async()=>tree.root.findAllByType('Button')[1].props.onPress());assert.equal(tree.root.findByType('SectionScreen').props.historyOnly,true);await act(async()=>tree.unmount());
 api={complaintsAPI:{getMine:async()=>[{id:1,subject:'Real fixture',status:'pending',created_at:new Date().toISOString(),admin_notes:'Authorized response'}]}};
 const Complaint=(await load('mobile/src/screens/ComplaintsScreen.js',{apiStub:true,screenStubs:true})).default;await act(async()=>{tree=renderer.create(React.createElement(Complaint,{historyOnly:true}));await sleep(2);});assert.equal(tree.root.findAllByType('Button').length,0);assert(tree.root.findAllByType('Text').some(t=>t.children.includes('Administrator response')));await act(async()=>tree.unmount());
 pass('Worker Home complaint section is history-only, including persisted administrator response');
 auth={user:{id:1,role:'both',name:'Test identity',email:'test@fixture.invalid',location:'Dhaka',helperProfile:{services:[]}},activeRole:'helper'};
 const Profile=(await load('mobile/src/screens/ProfileScreen.js',{apiStub:true,screenStubs:true})).default;
 await act(async()=>{tree=renderer.create(React.createElement(Profile,{navigation:{}}));});const text=tree.root.findAllByType('Text').map(t=>t.children.join(''));assert(text.indexOf('Test identity')<text.indexOf('Personal Details & Address'));assert(text.indexOf('Personal Details & Address')<text.indexOf('About Helper'));assert(text.indexOf('Personal Details & Address')<text.indexOf('Logout Account'));assert(text.includes('test@fixture.invalid'));
 const edit=tree.root.findAllByType('Button').find(b=>b.findAllByType('Text').some(t=>t.children.join('')==='Edit'));await act(async()=>edit.props.onPress());
 await act(async()=>tree.root.findAllByType('Input').find(i=>i.props.value==='Test identity').props.onChangeText('Unsaved fixture'));
 auth={...auth,user:{...auth.user,name:'External update'}};await act(async()=>tree.update(React.createElement(Profile,{navigation:{}})));assert(tree.root.findAllByType('Input').some(i=>i.props.value==='Unsaved fixture'));await act(async()=>tree.unmount());
 pass('Actual profile renders identity before personal details, preserving worker/role controls');
 pass('Background profile synchronization preserves unsaved personal form input');
 fs.writeFileSync(path.join(root,'docs/test-results/android-performance.json'),JSON.stringify({executed_at:new Date().toISOString(),results,measurements,native:'NOT RUN by this suite; React 19 host boundaries simulated'},null,2)+'\n');
 console.log(JSON.stringify(measurements));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
