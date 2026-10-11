// Real React lifecycle/actions against the disposable local PostgreSQL API.
// React renderer lives in the external test-tools runtime, not production deps.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),esbuild=require('esbuild');
const runtime=process.env.ADMIN_TEST_RUNTIME;
assert(runtime,'Set ADMIN_TEST_RUNTIME to a directory containing react and react-test-renderer');
const React=require(path.join(runtime,'react')),renderer=require(path.join(runtime,'react-test-renderer'));
const base=process.env.ADMIN_TEST_API_URL;
assert.equal(base,'http://127.0.0.1:5074/api','Refuse any API except the disposable admin browser fixture');
const values={};global.localStorage={getItem:k=>values[k]||null,setItem:(k,v)=>values[k]=v};
global.document={activeElement:null};
let actor,view,revision=0;
const results={};
async function request(route,token,method='GET',body){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?.children!==undefined?text(n.props.children):'';
const button=name=>view.root.findAllByType('button').find(n=>text(n)===name);
const input=name=>view.root.findAllByType('input').find(n=>n.props['aria-label']===name);
const table=()=>view.root.findAllByType('table')[0];
const contents=()=>JSON.stringify(view.toJSON());
async function settle(check){const end=Date.now()+8000;while(Date.now()<end){await renderer.act(async()=>{await new Promise(r=>setTimeout(r,20));});if(check())return;}throw new Error('Real component state did not settle');}
async function click(name){assert(button(name),'Missing control '+name);await renderer.act(async()=>button(name).props.onClick());}
async function change(node,value){await renderer.act(async()=>node.props.onChange({target:{value,checked:value}}));}
async function submit(){const form=view.root.findAllByType('form').at(-1);await renderer.act(async()=>form.props.onSubmit({preventDefault(){}}));}
async function confirm(){await click('Confirm');await settle(()=>!contents().includes('Saving…')&&!contents().includes('Loading fixture'));}
async function tab(name){await click(name);await settle(()=>!!table()&&!contents().includes('Loading fixture'));}
async function main(){
  const login=await request('/auth/login',null,'POST',{email:'admin@ui.test',password:'local-admin-fixture'});assert.equal(login.status,200);actor=login.data.user;values.token=login.data.token;
  const out=await esbuild.build({entryPoints:[path.resolve(__dirname,'../src/pages/AdminDashboard.jsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],define:{'import.meta.env':JSON.stringify({VITE_API_URL:base})},plugins:[{name:'context-boundaries',setup(b){b.onResolve({filter:/context\/|LoadingSpinner/},a=>({path:a.path,namespace:'boundary'}));b.onLoad({filter:/.*/,namespace:'boundary'},a=>({loader:'js',contents:a.path.includes('SyncContext')?'export const useSync=()=>globalThis.__adminRevision;':a.path.includes('AuthContext')?'export const useAuth=()=>({user:globalThis.__adminActor});':"import React from 'react';export default ()=>React.createElement('p',{},'Loading fixture');"}));}}]});
  global.__adminActor=actor;global.__adminRevision=revision;
  const mod={exports:{}};new Function('require','module','exports',out.outputFiles[0].text)(name=>name==='react'?React:name==='react/jsx-runtime'?require(path.join(runtime,'react/jsx-runtime')):require(name),mod,mod.exports);
  await renderer.act(async()=>{view=renderer.create(React.createElement(mod.exports.default));});await settle(()=>contents().includes('Completed services'));
  for(const name of ['Accounts','Workers','Categories','Services','Bookings','Jobs','Proposals','Emergencies','Complaints','Reviews','Audit log']){await tab(name);assert.equal(view.root.findAll(n=>n.props.role==='alert').length,0);}
  results.allDatabaseBackedDashboardTabs='PASS';
  await tab('Categories');await click('Add category');
  await change(view.root.findAllByType('input').find(n=>n.props.required), 'React tested trade');await submit();assert(contents().includes('Confirm change'));await click('Cancel');
  assert(!(await request('/categories')).data.some(c=>c.name==='React tested trade'));
  await submit();await confirm();await settle(()=>contents().includes('React tested trade'));assert((await request('/categories')).data.some(c=>c.name==='React tested trade'));
  results.categorySaveConfirmationCancellationAndPersistence='PASS';
  await click('Add category');await change(view.root.findAllByType('input').find(n=>n.props.required),' ');await submit();await confirm();await settle(()=>view.root.findAll(n=>n.props.role==='alert').length>0);assert(contents().includes('Invalid administrative text'));await click('Cancel');
  results.realBackendValidationFailureRenderedNoFakeSuccess='PASS';
  await tab('Workers');await click('Verify');await click('Cancel');assert(button('Verify'));await click('Verify');await confirm();await settle(()=>!!button('Unverify'));await click('Unverify');await confirm();await settle(()=>!!button('Verify'));
  results.workerVerificationAndUnverification='PASS';
  await tab('Complaints');await click('Manage');await change(view.root.findAllByType('select').find(n=>n.props.value==='open'),'resolved');await change(view.root.findAllByType('textarea')[0],'Investigated by real React test');await submit();await confirm();await settle(()=>contents().includes('resolved'));
  const home=(await request('/auth/login',null,'POST',{email:'household@ui.test',password:'local-admin-fixture'})).data;
  assert((await request('/complaints/mine',home.token)).data.some(c=>c.status==='resolved'));assert((await request('/notifications',home.token)).data.some(n=>n.type==='complaint_updated'));
  results.complaintDecisionAndDurableHouseholdNotification='PASS';
  await tab('Accounts');const self=view.root.findAllByType('tr').find(n=>text(n).includes(actor.email));assert(self.findAllByType('button').every(n=>n.props.disabled));
  const homeRow=()=>view.root.findAllByType('tr').find(n=>text(n).includes('household@ui.test'));
  await renderer.act(async()=>homeRow().findByType('button').props.onClick());await confirm();await settle(()=>text(homeRow()).includes('Activate'));assert.equal((await request('/auth/me',home.token)).status,403);
  await renderer.act(async()=>homeRow().findByType('button').props.onClick());await confirm();await settle(()=>text(homeRow()).includes('Deactivate'));assert.equal((await request('/auth/me',home.token)).status,200);
  results.selfControlsDisabledAndAccountDeactivationReactivation='PASS';
  await tab('Jobs');await click('Hide content');await confirm();await settle(()=>!!button('Restore visibility'));await click('Restore visibility');await confirm();await settle(()=>!!button('Hide content'));
  await tab('Reviews');await click('Hide content');await confirm();await settle(()=>!!button('Restore visibility'));await click('Restore visibility');await confirm();await settle(()=>!!button('Hide content'));
  results.reversibleJobAndReviewModeration='PASS';
  await change(input('Search records'),'no-record-matches-this');await renderer.act(async()=>view.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));await settle(()=>contents().includes('No matching records.'));assert(view.root.findAllByType('span').some(n=>text(n).includes('0 matching records')));
  results.realFilteredCountAndEmptyState='PASS';
  await tab('Audit log');assert(contents().includes('SUCCESS'));assert(contents().includes('REJECTED'));
  results.realAuditRowsVisible='PASS';
  await renderer.act(async()=>view.unmount());
  fs.writeFileSync(path.resolve(__dirname,'../../docs/test-results/admin-react-integration.json'),JSON.stringify({executed_at:new Date().toISOString(),status:'PASS',scope:'Actual React hooks/lifecycle/actions and real HTTP responses from disposable PostgreSQL + Express; auth/sync/native DOM focus boundaries simulated. No backend success mocked. This is not browser pixels or physical Android.',results},null,2)+'\n');console.log('PASS: '+Object.keys(results).length+' React lifecycle/action groups against real PostgreSQL API');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
