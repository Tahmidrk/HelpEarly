const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const cwd=path.resolve(__dirname,'..');
const check="const p=require('./config/db');console.log(JSON.stringify({ssl:p.options.ssl}));p.end();";
const pooler='aws-0-ap-northeast-1.pooler.supabase.com';
for(const vars of [
  {DATABASE_URL:`postgres://audit:audit@${pooler}:6543/postgres`},
  {DATABASE_URL:'',DB_HOST:pooler,DB_PORT:'6543'},
]) {
  assert.throws(()=>execFileSync(process.execPath,['-e',check],{cwd,env:{...process.env,...vars},stdio:['ignore','pipe','pipe']}),error=>error.stderr.toString().includes('session-pooler connection'));
}
for(const vars of [
  {DATABASE_URL:`postgres://audit:audit@${pooler}:5432/postgres?sslmode=no-verify`},
  {DATABASE_URL:'',DB_HOST:pooler,DB_PORT:'5432'},
]) {
  const output=execFileSync(process.execPath,['-e',check],{cwd,env:{...process.env,...vars,DB_SSL:'true',DB_SSL_ALLOW_SELF_SIGNED:'false',DB_SSL_CA:''},encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.equal(JSON.parse(output).ssl.rejectUnauthorized,true);
}
console.log('PASS: URL and explicit-host Supabase transaction pooling rejected; session pooling verifies TLS despite URL overrides. No DB connections opened.');
for(const vars of [{DB_SSL:'false'},{DB_SSL:'true',DB_SSL_ALLOW_SELF_SIGNED:'true'}]) {
  assert.throws(()=>execFileSync(process.execPath,['-e',check],{cwd,env:{...process.env,DATABASE_URL:`postgres://audit:audit@${pooler}:5432/postgres`,NODE_ENV:'production',...vars},stdio:['ignore','pipe','pipe']}),error=>error.stderr.toString().includes('requires verified TLS'));
}
console.log('PASS: production refuses disabled TLS/certificate verification for remote PostgreSQL.');
