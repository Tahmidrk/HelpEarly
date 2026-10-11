// Read-only readiness check. Never print credentials or create signing keys.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = require('../app.json').expo;
const preview = require('../eas.json').build.preview;
const api = process.env.EXPO_PUBLIC_API_URL || preview.env.EXPO_PUBLIC_API_URL;
const checks = {
  previewAPK: preview.android.buildType === 'apk' && preview.distribution === 'internal',
  verifiedAPI: api === 'https://helpearly-api.onrender.com',
  easProject: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || ''),
  firebaseAndroid: false,
};
const googleFile = process.env.GOOGLE_SERVICES_JSON || path.join(root, 'google-services.json');
if (fs.existsSync(googleFile)) {
  const google = JSON.parse(fs.readFileSync(googleFile, 'utf8'));
  checks.firebaseAndroid = !!google.project_info?.project_id &&
    google.client?.some(client => client.client_info?.android_client_info?.package_name === config.android.package) === true;
}
console.log(JSON.stringify({ checks, signing: 'Verify existing EAS keystore before building; this check does not confirm signing or FCM service-account upload.', device: 'Physical notification delivery remains a separate test.' }, null, 2));
if (Object.values(checks).some(value => !value)) process.exitCode = 1;
