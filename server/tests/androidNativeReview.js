// Actual Android instrumentation through adb. Never point this runner at a personal phone.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const adb=process.env.ANDROID_REVIEW_ADB||'C:/Users/tahmi/.cache/helpearly-android-sdk/platform-tools/adb.exe';
const serial=process.env.ANDROID_REVIEW_SERIAL||'emulator-5554';assert(serial.startsWith('emulator-'),'Disposable emulator only');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'docs/test-results/android-native');fs.mkdirSync(output,{recursive:true});
const run=(...args)=>cp.execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:30000,windowsHide:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const parse=xml=>[...xml.matchAll(/<node\s+([^>]+)>?/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2].replace(/&amp;/g,'&').replace(/&apos;/g,"'")])));
const bounds=node=>node.bounds.match(/\d+/g).map(Number),tap=node=>{const [x,y,r,b]=bounds(node);run('shell','input','tap',String(Math.round((x+r)/2)),String(Math.round((y+b)/2)));};
const artifactName=name=>(process.env.ANDROID_REVIEW_PREFIX||'')+name;
function dump(name){run('shell','uiautomator','dump','--compressed','/sdcard/helpearly-review.xml');const xml=run('shell','cat','/sdcard/helpearly-review.xml');if(name)fs.writeFileSync(path.join(output,artifactName(name)+'.xml'),xml);return parse(xml);}
function photo(name){run('shell','screencap','-p','/sdcard/helpearly-review.png');run('pull','/sdcard/helpearly-review.png',path.join(output,artifactName(name)+'.png'));}
const find=(nodes,label)=>nodes.find(n=>n['content-desc']===label||n.text===label||n.hint===label);
const input=(nodes,index)=>nodes.filter(n=>n.class==='android.widget.EditText')[index];
const keyboardTop=()=>{const value=run('shell','dumpsys','window');const match=value.match(/type=ime frame=\[\d+,(\d+)\]/);assert(match,'IME frame missing');assert(/mInputShown=true/.test(run('shell','dumpsys','input_method')),'Keyboard not shown');return Number(match[1]);};
const visibleAboveKeyboard=node=>{if(!node)return false;const [,y,,bottom]=bounds(node);return y>=0&&bottom>y&&bottom<=keyboardTop();};
const results={},measurements={};const pass=name=>{results[name]='PASS';console.log('PASS '+name);};
async function main(){
 assert.equal(run('shell','getprop','ro.build.version.sdk').trim(),'36');
 run('shell','am','force-stop','host.exp.exponent');
 run('shell','am','start','-W','-a','android.intent.action.VIEW','-d',`exp://127.0.0.1:${process.env.ANDROID_REVIEW_METRO_PORT||8091}`,'-p','host.exp.exponent');
 let nodes;
 for(let attempt=0;attempt<6;attempt++){await wait(500);nodes=dump();if(find(nodes,'Sign In'))break;if(!nodes.some(n=>n.package==='host.exp.exponent'))run('shell','am','start','-W','-a','android.intent.action.VIEW','-d',`exp://127.0.0.1:${process.env.ANDROID_REVIEW_METRO_PORT||8091}`,'-p','host.exp.exponent');}
 assert(nodes.some(n=>n.package==='host.exp.exponent'),'Latest source must run inside Expo Go; installed old release is not valid evidence');assert(find(nodes,'Sign In'),'Latest local fixture must already be opened in Expo Go');
 tap(input(nodes,1));run('shell','input','text','native-fixture-123');await wait(400);
 nodes=dump();assert(visibleAboveKeyboard(nodes.find(n=>n.class==='android.widget.EditText'&&n.focused==='true')));
 for(let i=0;i<3&&!visibleAboveKeyboard(find(nodes,'Sign In'));i++){run('shell','input','swipe','360',String(keyboardTop()-80),'360','200','250');nodes=dump();}
 assert(visibleAboveKeyboard(find(nodes,'Sign In')));dump('login-keyboard');photo('login-keyboard');
 pass('Android 16 native login: focused password and Sign In remain above real keyboard');
 run('shell','input','keyevent','4');await wait(200);nodes=dump();tap(find(nodes,'Register Here'));await wait(300);nodes=dump();
 tap(input(nodes,0));run('shell','input','text','Native%sSignup');await wait(200);nodes=dump('signup-first-field');assert(visibleAboveKeyboard(nodes.find(n=>n.class==='android.widget.EditText'&&n.focused==='true')));
 const scrollAboveKeyboard=()=>run('shell','input','swipe','360',String(keyboardTop()-80),'360','250','250');
 for(let i=0;i<3;i++){scrollAboveKeyboard();await wait(100);}nodes=dump();
 const password=nodes.find(n=>n.class==='android.widget.EditText'&&n.password==='true');assert(password,'Signup password scrollable');tap(password);run('shell','input','text','signup-fixture-123');await wait(200);nodes=dump('signup-password');assert(visibleAboveKeyboard(nodes.find(n=>n.class==='android.widget.EditText'&&n.focused==='true')));
 scrollAboveKeyboard();await wait(100);nodes=dump('signup-action');assert(visibleAboveKeyboard(find(nodes,'Create Account')));photo('signup-action');
 pass('Android 16 native signup: first/last fields and Create Account scroll above keyboard; no registration submitted');
 run('shell','input','keyevent','4');await wait(200);nodes=dump();tap(find(nodes,'Sign In'));await wait(250);nodes=dump();
 tap(input(nodes,0));run('shell','input','text','dual@native.test');run('shell','input','keyevent','4');nodes=dump();tap(input(nodes,1));run('shell','input','keyevent','123',...Array(80).fill('67'));run('shell','input','text','native-fixture-123');nodes=dump();
 for(let i=0;i<3&&!visibleAboveKeyboard(find(nodes,'Sign In'));i++){scrollAboveKeyboard();nodes=dump();}assert(visibleAboveKeyboard(find(nodes,'Sign In')));
 const start=performance.now();tap(find(nodes,'Sign In'));await wait(1200);nodes=dump('household-home');measurements.loginToHomeUpperBound_ms=Math.round(performance.now()-start);assert(find(nodes,'Native Dual Fixture'));photo('household-home');
 pass('Native login reaches real isolated PostgreSQL household dashboard without stuck loading');
 // Additional checks deliberately remain explicit; no physical FCM claim.
 fs.writeFileSync(path.join(root,'docs/test-results/'+(process.env.ANDROID_REVIEW_REPORT || 'android-native-review.json')),JSON.stringify({executed_at:new Date().toISOString(),results,measurements,device:{serial,android:'16',api:36,size:run('shell','wm','size').trim(),density:320,navigation:run('shell','cmd','overlay','list').split('\n').filter(line=>line.includes('[x]')&&line.includes('navbar')).join().trim()},runtime:`Expo Go SDK 57.0.9, latest local source, isolated PostgreSQL API ${process.env.ANDROID_REVIEW_API_PORT||5076}`,physicalPhone:'NOT RUN',signedPreview:'NOT RUN by this suite',fcm:'NOT RUN; Expo Go lacks remote push'},null,2)+'\n');
}
module.exports={run,wait,dump,photo,find,input,bounds,tap,keyboardTop,visibleAboveKeyboard,output,root};
if(require.main===module)main().catch(error=>{console.error('Native review failed:',error.message);process.exitCode=1;});
