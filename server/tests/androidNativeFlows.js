const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {run,wait,dump,photo,find,input,bounds,tap,keyboardTop,root}=require('./androidNativeReview');
const report=path.join(root,'docs/test-results/android-native-flows.json'),results={},measurements={};
const pass=name=>{results[name]='PASS';console.log('PASS '+name);};
async function main(){
 let nodes=dump();assert(nodes.some(n=>n.package==='host.exp.exponent'));
 if(find(nodes,'Go home')){run('shell','input','keyevent','4');nodes=dump();}
 if(find(nodes,'Dashboard')){tap(find(nodes,'Dashboard'));await wait(100);nodes=dump();tap(find(nodes,'Household Mode'));await wait(200);nodes=dump();}
 assert(find(nodes,'Native Dual Fixture'));
 const roleStart=performance.now();tap(find(nodes,'Worker Mode'));await wait(200);nodes=dump('worker-home');measurements.roleSwitchUpperBound_ms=Math.round(performance.now()-roleStart);
 for(const label of ['Dashboard','Complaints','Broadcasts']){const tab=find(nodes,label);assert(tab,'Missing worker section '+label);assert(bounds(tab)[1]>=128,'Worker section hidden behind status bar: '+label);}
 photo('worker-home');pass('Native worker Home exposes Dashboard / Complaints / Broadcasts below status bar');
 tap(find(nodes,'Complaints'));await wait(250);nodes=dump('worker-complaints');assert(find(nodes,'Native history fixture'));assert(!find(nodes,'Submit complaint'));assert(find(nodes,'Fixture administrator response'));photo('worker-complaints');
 pass('Native worker complaint history has real database response and no submission action');
 // Expo Go's floating developer menu overlaps the right edge; tap inside the tab's left edge.
 const broadcast=bounds(find(nodes,'Broadcasts'));run('shell','input','tap',String(broadcast[0]+10),String(broadcast[1]+10));await wait(250);nodes=dump('worker-broadcasts');assert(nodes.some(n=>n.text.startsWith('No emergency requests')));photo('worker-broadcasts');pass('Native worker Broadcasts opens authorized emergency list with empty state');
 tap(find(nodes,'Dashboard'));await wait(100);nodes=dump();tap(find(nodes,'Household Mode'));await wait(200);nodes=dump();
 tap(find(nodes,'Posts'));await wait(250);nodes=dump('household-posts');for(const label of ['My Posts','Complaints','Broadcasts'])assert(find(nodes,label));photo('household-posts');pass('Native household Posts shows three requested subtabs');
 tap(find(nodes,'Profile'));await wait(200);nodes=dump('household-profile');assert(bounds(find(nodes,'Native Dual Fixture'))[1]<bounds(find(nodes,'Personal Details & Address'))[1]);photo('household-profile');pass('Native profile identity precedes personal details');
 // Lose API transport while keeping Metro/debugging online; logout must still leave immediately.
 run('reverse','--remove','tcp:5076');run('shell','input','swipe','350','1250','350','450','250');nodes=dump();const logout=find(nodes,'Logout Account');assert(logout,'Logout must be scrollable');const logoutStart=performance.now();tap(logout);await wait(200);nodes=dump('offline-logout');measurements.offlineLogoutUpperBound_ms=Math.round(performance.now()-logoutStart);assert(find(nodes,'Sign In'));photo('offline-logout');
 run('reverse','tcp:5076','tcp:5076');pass('Native logout reaches Login while backend unreachable; no waiting on notification cleanup');
 fs.writeFileSync(report,JSON.stringify({executed_at:new Date().toISOString(),results,measurements,runtime:'Actual Android 16 emulator, Expo Go SDK 57, isolated PostgreSQL fixture; adb upper bounds include UI dump overhead',physicalPhone:'NOT RUN',fcm:'NOT RUN'},null,2)+'\n');
}
main().catch(error=>{console.error('Native flow failed:',error.message);try{run('reverse','tcp:5076','tcp:5076');}catch{}process.exitCode=1;});
