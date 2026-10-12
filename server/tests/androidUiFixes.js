const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),esbuild=require('../../client/node_modules/esbuild');
// Test-only renderer lives outside the app; native boundaries are simulated explicitly.
const testModules=process.env.ANDROID_TEST_MODULES || path.resolve(root,'../HelpEarly-test-tools/node_modules');
const React=require(path.join(testModules,'react')),renderer=require(path.join(testModules,'react-test-renderer'));
const {act}=renderer,events={},results={};let revision=0,mode='household',calls=0,created=0,scrolled;
let accountRole='both';
let refreshBookings=async()=>{};
const auth=()=>({user:{id:1,role:accountRole,name:'Rendered Worker',location:'Synthetic fixture area'},activeRole:mode,loading:false,switchMode:()=>{},refreshUser:async()=>{},addBooking:()=>refreshBookings()});
const conversation={id:41,other_id:2,other_name:'Eligible partner',other_role:'helper'};
const api={helpersAPI:{getById:async()=>({user_id:2})},messagesAPI:{conversations:async()=>{calls++;return[conversation];},messages:async()=>[],getOrCreate:async()=>{created++;return conversation;},contacts:async()=>[],send:async()=>({message:{id:9,sender_id:1,content:'Persisted',created_at:new Date().toISOString()}})}};
api.bookingsAPI={getMyBookings:async()=>[]};api.jobsAPI={getApplications:async()=>[]};
const ScrollView=React.forwardRef((props,ref)=>{React.useImperativeHandle(ref,()=>({measureInWindow:fn=>fn(0,100,320,300),scrollTo:args=>{scrolled=args;}}));return React.createElement('ScrollView',props,props.children);});
const native={View:'View',Text:'Text',TextInput:'TextInput',TouchableOpacity:'Button',ActivityIndicator:'Spinner',Image:'Image',Modal:'Modal',ScrollView,KeyboardAvoidingView:'KeyboardAvoidingView',Platform:{OS:'android'},StyleSheet:{create:x=>x},Keyboard:{addListener:(name,fn)=>{events[name]=fn;return{remove:()=>delete events[name]};}},BackHandler:{addEventListener:(name,fn)=>{events[name]=fn;return{remove:()=>{if(events[name]===fn)delete events[name];}};}},FlatList:props=>React.createElement('List',{},props.ListHeaderComponent,...(props.data||[]).map((item,index)=>React.createElement(React.Fragment,{key:index},props.renderItem({item,index}))),props.data?.length?null:props.ListEmptyComponent)};
// Host TextInput remains a function so focused-node measurements can be injected.
native.TextInput=Object.assign(props=>React.createElement('TextInput',props),{State:{currentlyFocusedInput:()=>({measureInWindow:fn=>fn(0,550,200,30)})}});
native.StyleSheet.flatten=value=>Array.isArray(value)?Object.assign({},...value.map(native.StyleSheet.flatten)):value||{};
const renderList=native.FlatList;
native.FlatList=React.forwardRef((props,ref)=>{React.useImperativeHandle(ref,()=>({scrollToEnd:()=>{}}));return renderList(props);});
native.StatusBar={currentHeight:0};
native.Switch='Switch';
native.Dimensions={get:()=>({width:320,height:640})};
global.requestAnimationFrame=fn=>fn();
const navigator=()=>({Navigator:props=>React.createElement('Navigator',props,props.children),Screen:props=>React.createElement('Screen',props,props.name==='Main'?React.createElement(props.component):null)});
const stubs={
 'react-native':native,'react-native-safe-area-context':{SafeAreaProvider:({children})=>children,SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({bottom:24})},
 '@expo/vector-icons':{Ionicons:props=>React.createElement('Icon',props)},
 '@react-navigation/native':{NavigationContainer:React.forwardRef(({children},ref)=>children),createNavigationContainerRef:()=>({}),useFocusEffect:callback=>React.useEffect(callback,[callback])},
 '@react-navigation/bottom-tabs':{createBottomTabNavigator:navigator},'@react-navigation/native-stack':{createNativeStackNavigator:navigator},
 'AuthContext':{useAuth:auth,AuthProvider:({children})=>children},'NotificationContext':{useNotifications:()=>({revision,unreadCount:3,navigationReady:()=>{}}),NotificationProvider:({children})=>children},
 'Feedback':{Alert:{alert:()=>{}},FeedbackProvider:({children})=>children},'api/client':api,
 'react-native-webview':{WebView:'WebView'},
 'expo-image-picker':{},'expo-location':{},'@react-native-community/datetimepicker':{__esModule:true,default:'NativeDatePicker'},
};
async function load(file,app=false){
 const result=await esbuild.build({entryPoints:[path.resolve(root,file)],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],loader:{'.js':'jsx'},plugins:[{name:'native-test-boundaries',setup(build){build.onResolve({filter:/.*/},args=>{
  if(args.path==='react')return{path:'react',external:true};
  let key=Object.keys(stubs).find(k=>args.path===k || args.path.endsWith('/'+k));
  if(key)return{path:key,namespace:'boundary'};
  if(app && args.kind!=='entry-point' && !/WorkerDashboardScreen(?:\.js)?$/.test(args.path) && (args.path.includes('/screens/') || (args.importer.endsWith('RoleSections.js') && args.path.startsWith('./'))))return{path:'screen:'+args.path,namespace:'boundary'};
});build.onLoad({filter:/.*/,namespace:'boundary'},args=>({contents:args.path.startsWith('screen:')?`exports.__esModule=true;exports.default=function ExistingScreen(props){return require('react').createElement('SectionScreen',{name:${JSON.stringify(args.path)},route:props.route});};exports.HouseholdPostsScreen=exports.default;exports.WorkerHomeScreen=exports.default;exports.WorkerHomeHeader=function Header(){return require('react').createElement('WorkerHeader');};`:`module.exports=globalThis.__nativeTestStubs[${JSON.stringify(args.path)}];`,loader:'js'}));}}]});
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
 const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
 const originalCreate=api.messagesAPI.getOrCreate,originalSend=api.messagesAPI.send,originalContacts=api.messagesAPI.contacts;
 mode='helper';api.messagesAPI.contacts=async()=>[{id:3,name:'Eligible household'}];
 await act(async()=>{tree=renderer.create(React.createElement(Chat,{navigation,route:{params:{}}}));await flush();});
 const pendingContact=deferred();api.messagesAPI.getOrCreate=()=>pendingContact.promise;
 const contact=tree.root.findAllByType('Button').find(button=>button.findAllByType('Text').some(text=>text.children.includes('Eligible household')));
 let opening;await act(async()=>{opening=contact.props.onPress();await flush();});assert(events.hardwareBackPress);
 await act(async()=>events.hardwareBackPress());await act(async()=>{pendingContact.resolve({...conversation,id:42,other_id:3});await opening;});assert(!inConversation());
 pass('Worker contact lookup cancelled by hardware Back cannot reopen conversation when response arrives');
 api.messagesAPI.getOrCreate=originalCreate;await act(async()=>tree.unmount());mode='household';
 await act(async()=>{tree=renderer.create(React.createElement(Chat,{navigation,route:{params:{conversationId:41}}}));await flush();await flush();});
 const composer=()=>tree.root.findAllByType('TextInput').find(input=>input.props.placeholder?.startsWith('Message '));
 const send=()=>tree.root.findAllByType('Button').find(button=>button.props.accessibilityLabel==='Send message');
 await act(async()=>composer().props.onChangeText('Submitted draft'));
 const failedSend=deferred();api.messagesAPI.send=()=>failedSend.promise;
 let sending;await act(async()=>{sending=send().props.onPress();await flush();});assert.equal(composer().props.value,'Submitted draft');
 await act(async()=>composer().props.onChangeText('Newer draft'));
 await act(async()=>{failedSend.reject(new Error('Network unavailable'));await sending;});assert.equal(composer().props.value,'Newer draft');
 const successfulSend=deferred();api.messagesAPI.send=()=>successfulSend.promise;
 await act(async()=>{sending=send().props.onPress();await flush();});await act(async()=>composer().props.onChangeText('Next message'));
 await act(async()=>{successfulSend.resolve({message:{id:10,sender_id:1,content:'Newer draft',created_at:new Date().toISOString()}});await sending;});assert.equal(composer().props.value,'Next message');
 assert.equal(tree.root.findAllByType('Text').filter(text=>text.children.includes('Newer draft')).length,1);
 const lateSend=deferred();api.messagesAPI.send=()=>lateSend.promise;
 await act(async()=>{sending=send().props.onPress();await flush();});await act(async()=>events.hardwareBackPress());
 await act(async()=>{lateSend.resolve({message:{id:11,sender_id:1,content:'Next message',created_at:new Date().toISOString()}});await sending;});assert(!inConversation());
 await act(async()=>tree.unmount());api.messagesAPI.send=originalSend;api.messagesAPI.contacts=originalContacts;
 pass('Failed/successful sends preserve edited drafts; saved message rendered once; late send cannot reopen closed chat');
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
  const tabs=()=>tree.root.findAllByType('Button').filter(b=>b.props.accessibilityRole==='tab');
  assert.deepEqual(tabs().map(b=>b.findByType('Text').children.join('')),labels);
  await act(async()=>tabs()[1].props.onPress());assert(tree.root.findByType('SectionScreen').props.name.endsWith('ComplaintsScreen'));
  await act(async()=>tree.update(React.createElement(Component,{navigation,route:{params:{section:'broadcasts'}}})));assert(tree.root.findByType('SectionScreen').props.name.endsWith('EmergencyScreen'));
  await act(async()=>tree.update(React.createElement(Component,{navigation,route:{params:{section:'main'}}})));assert(!tree.root.findAllByType('SectionScreen').some(screen=>screen.props.name.endsWith('EmergencyScreen')));await act(async()=>tree.unmount());
 }
 pass('Actual role sections render correct subtabs, complaint tap, emergency notification intent and dashboard/posts return');
 for(const role of ['helper','both']){
  accountRole=role;mode='helper';
  await act(async()=>{tree=renderer.create(React.createElement(Sections.WorkerHomeScreen,{navigation,route:{params:{}}}));await flush();});
  for(const section of ['main','complaints','broadcasts']){
   await act(async()=>tree.update(React.createElement(Sections.WorkerHomeScreen,{navigation,route:{params:{section}}})));
   const texts=tree.root.findAllByType('Text').map(text=>text.children.join(''));
   const header=role==='both'?'Household Mode':'Rendered Worker';
   assert(texts.indexOf(header)>=0&&texts.indexOf(header)<texts.indexOf('Dashboard'));
   if(role==='both')assert(!texts.includes('Rendered Worker'));
  }
  await act(async()=>tree.unmount());
 }
 accountRole='both';mode='household';
 pass('Actual WorkerHomeHeader precedes section tabs and remains rendered on all three sections for worker-only and dual-role accounts');
 api.withPhoto=async data=>data;api.bookingDate=()=>new Date(Date.now()+86400000).toISOString();api.reviewsAPI={getByHelper:async()=>[]};
 api.helpersAPI.getById=async()=>({id:2,user_id:2,name:'Eligible worker',services:[],hourly_rate:'200.00'});
 const bookingSaved=deferred(),bookingRefresh=deferred();let bookingCreates=0;
 api.bookingsAPI.create=()=>{bookingCreates++;return bookingSaved.promise;};refreshBookings=()=>bookingRefresh.promise;
 const Detail=(await load('mobile/src/screens/HelperDetailScreen.js')).default;
 await act(async()=>{tree=renderer.create(React.createElement(Detail,{navigation,route:{params:{helperId:2,autoOpenBooking:true}}}));await flush();});
 await act(async()=>{tree.root.findAllByType('TextInput').find(input=>input.props.accessibilityLabel==='Services you need').props.onChangeText('Synthetic wiring');tree.root.findAllByType('TextInput').find(input=>input.props.accessibilityLabel==='Your offered fee').props.onChangeText('250');});
 const confirm=tree.root.findAllByType('Button').find(button=>button.findAllByType('Text').some(text=>text.children.includes('Confirm Booking Request')));
 let firstBooking,secondBooking;await act(async()=>{firstBooking=confirm.props.onPress();secondBooking=confirm.props.onPress();await flush();});assert.equal(bookingCreates,1);
 await act(async()=>{bookingSaved.resolve({id:91,service_description:'Synthetic wiring',total_price:250,address:'Synthetic fixture area'});await firstBooking;await secondBooking;await flush();});
 assert(tree.root.findAllByType('Modal').some(modal=>modal.props.visible===true&&modal.findAllByType('Text').some(text=>text.children.join('').includes('Booking'))));
 bookingRefresh.resolve();await act(async()=>tree.unmount());refreshBookings=async()=>{};
 pass('Actual booking handler rejects same-frame duplicate taps and confirms saved booking while booking-list refresh remains pending');
 const staleJobs=deferred();let jobReads=0;
 api.apiRequest=async()=>[{id:1,name:'Electrical'}];
 api.jobsAPI.getMine=()=>++jobReads===1?staleJobs.promise:Promise.resolve([{id:92,title:'Fresh job',budget:250,preferred_date:'2050-01-01',description:'Current request'}]);
 const Jobs=(await load('mobile/src/screens/JobsScreen.js')).default;
 const jobProps={navigation,route:{params:{}}};
 await act(async()=>{tree=renderer.create(React.createElement(Jobs,jobProps));await flush();});
 revision++;await act(async()=>{tree.update(React.createElement(Jobs,jobProps));await flush();});
 assert(JSON.stringify(tree.toJSON()).includes('Fresh job'));
 await act(async()=>{staleJobs.resolve([{id:93,title:'Stale job',budget:250}]);await flush();});
 assert(JSON.stringify(tree.toJSON()).includes('Fresh job'));assert(!JSON.stringify(tree.toJSON()).includes('Stale job'));
 await act(async()=>tree.unmount());
 pass('Actual Jobs screen ignores an older list response after a revision refresh');
 const {openNotification}=await load('mobile/src/utils/openNotification.js');let target;const routeNav={navigate:(...args)=>{target=args;}};
 await openNotification(routeNav,{type:'emergency_new',data:{request_id:7,audience:'helper'}},'helper',{role:'both'},async()=>{});assert.equal(target[1].screen,'Home');assert.equal(target[1].params.section,'broadcasts');
 await openNotification(routeNav,{type:'message_new',data:{conversation_id:41,audience:'household'}},'household',{role:'both'},async()=>{});assert.equal(target[1].screen,'Explore');assert.equal(target[1].params.openSubTab,'chats');
 await openNotification(routeNav,{type:'proposal_new',data:{job_id:7}},'household',{role:'both'},async()=>{});assert.equal(target[1].params.section,'main');
 pass('Actual notification router sends role-specific emergency/chat/proposal intents to correct tab and section');
 api.notificationsAPI={list:async()=>[{id:1,type:'emergency_new',title:'New emergency service request',data:{request_id:7,audience:'helper'},created_at:new Date().toISOString()}],read:async()=>{}};
 api.emergencyAPI={list:async()=>[{id:7,effective_status:'pending',category_name:'Cleaning',household_name:'Authorized household',location:'Confirmed service address',contact_phone:'01700000000'}]};
 native.Linking={openURL:async()=>{}};
 const Notifications=(await load('mobile/src/screens/NotificationsScreen.js')).default;mode='helper';await act(async()=>{tree=renderer.create(React.createElement(Notifications,{navigation}));await flush();});assert(tree.root.findAllByType('Text').some(text=>text.children.includes('Emergency help needed for Cleaning.')));assert(JSON.stringify(tree.toJSON()).includes('Contact: '));await act(async()=>tree.unmount());mode='household';await act(async()=>{tree=renderer.create(React.createElement(Notifications,{navigation}));await flush();});assert(!JSON.stringify(tree.toJSON()).includes('01700000000'));await act(async()=>tree.unmount());
 pass('Authenticated worker emergency notification includes service category/contact; household view does not fetch/display worker contact details');
 const Map=(await load('mobile/src/components/MapViewModal.js')).default;let openedMap=0,locationAlert='';native.Linking.openURL=async()=>{openedMap++;};stubs.Feedback.Alert.alert=title=>{locationAlert=title;};
 await act(async()=>{tree=renderer.create(React.createElement(Map,{visible:true,locationName:''}));});assert.equal(tree.root.findAllByType('WebView').length,0);
 const searchMap=tree.root.findAllByType('Button').find(button=>button.findAllByType('Text').some(text=>text.children.includes('Search Address in Maps')));await act(async()=>searchMap.props.onPress());assert.equal(openedMap,0);assert.equal(locationAlert,'Location unavailable');await act(async()=>tree.unmount());
 for(const screen of ['HomeScreen','ExploreScreen','HelperDetailScreen','WorkerDashboardScreen','JobsScreen']){const code=fs.readFileSync(path.join(root,'mobile/src/screens/'+screen+'.js'),'utf8');assert(!/(?:\|\||useState\(|setLocation\()\s*['"](?:Dhaka(?:, Bangladesh| Central)?|Gulshan-2, Dhaka, Bangladesh)['"]/.test(code),'Invented address fallback in '+screen);}
 pass('Empty native map cannot search an invented address; all discovery/job/booking screens omit fake city/address defaults');
 const feedback=await load('mobile/src/components/Feedback.js');
 for(const [title,kind]of [['Complaint Not Saved','error'],['Unable to open update','error'],['Invalid Offer','warning'],['Profile Saved','success'],['Information','information']])assert.equal(feedback.feedbackKind(title),kind);
 let actionCalls=0;await act(async()=>{tree=renderer.create(React.createElement(feedback.FeedbackProvider));});
 await act(async()=>feedback.Alert.alert('Accepted','Booking created',[{text:'Manage booking',onPress:()=>actionCalls++}]));assert.equal(tree.root.findAllByType('Modal').length,1);
 await act(async()=>feedback.Alert.alert('Profile Saved','Unrelated background success'));assert(tree.root.findAllByType('Text').some(text=>text.children.includes('Manage booking')));
 await act(async()=>tree.root.findAllByType('Button').find(button=>button.findAllByType('Text').some(text=>text.children.includes('Manage booking'))).props.onPress());assert.equal(actionCalls,1);assert.equal(tree.root.findAllByType('Modal').length,0);
 await act(async()=>tree.unmount());pass('Feedback classifies errors/validation correctly; single-action confirmation persists and cannot be replaced by background toast');
 const staleComplaints=deferred();let complaintReads=0;
 api.complaintsAPI={getMine:()=>++complaintReads===1?staleComplaints.promise:Promise.resolve([{id:102,subject:'Fresh complaint',status:'pending',created_at:'2026-10-13T00:00:00Z',description:'Current request'}])};
 const Complaint=(await load('mobile/src/screens/ComplaintsScreen.js')).default;
 await act(async()=>{tree=renderer.create(React.createElement(Complaint,{historyOnly:true}));await flush();});
 revision++;await act(async()=>{tree.update(React.createElement(Complaint,{historyOnly:true}));await flush();});
 await act(async()=>{staleComplaints.resolve([{id:101,subject:'Stale complaint',status:'pending',created_at:'2026-10-13T00:00:00Z'}]);await flush();});
 assert(tree.root.findAllByType('Text').some(text=>text.children.includes('Fresh complaint')));assert(!tree.root.findAllByType('Text').some(text=>text.children.includes('Stale complaint')));await act(async()=>tree.unmount());
 pass('Complaint history retains the newest revision when an older focused request resolves late');
 const source=fs.readFileSync(path.join(root,'mobile/src/utils/openNotification.js'),'utf8');assert(source.includes("section:'broadcasts'"));assert(source.includes("section:'complaints'"));
 fs.writeFileSync(path.join(root,'docs/test-results/android-physical-fixes-ui.json'),JSON.stringify({executed_at:new Date().toISOString(),results,native_boundaries:'Simulated RN/navigation host components and measurements; actual App/Chat/Form/date modules',physical_pixels_keyboard_push:'NOT RUN'},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
