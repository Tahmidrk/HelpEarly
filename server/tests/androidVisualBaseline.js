const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const parser = require('../../mobile/node_modules/@babel/parser');
const traverse = require('../../mobile/node_modules/@babel/traverse').default;
const root = path.resolve(__dirname, '../..');
const baseline = require('../../docs/test-results/android-parity-baseline.json');
const clean = node => JSON.parse(JSON.stringify(node, (key, value) => ['start', 'end', 'loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key) ? undefined : value));
function visual(source, liveCategories = false) {
  const nodes = [];
  traverse(parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }), {
    JSXElement(p) { if (!p.findParent(parent => parent.isJSXElement() || parent.isJSXFragment())) nodes.push(clean(p.node)); },
    JSXFragment(p) { if (!p.findParent(parent => parent.isJSXElement() || parent.isJSXFragment())) nodes.push(clean(p.node)); },
    CallExpression(p) { if (p.node.callee.object?.name === 'StyleSheet' && p.node.callee.property?.name === 'create') nodes.push(clean(p.node)); },
  });
  // Approved data-source change only: the unchanged Home category picker reads
  // live categoryNames instead of its seven hardcoded names. Layout/style stays exact.
  const normalize=value=>{
    if(!value || typeof value!=='object')return value;
    if(liveCategories && value.type==='ArrayExpression' && value.elements?.map(v=>v?.value).join(',')==='Cleaning,Plumbing,Electrical,Gardening,Babysitting,Moving,Cooking')return {type:'Identifier',name:'categoryNames'};
    for(const key of Object.keys(value))value[key]=Array.isArray(value[key])?value[key].map(normalize):normalize(value[key]);return value;
  };
  return nodes.map(normalize);
}
const changed = [];
let screens = 0;
for (const [file, hash] of Object.entries(baseline.files)) {
  if(file==='mobile/src/screens/AdminDashboardScreen.js') { assert(!fs.existsSync(path.join(root,file)),'Mobile admin screen must be removed');continue; }
  const bytes = fs.readFileSync(path.join(root, file));
  const current = crypto.createHash('sha256').update(bytes).digest('hex');
  if (current !== hash) changed.push(file);
  if (/^mobile\/src\/(screens|components)\//.test(file) && file.endsWith('.js')) {
    const old = execFileSync('git', ['show', `${baseline.commit}:${file}`], { cwd: root, encoding: 'utf8' });
    assert.deepEqual(visual(bytes.toString(),file==='mobile/src/screens/HomeScreen.js'), visual(old,file==='mobile/src/screens/HomeScreen.js'), `Android JSX or styles changed: ${file}`); screens++;
  } else if (file === 'mobile/App.js') {
    require('./androidNavigationBaseline')();
  } else if (file === 'mobile/.env.production.example') {
    const old = execFileSync('git', ['show', `${baseline.commit}:${file}`], { cwd: root, encoding: 'utf8' });
    assert.equal(bytes.toString().replace(/\r\n/g, '\n'), old.replace(/\r\n/g, '\n').replace(/^EXPO_PUBLIC_API_URL=$/m, 'EXPO_PUBLIC_API_URL=https://helpearly-api.onrender.com'), 'Only the reviewed Render API URL may change in the Android production template');
  } else if (file === 'mobile/app.config.js') {
    const old = execFileSync('git', ['show', `${baseline.commit}:${file}`], { cwd: root, encoding: 'utf8' });
    assert.equal(bytes.toString().replace(/\r\n/g, '\n'), old.replace(/\r\n/g, '\n').replace('const projectId=process.env.EAS_PROJECT_ID;', 'const projectId=process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;'), 'Only the linked project ID fallback may change in dynamic Android config');
  } else if (file === 'mobile/app.json') {
    const old = JSON.parse(execFileSync('git', ['show', `${baseline.commit}:${file}`], { cwd: root, encoding: 'utf8' }));
    const currentConfig = JSON.parse(bytes);
    assert.equal(currentConfig.expo.owner, 'tahmid_041');
    assert.deepEqual(currentConfig.expo.extra, { eas: { projectId: 'af6f6973-68c9-4e56-af9f-1e8896877b9d' } });
    delete currentConfig.expo.owner;
    delete currentConfig.expo.extra;
    assert.deepEqual(currentConfig, old, 'Only the linked EAS owner/project metadata may change; Android UI settings remain identical');
  } else if (file === 'mobile/eas.json') {
    const old = JSON.parse(execFileSync('git', ['show', `${baseline.commit}:${file}`], { cwd: root, encoding: 'utf8' }));
    const currentConfig = JSON.parse(bytes);
    for (const profile of ['preview', 'production']) {
      assert.deepEqual(currentConfig.build[profile].env, { EXPO_PUBLIC_API_URL: 'https://helpearly-api.onrender.com' });
      delete currentConfig.build[profile].env;
    }
    assert.deepEqual(currentConfig, old, 'Only the verified API build environment may change; signing, profiles and Android visuals remain unchanged');
  } else if (!file.startsWith('mobile/src/context/')) assert.equal(current, hash, `Android navigation/config/assets/dependencies changed: ${file}`);
}
const result = { executed_at: new Date().toISOString(), baseline: baseline.commit, status: 'PASS', tracked_files: Object.keys(baseline.files).length, visual_modules: screens, changed_internal_files: changed, screenshot_comparison: 'NOT RUN: no connected Android device/emulator. Source comparison does not verify rendered pixels.' };
require('./androidCategoryBaseline')();
fs.writeFileSync(path.join(root, 'docs/test-results/android-parity.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`PASS: ${screens} ordinary Android screen/component JSX and styles match baseline; ordinary navigation rendering, assets and dependencies preserved. Admin-only screen removed. ${changed.length} tracked files changed. Physical screenshots NOT RUN.`);
