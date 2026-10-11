const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {run,wait,dump,photo,find,input,bounds,tap,keyboardTop,visibleAboveKeyboard,root}=require('./androidNativeReview');
const results={};const swipe=()=>run('shell','input','swipe','360',String(keyboardTop()-80),'360','230','250');
const pass=name=>{results[name]='PASS';console.log('PASS '+name);};
async function focus(label,value,name){let nodes=dump();for(let i=0;i<7&&!find(nodes,label);i++){run('shell','input','swipe','650','1180','650','400','250');nodes=dump();}const field=find(nodes,label);assert(field,label+' must be reachable');tap(field);if(value)run('shell','input','text',value);await wait(200);nodes=dump(name);assert(visibleAboveKeyboard(nodes.find(n=>n.class==='android.widget.EditText'&&n.focused==='true')));photo(name);return nodes;}
async function main(){
 let nodes=dump();assert(nodes.some(n=>n.package==='host.exp.exponent'));tap(find(nodes,'Helpers'));await wait(250);nodes=dump();const worker=find(nodes,'Native Worker Fixture');assert(worker,'Verified isolated worker must be browsable');tap(worker);await wait(200);nodes=dump();
 for(let i=0;i<6&&!find(nodes,'Book Helper');i++){run('shell','input','swipe','650','1200','650','450','250');nodes=dump();}tap(find(nodes,'Book Helper'));await wait(200);
 await focus('Services you need','Unsaved%sWiring%sRequest','booking-services-keyboard');pass('Native booking multiline requested service remains above keyboard');
 run('shell','input','keyevent','4');await focus('Your offered fee','250','booking-fee-keyboard');pass('Native booking decimal fee remains above numeric keyboard');
 run('shell','input','keyevent','4');await focus('Provide job details or specific instructions...','Unsaved%sbooking%snotes','booking-notes-keyboard');nodes=dump();for(let i=0;i<6&&!visibleAboveKeyboard(find(nodes,'Confirm Booking Request'));i++){swipe();nodes=dump();}assert(visibleAboveKeyboard(find(nodes,'Confirm Booking Request')));dump('booking-action-keyboard');photo('booking-action-keyboard');pass('Native booking notes and Confirm Booking Request accessible with keyboard open; no booking submitted');
 run('shell','input','keyevent','4');run('shell','input','keyevent','4');
 fs.writeFileSync(path.join(root,'docs/test-results/android-native-booking.json'),JSON.stringify({executed_at:new Date().toISOString(),results,runtime:'Actual Android 16 emulator, Expo Go SDK 57; isolated PostgreSQL fixture',physicalPhone:'NOT RUN',mutations:'No booking or payment submitted'},null,2)+'\n');
}main().catch(e=>{console.error('Native booking failed:',e.message);process.exitCode=1;});
