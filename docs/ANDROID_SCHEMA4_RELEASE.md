# HelpEarly Android physical-test fix release

October 11, 2026. This release implements the approved physical-test bug batch; it does not begin branding. Existing website, backend, PostgreSQL, private media bucket, Firebase project, Expo project, package and signing identity are retained.

## Actual release state

- **PASS / DEPLOYED:** exact approved schema 4 migration, SHA-256 `c51486f2b9865480c4cbf417b44b582532eca87e3af7802839b4a71ae65b7d46`.
- **PASS:** immediately preceding production backup and isolated restore, migration, repeatability, transaction rollback and guarded committed rollback. Backup: `H:/apps/HelpEarly-backups/android-role-2026-10-11T16-10-52-017Z`. All 23 tables and 5 media objects verified.
- **PASS / DEPLOYED:** existing Render service `helpearly-api`, commit `7d7b3bb7cf9584bc3987e0add3e5e7a2e04abe77`, deployment `dep-db5rrctckfvc73b7v670`. Actual `/api/ready` returns schema 4. An additional minimal diagnostic correction replaces a stale hardcoded readiness label with the result of the real schema assertion. Isolated regression suite rerun PASS.
- **PASS / DEPLOYED:** existing Vercel project `client`, deployment `dpl_2HjaCaJcU8J1VABFEcqpiZhbC5Bk`. Primary `https://atyour-service.vercel.app`; secondary `https://client-sigma-dun-96.vercel.app`. Both domains serve the exact production JavaScript built from reviewed source with the existing production VITE settings. Production JS `index-CxquVejz.js`. Initial local comparison used different VITE settings; rebuilding with private production settings resolved the comparison without changing application behavior.
- **PASS:** real authenticated HTTPS/WSS, wrong-role handshake/REST/optional-auth denial, non-admin denial, private relationship contact search, persisted shared booking IDs after fresh login, live signed private-media downloads, two-way saved chat and actual socket event, reconnect and missed-update revision recovery, impossible-date/invalid-coordinate rejection, real Gemini answer/history and worker isolation, allowed origins and hostile-origin CORS denial.
- **PASS:** current Web Admin owner session loads the deployed dashboard. Reversible activation/deactivation of only labeled release accounts 53/54 produced four durable successful audits attributed to the existing administrator. Both accounts returned inactive; synthetic worker remains unavailable. No real emergency broadcast or ordinary-account action performed.
- **PASS:** post-release comparison against a fresh isolated restore proves zero original rows deleted and zero ordinary original business fields changed. Approved notification audience backfill, monotonically advancing sync metadata, and explicitly labeled release-chat/read-state/test-account timestamps are documented exceptions. Original 5 media SHA-256 hashes unchanged. All 23 tables retain RLS and direct consumer grants remain absent. New trigger EXECUTE denied to anon/authenticated.
- **PASS:** all 9 legacy conversations assigned deterministically and preserved. Four old dual-role AI messages remain stored with unassigned audience and hidden from current role histories; their previous active role cannot be inferred safely.
- **IMPLEMENTED / UNVERIFIED:** physical Android keyboard/safe-area behavior, native map/geocoder/date-picker interactions, six-tab touch/readability, hardware Back, foreground/background push display and notification tap destinations. Component/API/export tests are not physical-device evidence.

## Android preview

One build authorized and submitted: `33b26760-f472-404d-be17-0be745ce7144`, profile `preview`, existing Expo project `af6f6973-68c9-4e56-af9f-1e8896877b9d`, package `com.atyourservice.app`, source commit `7d7b3bb7cf9584bc3987e0add3e5e7a2e04abe77`.

Build uses an isolated clean snapshot of the committed source. Archive scan passed: private settings, signing files, Firebase service-account key and unrelated local files excluded. Existing EAS secret file variable supplies the Firebase Android client configuration. No extra project, paid plan or replacement signing identity created.

