const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),esbuild=require('../../client/node_modules/esbuild');
// Test-only renderer lives outside the app; native boundaries are simulated explicitly.
const testModules=process.env.ANDROID_TEST_MODULES || path.resolve(root,'../HelpEarly-test-tools/node_modules');
const React=require(path.join(testModules,'react')),renderer=require(path.join(testModules,'react-test-renderer'));
const {act}=renderer,events={},results={};let revision=0,mode='household',calls=0,created=0,scrolled;
const auth=()=>({user:{id:1,role:'both'},activeRole:mode,loading:false});
const conversation={id:41,other_id:2,other_name:'Eligible partner',other_role:'helper'};
const api={helpersAPI:{getById:async()=>({user_id:2})},messagesAPI:{conversations:async()=>{calls++;return[conversation];},messages:async()=>[],getOrCreate:async()=>{created++;return conversation;},contacts:async()=>[],send:async()=>({message:{id:9,sender_id:1,content:'Persisted',created_at:new Date().toISOString()}})}};
const ScrollView=React.forwardRef((props,ref)=>{React.useImperativeHandle(ref,()=>({measureInWindow:fn=>fn(0,100,320,300),scrollTo:args=>{scrolled=args;}}));return React.createElement('ScrollView',props,props.children);});
const native={View:'View',Text:'Text',TextInput:'TextInput',TouchableOpacity:'Button',ActivityIndicator:'Spinner',Image:'Image',Modal:'Modal',ScrollView,KeyboardAvoidingView:'KeyboardAvoidingView',Platform:{OS:'android'},StyleSheet:{create:x=>x},Keyboard:{addListener:(name,fn)=>{events[name]=fn;return{remove:()=>delete events[name]};}},BackHandler:{addEventListener:(name,fn)=>{events[name]=fn;return{remove:()=>{if(events[name]===fn)delete events[name];}};}},FlatList:props=>React.createElement('List',{},props.ListHeaderComponent,...(props.data||[]).map((item,index)=>React.createElement(React.Fragment,{key:index},props.renderItem({item,index}))),props.data?.length?null:props.ListEmptyComponent)};
// Host TextInput remains a function so focused-node measurements can be injected.
native.TextInput=Object.assign(props=>React.createElement('TextInput',props),{State:{currentlyFocusedInput:()=>({measureInWindow:fn=>fn(0,550,200,30)})}});
native.StyleSheet.flatten=value=>Array.isArray(value)?Object.assign({},...value.map(native.StyleSheet.flatten)):value||{};
native.StatusBar={currentHeight:0};
global.requestAnimationFrame=fn=>fn();
const navigator=()=>({Navigator:props=>React.createElement('Navigator',props,props.children),Screen:props=>React.createElement('Screen',props,props.name==='Main'?React.createElement(props.component):null)});
const stubs={
 'react-native':native,'react-native-safe-area-context':{SafeAreaProvider:({children})=>children,SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({bottom:24})},
 '@expo/vector-icons':{Ionicons:props=>React.createElement('Icon',props)},
 '@react-navigation/native':{NavigationContainer:React.forwardRef(({children},ref)=>children),createNavigationContainerRef:()=>({}),useFocusEffect:callback=>React.useEffect(callback,[callback])},
 '@react-navigation/bottom-tabs':{createBottomTabNavigator:navigator},'@react-navigation/native-stack':{createNativeStackNavigator:navigator},
 'AuthContext':{useAuth:auth,AuthProvider:({children})=>children},'NotificationContext':{useNotifications:()=>({revision,unreadCount:3,navigationReady:()=>{}}),NotificationProvider:({children})=>children},
 'Feedback':{Alert:{alert:()=>{}},FeedbackProvider:({children})=>children},'api/client':api,
};
async function load(file,app=false){
 const result=await esbuild.build({entryPoints:[path.join(root,file)],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],loader:{'.js':'jsx'},plugins:[{name:'native-test-boundaries',setup(build){build.onResolve({filter:/.*/},args=>{
  if(args.path==='react')return{path:'react',external:true};
  let key=Object.keys(stubs).find(k=>args.path===k || args.path.endsWith('/'+k));
  if(key)return{path:key,namespace:'boundary'};
  if(app && args.kind!=='entry-point' && (args.path.includes('/screens/') || (args.importer.endsWith('RoleSections.js') && args.path.startsWith('./'))))return{path:'screen:'+args.path,namespace:'boundary'};
 });build.onLoad({filter:/.*/,namespace:'boundary'},args=>({contents:args.path.startsWith('screen:')?`exports.__esModule=true;exports.default=function ExistingScreen(props){return require('react').createElement('SectionScreen',{name:${JSON.stringify(args.path)},route:props.route});};exports.HouseholdPostsScreen=exports.default;exports.WorkerHomeScreen=exports.default;`:`module.exports=globalThis.__nativeTestStubs[${JSON.stringify(args.path)}];`,loader:'js'}));}}]});
 global.__nativeTestStubs=stubs;const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(name=>name==='react'?React:require(name),mod,mod.exports);return mod.exports;
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const pass=name=>{results[name]='PASS';console.log('PASS '+name);};
async function main(){
 const App=(await load('mobile/App.js',true)).default;
 for(const role of ['household','helper']){mode=role;let tree;await act(async()=>{tree=renderer.create(React.createElement(App));});const tabs=tree.root.findAllByType('Screen').filter(s=>['Home','Explore','Jobs','Inbox','AiAssistant','NotificationTab','Profile'].includes(s.props.name));assert.deepEqual(tabs.map(t=>t.props.name),role==='household'?['Home','Explore','Jobs','AiAssistant','NotificationTab','Profile']:['Home','Jobs','Inbox','AiAssistant','NotificationTab','Profile']);assert.equal(tabs.length,6);assert(320/tabs.length>=48);const tab=tree.root.findAllByType('Navigator').find(t=>t.props.screenOptions.tabBarHideOnKeyboard);assert.equal(tab.props.screenOptions.tabBarStyle.height,80);assert.equal(tab.props.screenOptions.tabBarStyle.paddingBottom,24);assert(!tree.root.findAllByType('Screen').some(t=>/Admin/.test(t.props.name)));await act(async()=>tree.unmount());}
 pass('Actual App renders six ordered tabs in both dual modes; household Inbox only inside Helpers; safe inset and keyboard-hide configured; no Android admin route');
 const Chat=(await load('mobile/src/screens/ChatScreen.js')).default;mode='household';let tree;
 const navigation={setParams:()=>{},navigate:()=>{}};const props={navigation,route:{params:{conversationId:41}}};
 await act(async()=>{tree=renderer.create(React.createElement(Chat,props));await flush();await flush();});
 const inConversation=()=>tree.root.findAllByType('Icon').some(icon=>icon.props.name==='arrow-back');assert(inConversation());
 const oldCalls=calls;await act(async()=>events.hardwareBackPress());assert(!inConversation());
 revision++;await act(async()=>{tree.update(React.createElement(Chat,props));await flush();});assert(!inConversation());assert(calls>oldCalls);
 await act(async()=>tree.unmount());
 await act(async()=>{tree=renderer.create(React.createElement(Chat,{navigation,route:{params:{helperUserId:2}}}));await flush();await flush();});assert(inConversation());assert(created>0);
 const back=tree.root.findAllByType('Button').find(button=>button.findAllByType('Icon').some(i=>i.props.name==='arrow-back'));await act(async()=>back.props.onPress());assert(!inConversation());revision++;await act(async()=>{tree.update(React.createElement(Chat,{navigation,route:{params:{}}}));await flush();});assert(!inConversation());await act(async()=>tree.unmount());
 pass('Actual Chat hardware/header Back stays in list after refreshed data; first-time profile chat opens without delay workaround');
 const {FormScrollView,FormModal}=await load('mobile/src/components/FormLayout.js');await act(async()=>{tree=renderer.create(React.createElement(FormScrollView,{children:React.createElement('TextInput')}));});await act(async()=>events.keyboardDidShow({endCoordinates:{screenY:400}}));assert.equal(scrolled.y,188);await act(async()=>events.keyboardDidHide());await act(async()=>tree.unmount());await act(async()=>{tree=renderer.create(React.createElement(FormModal,{visible:true},React.createElement('Button')));});assert.equal(tree.root.findByType('KeyboardAvoidingView').props.enabled,false);assert(tree.root.findByType('SafeAreaView').props.edges.includes('bottom'));await act(async()=>tree.unmount());
 pass('Actual form scroll computes focused-input overflow; Android has single keyboard owner; modal bottom safe inset present (simulated measurements)');
 native.StatusBar.currentHeight=64;scrolled=null;
 await act(async()=>{tree=renderer.create(React.createElement(FormScrollView,{children:React.createElement('TextInput')}));});await act(async()=>events.keyboardDidShow({endCoordinates:{screenY:400}}));assert.equal(scrolled.y,252);await act(async()=>tree.unmount());native.StatusBar.currentHeight=0;
 pass('Android status-bar origin converts window measurements to keyboard screen coordinates without fixed padding');
 const date=await load('mobile/src/utils/dateOnly.js');assert.throws(()=>date.parseDate('2026-02-30'));assert.throws(()=>date.parseDate('2020-01-01'));assert.throws(()=>date.parseDate('11/10/2026'));assert.equal(date.dateText(date.parseDate('2028-02-29')),'2028-02-29');
 pass('Manual date rejects rollover, malformed and past dates; valid leap date round-trips');
 const Sections=await load('mobile/src/screens/RoleSections.js',true);
 for(const [name,labels]of [['HouseholdPostsScreen',['My Posts','Complaints','Broadcasts']],['WorkerHomeScreen',['Dashboard','Complaints','Broadcasts']]]){
  const Component=Sections[name];await act(async()=>{tree=renderer.create(React.createElement(Component,{navigation,route:{params:{}}}));});
  assert.deepEqual(tree.root.findAllByType('Button').map(b=>b.findByType('Text').children.join('')),labels);
  await act(async()=>tree.root.findAllByType('Button')[1].props.onPress());assert(tree.root.findByType('SectionScreen').props.name.endsWith('ComplaintsScreen'));
  await act(async()=>tree.update(React.createElement(Component,{navigation,route:{params:{section:'broadcasts'}}})));assert(tree.root.findByType('SectionScreen').props.name.endsWith('EmergencyScreen'));
  await act(async()=>tree.update(React.createElement(Component,{navigation,route:{params:{section:'main'}}})));assert(!tree.root.findByType('SectionScreen').props.name.endsWith('EmergencyScreen'));await act(async()=>tree.unmount());
 }
 pass('Actual role sections render correct subtabs, complaint tap, emergency notification intent and dashboard/posts return');
 const {openNotification}=await load('mobile/src/utils/openNotification.js');let target;const routeNav={navigate:(...args)=>{target=args;}};
 await openNotification(routeNav,{type:'emergency_new',data:{request_id:7,audience:'helper'}},'helper',{role:'both'},async()=>{});assert.equal(target[1].screen,'Home');assert.equal(target[1].params.section,'broadcasts');
 await openNotification(routeNav,{type:'message_new',data:{conversation_id:41,audience:'household'}},'household',{role:'both'},async()=>{});assert.equal(target[1].screen,'Explore');assert.equal(target[1].params.openSubTab,'chats');
 await openNotification(routeNav,{type:'proposal_new',data:{job_id:7}},'household',{role:'both'},async()=>{});assert.equal(target[1].params.section,'main');
 pass('Actual notification router sends role-specific emergency/chat/proposal intents to correct tab and section');
 const source=fs.readFileSync(path.join(root,'mobile/src/utils/openNotification.js'),'utf8');assert(source.includes("section:'broadcasts'"));assert(source.includes("section:'complaints'"));
 fs.writeFileSync(path.join(root,'docs/test-results/android-physical-fixes-ui.json'),JSON.stringify({executed_at:new Date().toISOString(),results,native_boundaries:'Simulated RN/navigation host components and measurements; actual App/Chat/Form/date modules',physical_pixels_keyboard_push:'NOT RUN'},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
