const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),parser=require('../../mobile/node_modules/@babel/parser'),traverse=require('../../mobile/node_modules/@babel/traverse').default;
function variable(source,name){let value;traverse(parser.parse(source,{sourceType:'module',plugins:['jsx']}),{VariableDeclarator(p){if(p.node.id.name===name)value=p.node.init;}});assert(value);return value;}
function check(){
  const baseline=require('../../docs/test-results/android-parity-baseline.json');
  const old=cp.execFileSync('git',['show',baseline.commit+':mobile/src/screens/HomeScreen.js'],{cwd:root,encoding:'utf8'});
  const previous=variable(old,'categories').elements.map(n=>Object.fromEntries(n.properties.map(p=>[p.key.name,p.value.value])));
  const home=fs.readFileSync(path.join(root,'mobile/src/screens/HomeScreen.js'),'utf8');
  const icons=Object.fromEntries(variable(home,'categoryIcons').properties.map(p=>[p.key.name,p.value.value]));
  assert.deepEqual(icons,Object.fromEntries(previous.filter(c=>c.name!=='All').map(c=>[c.name,c.icon])),'Ordinary category icons must stay exact');
  const hook=fs.readFileSync(path.join(root,'mobile/src/utils/useMarketplaceCategories.js'),'utf8');
  const compiled=require('../../client/node_modules/esbuild').transformSync(hook.replace(/^import .*;\r?$/gm,''),{format:'cjs'}).code;
  const mod={exports:{}};new Function('module','exports',compiled)(mod,mod.exports);
  const names=previous.filter(c=>c.name!=='All').map(c=>c.name);
  assert.deepEqual(mod.exports.originalCategoryOrder,names);
  const rows=[...names].reverse().map((name,id)=>({name,id}));
  assert.deepEqual(mod.exports.orderCategories(rows).map(c=>c.name),names);
  const filtered=rows.filter(c=>c.name!=='Electrical');
  assert.deepEqual(mod.exports.orderCategories(filtered).map(c=>c.name),names.filter(n=>n!=='Electrical'));
  const extended=mod.exports.orderCategories([...rows,{id:20,name:'New trade'}]);assert.equal(extended.at(-1).name,'New trade');assert.equal(rows[0].name,'Cooking','Ordering must not mutate API snapshot');
  console.log('PASS: all seven ordinary category icons/order preserved; authoritative filtered/custom category data supported');
}
if(require.main===module)check();module.exports=check;
