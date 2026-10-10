import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const calls=[];
globalThis.localStorage={getItem:key=>key==='token'?'test-token':'household'};
globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>[]};};
for(const [env,expected] of [
  [{},{api:'/api',socket:undefined,media:'/uploads/photo.png'}],
  [{VITE_API_URL:'https://api.example.test'},{api:'https://api.example.test/api',socket:'https://api.example.test',media:'https://api.example.test/uploads/photo.png'}],
  [{VITE_API_URL:'https://api.example.test/api/',VITE_SOCKET_URL:'https://socket.example.test/api/'},{api:'https://api.example.test/api',socket:'https://socket.example.test',media:'https://api.example.test/uploads/photo.png'}],
]) {
  const output=await build({entryPoints:[path.join(root,'src/utils/api.js')],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':JSON.stringify(env)}});
  const api=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
  assert.equal(api.API_BASE,expected.api);assert.equal(api.SOCKET_URL,expected.socket);
  assert.equal(api.getMediaUrl('/uploads/photo.png'),expected.media);
  assert.equal(api.getMediaUrl('https://media.example.test/photo.png'),'https://media.example.test/photo.png');
  await api.chatbotAPI.history();assert.equal(calls.at(-1).url,expected.api+'/chatbot');
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer test-token');
  await api.chatbotAPI.send('Question');assert.equal(calls.at(-1).url,expected.api+'/chatbot');
  assert.equal(JSON.parse(calls.at(-1).options.body).message,'Question');
}
globalThis.fetch=async()=>({ok:true,json:async()=>{throw new Error('HTML');}});
const invalid=await build({entryPoints:[path.join(root,'src/utils/api.js')],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':'{}'}});
const api=await import('data:text/javascript;base64,'+Buffer.from(invalid.outputFiles[0].text).toString('base64'));
await assert.rejects(()=>api.chatbotAPI.history(),/Check backend deployment/);
// Do not build or deploy: evaluate the actual config callback with isolated environments.
const check=`import config from './vite.config.js';try {config({command:'build',mode:'production'});console.log('accepted');} catch(e) {console.log(e.message);process.exitCode=1;}`;
for(const value of ['', 'http://localhost:5000', 'https://user:password@api.example.test', 'https://api.example.test']) {
  let result;
  try {result=execFileSync(process.execPath,['--input-type=module','-e',check],{cwd:root,env:{...process.env,VERCEL:'1',VITE_API_URL:value,VITE_SOCKET_URL:''},encoding:'utf8',stdio:['ignore','pipe','pipe']});}
  catch(error) {result=error.stdout;}
  assert.equal(result.trim()==='accepted',value==='https://api.example.test');
}
console.log('PASS: shared API/AI/socket/media URLs, auth headers, invalid API response and Vercel build configuration checks. No remote mutations.');
