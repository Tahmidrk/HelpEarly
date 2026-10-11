const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../mobile');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'helpearly-preview-check-'));
const file = path.join(directory, 'google-services.json');
function run(env) {
  const result = spawnSync(process.execPath, ['scripts/checkPreview.cjs'], {
    cwd: root, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, EAS_PROJECT_ID: '', GOOGLE_SERVICES_JSON: file, EXPO_PUBLIC_API_URL: '', ...env },
  });
  return { status: result.status, report: JSON.parse(result.stdout) };
}
try {
  const missingFile = run({});
  assert.equal(missingFile.status, 1);
  assert.equal(missingFile.report.checks.easProject, true, 'Uses the real project linked in app.json without requiring duplicate local settings');
  fs.writeFileSync(file, JSON.stringify({ project_info: { project_id: 'isolated-fixture-only' }, client: [{ client_info: { android_client_info: { package_name: 'wrong.package' } } }] }));
  const fixture = { EAS_PROJECT_ID: '11111111-1111-4111-8111-111111111111' };
  assert.equal(run(fixture).report.checks.firebaseAndroid, false);
  fs.writeFileSync(file, JSON.stringify({ project_info: { project_id: 'isolated-fixture-only' }, client: [{ client_info: { android_client_info: { package_name: 'com.atyourservice.app' } } }] }));
  assert.equal(run(fixture).status, 0);
  assert.equal(run({ ...fixture, EXPO_PUBLIC_API_URL: 'http://localhost:5000' }).status, 1);
  assert.equal(run({ EAS_PROJECT_ID: 'invalid' }).status, 1);
  console.log('PASS preview preflight uses linked EAS project and rejects missing Firebase config, invalid project override, mismatched Firebase package and wrong API; isolated fixture success does not confirm live signing/FCM.');
} finally {
  fs.unlinkSync(file);
  fs.rmdirSync(directory);
}
