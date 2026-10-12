const fs=require('node:fs'),path=require('node:path');
const parser=require('../../mobile/node_modules/@babel/parser');
const traverse=require('../../mobile/node_modules/@babel/traverse').default;
const root=path.resolve(__dirname,'../..');
const globals=new Set(['require','module','exports','__dirname','__filename','process','Buffer','console','fetch','FormData','File','Blob','FileReader','URL','URLSearchParams','AbortSignal','window','document','navigator','localStorage','Image','alert','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','global','globalThis','performance','structuredClone','Promise','Array','Object','Set','Map','WeakMap','WeakSet','String','Number','Boolean','Date','Math','JSON','Error','TypeError','RegExp','Symbol','Infinity','NaN','undefined','parseInt','parseFloat','isNaN','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','Intl','TextEncoder','TextDecoder']);
globals.add('Audio');globals.add('confirm');globals.add('AbortController');
let checked=0,errors=[];
function check(file){
  if(!/\.[jt]sx?$/.test(file))return;
  const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'unambiguous',plugins:['jsx']});checked++;
  traverse(ast,{ReferencedIdentifier(identifier){const name=identifier.node.name;if(!globals.has(name) && !identifier.scope.hasBinding(name))errors.push(`${path.relative(root,file)}:${identifier.node.loc.start.line}: undeclared ${name}`);}});
}
function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const target=path.join(folder,entry.name);if(entry.isDirectory())walk(target);else check(target);}}
for(const directory of ['client/src','mobile/src','server/controllers','server/routes','server/middleware','server/socket','server/utils','server/config'])walk(path.join(root,directory));
for(const file of ['mobile/App.js','mobile/app.config.js','mobile/index.js','server/app.js','server/server.js'])check(path.join(root,file));
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`PASS: ${checked} JavaScript/JSX files parsed; no undeclared references. This is a narrow static check, not full ESLint or type checking.`);