**PASS / BUILT AND VERIFIED:** `H:/apps/HelpEarly-artifacts/HelpEarly-preview-physical-fixes-20261011.apk` (83,785,090 bytes), SHA-256 `dda2074d10edd8d14fed01c1dff7ef9e7059d59c270b4ec59b4397df90c07385`. Remote native Gradle build succeeded; signed artifact downloaded and independently verified. APK v2 signature matches the existing signing certificate; package `com.atyourservice.app`, non-debuggable release, native Firebase app/project/sender resources, actual Render URL, ZIP CRC and all-entry known-private-credential scan passed. Actual APK bytecode includes the approved date-picker, service-area confirmation and role-section strings; compiled DEX includes the native date-picker module; manifest includes notification/location permissions and Android adjustResize. Three old Admin Dashboard screen markers are absent. Source navigation/admin-removal checks also passed. These checks do not prove physical rendering or push display.

Artifact and private-backup hashes match. Detailed evidence: `docs/test-results/android-physical-fixes-preview-build.json`. Installation page: `https://expo.dev/accounts/tahmid_041/projects/at-your-service/builds/33b26760-f472-404d-be17-0be745ce7144`. Older `HelpEarly-preview-admin-free-20261011.apk` does not include these fixes and must not be represented as the updated candidate. Install the new preview over the old app using the retained package/signing key. This is a functional-test preview, not the final branded APK.

## Tests and practical limits

**PASS:** actual isolated PostgreSQL MVP/security/admin/audit/session/concurrency/outbox/API-module synchronization/restart tests, eight Android backend regression groups, actual Android/Web component tests with explicitly simulated boundaries, preserved StyleSheet/asset/signing checks, production Web build, configuration checks, Hermes export, Expo Doctor 21/21 and Git whitespace/credential scans. Full backend suite rerun after readiness correction.

Gemini live response and authenticated persisted history passed. Push backend/EAS FCM configuration retained; previous provider receipts are not proof of display on the new APK. Render Free sleep may delay notification dispatch until the service wakes. Physical results remain **NOT RUN**.

Dependency findings remain: server 0; Web 1 high/3 moderate; mobile 16 high/8 moderate; zero critical. Proposed upgrades/downgrades break the approved Expo/RN/Vite/Router compatibility scope; no forced upgrades applied. This university preview is not a certification of commercial release readiness.

## Phone gate

Install the updated preview over the old app, then follow the ordered checklist in `ANDROID_PHYSICAL_FIXES.md`. Record model/Android version and actual PASS/FAIL for keyboard/save actions, gesture/three-button insets, header/hardware Back, six tabs/sections, role isolation, Web↔Android chat/booking/reconnect, calendars, confirmed service-area maps, complaint history, and foreground/background/locked-screen push arrival and tap routing. Use consenting test accounts; do not broadcast a test emergency to unrelated workers. Keep passwords and push tokens private.

Branding and the final branded APK remain unstarted. No further EAS build is planned until these phone results identify a real blocker or branding is separately approved.

## Backup and rollback

Preserve the verified pre-migration directory, existing protected signing backup, old APK, new APK and its hash/signature report. Source changes are committed and pushed to existing `Tahmidrk/HelpEarly` main; unrelated local files remain untouched and unstaged.

Previous Vercel production deployment: `https://client-flmckiism-tahmidrk758-3108s-projects.vercel.app`; previous Render deployment: `dep-db5nqrid0e5s7383qsv0`. Approved schema rollback file: `supabase/rollback/20261011143253_android_role_isolation.sql`. It retains new columns/history and refuses rollback after opposite-role conversation pairs exist. Prefer a reviewed fix forward once schema 4 data is written; do not collapse conversations or restore the old dump over newer records. Production rollback/migration/deployment requires separate explicit authorization.

## Evidence

`android-production-migration.json`, `android-role-backup-restore.json`, `android-fixes-live.json`, `android-fixes-preservation.json`, `android-physical-fixes-preview-build.json`, `android-fixes-release.json`, `free-stack.json` and the Android component/backend/visual/Web component evidence under `docs/test-results`. Full 20-group implementation and modified-file hashes: `ANDROID_PHYSICAL_FIXES.md` and the release manifest.
