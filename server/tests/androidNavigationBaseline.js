const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),esbuild=require('../../client/node_modules/esbuild'),React=require('../../client/node_modules/react'),{renderToStaticMarkup}=require('../../client/node_modules/react-dom/server');
function render(source,user,activeRole){
  global.__adminNavigationUser={user,activeRole,loading:false};
  const output=esbuild.buildSync({stdin:{contents:source,resolveDir:path.join(root,'mobile'),loader:'jsx'},bundle:true,write:false,platform:'node',format:'cjs',external:['react']});
  // Sync esbuild does not support plugins; replace imports in the small navigation entry first.
  const module={exports:{}};
  new Function('require','module','exports',output.outputFiles[0].text)(name=>name==='react'?React:require(name),module,module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
function prepare(source){
  return source.replace(/^import .* from ['"]([^'"]+)['"];?$/gm,(line,name)=>{
    if(name==='react')return line;
    if(name.includes('AuthContext'))return 'const AuthProvider=({children})=>children;const useAuth=()=>globalThis.__adminNavigationUser;';
    if(name.includes('NotificationContext'))return 'const NotificationProvider=({children})=>children;const useNotifications=()=>({navigationReady:()=>{}});';
    if(name==='@react-navigation/native')return "const NavigationContainer=({children})=>React.createElement('nav',{},children);const createNavigationContainerRef=()=>({});";
    if(name.includes('safe-area'))return 'const SafeAreaProvider=({children})=>children;const useSafeAreaInsets=()=>({bottom:0});';
    if(name.includes('bottom-tabs')||name.includes('native-stack')){
      const method=name.includes('bottom-tabs')?'createBottomTabNavigator':'createNativeStackNavigator';
      return `const ${method}=()=>({Navigator:({children,screenOptions})=>React.createElement('div',{'data-options':JSON.stringify(screenOptions)},children),Screen:({name,component:Component,options})=>React.createElement('section',{'data-screen':name,'data-options':JSON.stringify(options)},name==='Main'?React.createElement(Component):React.createElement('span',{},Component.name),options?.tabBarIcon?.({color:'test',size:22}))});`;
    }
    if(name==='@expo/vector-icons')return "const Ionicons=props=>React.createElement('i',{'data-icon':JSON.stringify(props)});";
    const identifier=line.match(/^import (\w+)/)[1];return `function ${identifier}(){return null;}`;
  });
}
function check(){
  const baseline=require('../../docs/test-results/android-parity-baseline.json');
  const old=prepare(cp.execFileSync('git',['show',baseline.commit+':mobile/App.js'],{cwd:root,encoding:'utf8'}));
  const current=fs.readFileSync(path.join(root,'mobile/App.js'),'utf8');
  assert(!current.includes('AdminDashboardScreen'));assert(!fs.existsSync(path.join(root,'mobile/src/screens/AdminDashboardScreen.js')));
  for(const [role,mode]of [['household','household'],['helper','helper'],['both','household'],['both','helper']]){
    assert.equal(render(prepare(current),{id:5,role},mode),render(old,{id:5,role},mode),`Ordinary navigation changed: ${role}/${mode}`);
  }
  assert.equal(render(prepare(current),null,'household'),render(old,null,'household'),'Unauthenticated navigation changed');
  const auth=fs.readFileSync(path.join(root,'mobile/src/context/AuthContext.js'),'utf8');
  assert(auth.includes("if (data.user.role === 'admin') throw"));assert(auth.includes("if (me.role === 'admin') throw"));
  console.log('PASS: household, worker, both dual modes and signed-out navigation render identically; admin screen absent; admin session guards present. Native pixels NOT RUN.');
}
if(require.main===module)check();module.exports=check;
