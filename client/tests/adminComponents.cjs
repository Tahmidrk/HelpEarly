const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),esbuild=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
async function main(){
  const compiled=await esbuild.build({entryPoints:[path.resolve(__dirname,'../src/pages/AdminDashboard.jsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'component-boundaries',setup(b){b.onResolve({filter:/context\/|utils\/api|LoadingSpinner/},a=>({path:a.path,namespace:'boundary'}));b.onLoad({filter:/.*/,namespace:'boundary'},a=>({loader:'js',contents:a.path.includes('SyncContext')?'export const useSync=()=>0;':a.path.includes('AuthContext')?'export const useAuth=()=>({user:{id:1}});':a.path.includes('utils/api')?'export const adminAPI={};':'export default ()=>null;'}));}}]});
  const mod={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
  const {AdminTable,adminTabs}=mod.exports;let calls=[];
  const props={busy:false,actorId:1,onAction:(...args)=>calls.push(args),onEdit:(...args)=>calls.push(args)};
  const nodes=(node,predicate,result=[])=>{if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);React.Children.forEach(node.props?.children,child=>nodes(child,predicate,result));return result;};
  const cases={users:{id:2,name:'Test',role:'household',is_active:true},workers:{id:3,name:'Worker',is_verified:false,is_available:true},categories:{id:4,name:'Trade',is_visible:true},services:{id:5,service_name:'Wiring',is_hidden:false},jobs:{id:6,title:'Job',is_hidden:false},reviews:{id:7,comment:'<script>unsafe</script>',rating:4,is_hidden:false},complaints:{id:8,subject:'Complaint',status:'open'},bookings:{id:9,status:'completed',total_price:'450'},proposals:{id:10,status:'accepted'},emergencies:{id:11,status:'pending'},audit:{id:12,actor_id:1,action:'user.update',outcome:'SUCCESS'}};
  for(const [tab,row]of Object.entries(cases)){
    const element=AdminTable({...props,tab,rows:[row]}),html=renderToStaticMarkup(element);assert(html.includes('<table'));assert(html.includes(String(row.id)));
    for(const button of nodes(element,n=>n.type==='button')){calls=[];button.props.onClick();assert.equal(calls.length,1);assert.equal(calls[0][1]?.id||calls[0][0]?.id,row.id);}
    if(['bookings','proposals','emergencies','audit'].includes(tab)){assert.equal(nodes(element,n=>n.type==='button').length,0);assert(html.includes('Read only'));}
    assert(renderToStaticMarkup(React.createElement(AdminTable,{...props,tab,rows:[]})).includes('No matching records'));
    if(tab==='reviews'){assert(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert(!html.includes('<script>'));}
  }
  const self=AdminTable({...props,tab:'users',rows:[{...cases.users,id:1,role:'admin'}]});assert(nodes(self,n=>['button','select'].includes(n.type)).every(n=>n.props.disabled));
  const busy=AdminTable({...props,busy:true,tab:'workers',rows:[cases.workers]});assert(nodes(busy,n=>n.type==='button').every(n=>n.props.disabled));
  assert.equal(Object.keys(adminTabs).length,12);
  fs.writeFileSync(path.resolve(__dirname,'../../docs/test-results/admin-components.json'),JSON.stringify({executed_at:new Date().toISOString(),status:'PASS',scope:'Actual React AdminTable rendering/action callbacks across 11 resources; self-admin/busy disabled controls; read-only monitors; empty state; HTML escaping. Dependency boundaries stubbed, no backend results mocked.',browserInteractions:'See separate browser evidence'},null,2)+'\n');
  console.log('PASS: 11 real table components/actions; read-only views, self-lockout/busy controls, empty states and XSS escaping');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
