# HelpEarly centralized Web-only administration — local completion

October 11, 2026. **LOCAL IMPLEMENTATION: PASS. PRODUCTION MIGRATION: PASS after explicit approval. BACKEND/WEB DEPLOYMENT: IN PROGRESS.**

Actual source, SQL and tests are implemented. The local implementation did not change live services. After separate user approval, a fresh backup/restore passed and the exact schema-3 candidate was committed at 11:37 UTC. All original records were preserved. Backend/web deployment is in progress; no updated APK or physical-device result is claimed yet. Existing Firebase, Gemini and EAS/signing settings are preserved.

## Implemented functionality

- **PASS — Web administration:** existing React dashboard now has Overview, Accounts, Workers, Categories, Services, Bookings, Jobs, Proposals, Emergencies, Complaints, Reviews and Audit log. All data comes from Express/PostgreSQL. Search, bounded pagination, role/account/status filters, loading/empty/error states, retry, editors and in-page confirmations are implemented. Canceling a confirmation makes no backend mutation. Errors remain visible; buttons recover from failed requests.
- **PASS — Accounts:** search/filter accounts; activate/deactivate; change supported roles; self-deactivation/demotion blocked; worker roles require an existing worker profile. Account changes disconnect current personal Socket.IO connections; backend authorization rechecks database state on requests/reconnect. Passwords, NID, phone/location and unrelated private histories are excluded from admin account read models.
- **PASS — Workers:** verify/unverify; moderate bio and availability; inspect real profile, experience/rate and services. Verification and moderation produce durable affected-user notifications. Admin service moderation does not rewrite prices.
- **PASS — Categories/services:** create/edit categories; hide/show categories; edit service names/descriptions and hide/restore services. Category names reject case-insensitive duplicates. Visible category lists drive discovery and existing Android selectors. Hidden relationships and historical records remain stored.
- **PASS — Monitoring:** bookings, jobs, proposals and emergencies have real paginated/filterable tables. Emergency expiry is derived from timestamps and can be filtered as `expired`; no emergency architecture rewrite. Booking/proposal/emergency histories and financial fields are read-only in administration.
- **PASS — Complaints/moderation:** complaint subject/details, notes and validated status changes; job/review visibility can be hidden/restored. Existing rows, review scores and historical relations are preserved. Published worker ratings exclude hidden reviews. Complaint decisions and moderation use the durable notification inbox/outbox.
- **PASS — Statistics:** real users/workers/bookings/completed services/jobs/proposals/complaints/reviews/emergencies/dual accounts and completed payments. Filtered totals are computed with the same filters as their rows.
- **PASS — Android removal in current source/export:** `AdminDashboardScreen` deleted; imports, navigation selection, admin colors/icons and management controls removed. Admin login/restored sessions/refresh receive a Web-only administration error. Ordinary household, worker, both-role modes and signed-out navigation retain their existing output.
- **PASS — Ordinary Android source baseline:** 14 screen/component JSX/style baselines match. All seven original category icons/order are explicitly compared against the preserved baseline. Only the Home picker’s exact hardcoded category-data expression is normalized to its authoritative data source; style/layout differences are not ignored. New/hidden categories naturally change the available data, without a branding redesign.
- **IMPLEMENTED/UNVERIFIED — Physical Android pixels, gestures, resume/background behavior and FCM delivery:** no connected phone/emulator was tested. Source comparison and Android export do not establish these results.

## Security and durable audit

**PASS — Backend permission enforcement.** Every central admin route requires an authenticated database-authorized administrator; client headers/JWT role claims cannot grant administration. Ordinary registration/profile editing cannot promote accounts. Inputs use allowed-field/status/role lists and parameterized SQL; monitor resources come from a fixed whitelist. Existing complaint-update compatibility route uses the same audited handler.

**PASS — Self-lockout/last-admin safeguards.** API prevents self-disable/demotion and disables hard deletion of users/jobs/reviews. Transactions serialize account changes, recheck the acting administrator and use database last-active-admin protection. Actual concurrent API and direct SQL demotion races retained an active administrator under READ COMMITTED and REPEATABLE READ. Direct SQL last-admin deletion/deactivation was rejected.

**PASS — Audit durability and failure handling.** `admin_audit_logs` records actor ID, action, target, timestamp, request ID and SUCCESS/REJECTED/DENIED/FAILED. Successful mutations and their audit rows commit together. Authenticated non-admin denials/rejected mutations are logged; raw request bodies, passwords, keys and private record contents are not. Anonymous requests rejected before authentication are not represented as identified admin actors. Real database audit-write failure returned 503 and rolled back the account mutation.

**PASS — Append-only/application access.** UPDATE/DELETE/TRUNCATE of audit rows is blocked by a database trigger. RLS is enabled with no public policies; PUBLIC/anon/authenticated table, sequence and new administrative function grants are revoked in the candidate. Ordinary non-owner database roles cannot access the application tables/functions. Audit actor IDs remain historical even if a separately authorized account removal occurs. Database owners/superusers can alter database objects; this is not a claim of cryptographic or superuser-proof tamper resistance.

**PASS — Data minimization.** Dashboard monitors exclude unrelated messages/AI history, identity documents, credentials, booking contact/address details and emergency exact-location/contact data. Complaint text and worker/service descriptions remain available because those records are the subject of moderation; they are not copied into audit payloads.

## Synchronization and regressions executed

**PASS — Real isolated PostgreSQL/Express integration.** `npm run test:free` creates its own local database from a legacy schema replica and synthetic records, starts the actual backend, and removes its own database afterward. Production is not the mutation target.

- **PASS:** 14 MVP groups: authentication, authorization, helper/category discovery without cleaner defaults, direct booking/lifecycle/overlap, real reviews, complaints, photo persistence, saved chat, proposal→booking, emergency lifecycle and relogin/database persistence.
- **PASS:** 20 authorization/concurrency/outbox groups, including role/private record isolation, booking idempotency/completed immutability, atomic proposal acceptance, emergency eligibility/concurrency/expiry/self-exclusion, device ownership, chat permissions, suspended account/socket protection, notification rollback/deduplication, upload validation and AI context privacy.
- **PASS:** 10 dedicated administration groups covering all admin resource queries, non-admin denial, forged-role rejection, filtering/privacy, moderation/discovery, affected-user notifications, suspension, concurrent admin safety, real audit-write failure rollback and audit immutability/persistence. Expired emergency monitor filtering also executed against PostgreSQL.
- **PASS:** 9 cross-platform workflow groups use the actual Web and Android API modules: profiles; Web job→Android proposal→Web acceptance→Android completion/review; reverse booking lifecycle; two-way chat, complaints, emergency state, notification read state, authenticated AI history and relogin.
- **PASS:** admin verification/category/service/complaint/moderation mutations reached both client API modules. Real authenticated Socket.IO hints and PostgreSQL revision changes were asserted. Suspension disconnected the actual socket and rejected REST and reconnect. Missing updates were recovered through authoritative reads without a socket; offline read retry/forced foreground refresh and process restart persistence passed.
- **PASS:** 11 actual React table component resources/actions, disabled self/busy controls, read-only monitors, empty states and HTML escaping.
- **PASS:** 9 actual React lifecycle/action groups against a separately disposable PostgreSQL API: all tabs load real rows; category save/cancel; backend validation error with no fabricated success; worker verify/unverify; complaint resolution/inbox; account deactivate/reactivate; reversible jobs/reviews; filtered zero-result count; persisted audit rows. Auth/sync/native focus boundaries use test bindings; backend successes are real HTTP/SQL results.
- **PASS:** final interactive browser verification against a fresh disposable PostgreSQL/Express fixture. All 11 tables loaded; category save/cancel/hide, worker verification, complaint notes/status, account suspension/restore, job/review hide/restore, role filters, empty results, Escape confirmation cancellation, real duplicate-category error recovery and immutable SUCCESS/REJECTED audit rows passed. An authenticated household opening `/admin` was redirected to login without administration controls. No production record was changed. Screenshots: `H:/apps/HelpEarly-artifacts/admin-local-browser-overview-20261011.png` and `H:/apps/HelpEarly-artifacts/admin-local-browser-audit-20261011.png`. This verifies browser behavior, not physical Android pixels.
- **IMPLEMENTED/UNVERIFIED:** paired physical Android/Web synchronization, native FCM delivery and foreground/background device transitions. Native Platform/AsyncStorage bindings in protocol tests are simulated; no phone evidence is fabricated.

AI provider error tests intentionally use a mocked provider with real PostgreSQL history/auth; Storage HTTP-contract tests use a mock provider. Those are explicitly not live Gemini/FCM/Storage delivery tests. Previously approved live Gemini/FCM configuration and the signed APK checkpoint remain intact; no new provider deployment was attempted here.

Machine-readable evidence: [admin/security](test-results/admin-local.json), [full isolated stack](test-results/free-stack.json), [two-way protocol](test-results/next-phase-protocol.json), [React tables](test-results/admin-components.json), [React with real API](test-results/admin-react-integration.json), [browser](test-results/admin-browser.json), [Android baseline](test-results/android-parity.json), [backup/restore](test-results/admin-backup-restore.json), [build/config checks](test-results/admin-builds.json), [modified-file manifest](test-results/admin-changed-files.json).

## Build/export and APK status

- **PASS — Web production build:** 104 modules; `H:/apps/HelpEarly/client/dist`, main `assets/index-mCm8owEo.js`; `VITE_API_URL=https://helpearly-api.onrender.com`.
- **PASS — Android export:** 1,050 modules; `H:/apps/HelpEarly-artifacts/admin-local-android-export-final-20261011`; bundle `_expo/static/js/android/index-32d784f487118d078c5d16c4142f0c9e.hbc`; production API supplied through `EXPO_PUBLIC_API_URL`.
- **PASS — Expo Doctor:** 21/21. Package identity `com.atyourservice.app`, app configuration, dependency lockfiles, icons, Firebase configuration and signing files remain unchanged in this phase.
- **PASS — Configuration tests:** shared API/Socket.IO/media/AI URLs and auth headers; production PostgreSQL verified TLS/session pooling; transaction pooling/disabled certificate validation rejected.
- **PASS — Production gate:** `node db/adminMigration.js` without `--approved` refused execution. Current production/remote startup is read-only and requires candidate schema 3 before this new API version can start.
- **PASS — Whitespace/staged credential scan:** recorded after final staging; environment files, FCM/signing material and actual credential values excluded.
- **BLOCKED — Newly signed preview APK with these admin changes:** no EAS build was requested/submitted to conserve the free allowance. Existing `H:/apps/HelpEarly-artifacts/HelpEarly-preview-FCM-20261011.apk` is signed but predates this phase and still contains its old admin UI. Android export is not an installable APK.

## Exact production migration — applied after approval

Candidate: [20261011073853_centralized_web_admin.sql](../supabase/migrations/20261011073853_centralized_web_admin.sql).

SHA256: `ea0e309dc292419a390a53c82c8e0f9a0d1d095da310ad11855b6ce8fd3a0e55`.

This candidate:

1. Adds `categories.is_visible=true`, and `helper_services.is_hidden=false`, `jobs.is_hidden=false`, `reviews.is_hidden=false` as non-null boolean defaults.
2. Adds one `admin_audit_logs` table, its actor/time index and sequence. Sets RLS and restricts direct consumer grants/new functions. Table count 22→23; no new Supabase project or database.
3. Adds append-only audit and last-active-admin protection functions/triggers; uses existing PostgreSQL users/roles and shared marketplace revisions.
4. Changes the genuine-review rating function to exclude hidden reviews; reconciles only derived helper rating/count values if they differ. Restored production data already matched: all original row hashes remained identical.
5. Adds admin revisions for categories, services, worker/category relationships, proposals, emergencies and audit; category changes also invalidate helper/job discovery.
6. Inserts schema version 3 while retaining version 2. No existing table/column/customer row is dropped, no user is seeded, no website is replaced and no financial/history rewrite is performed.

**PASS — Fresh production backup and isolated restore.** Snapshot taken/read-only verified October 11, 2026 at 08:07–08:08 UTC. Private directory: `H:/apps/HelpEarly-backups/admin-production-2026-10-11T08-07-31-832Z`. Files: `database.dump`, private original-column/row fingerprints, `media-manifest.json`, `uploads/`, `verification.json`, `RESTORE_VERIFIED`. Dump SHA256: `dc31494f7558e390d77702c010538916ed1e79671db8a2eaf79da3e31ceeb70f`.

The dump was restored into a new isolated local PostgreSQL database. Every original column/row hash matched. Candidate migration, transaction rollback to schema 2, committed migration, repeatability and audit RLS were verified. The extra schema version row is checked separately from preservation of original rows. Live before/after original fingerprints and schema 2 were unchanged. Private Storage inventory contained **0 objects**; no media object was invented or deleted. Database snapshot and object inventory are separate; there is no claim of atomic backup across both providers.

Preserved production counts include 31 users, 22 workers, 10 bookings, 12 jobs, 27 messages, 5 reviews, 2 complaints, 40 services and all 22 tables' original records. Re-run this backup/restore immediately before any future approved migration; this historical verification does not replace a fresh release-time gate. Private dumps/fingerprints contain personal records/password hashes and must remain outside Git and public artifacts.

## Approval, rollout and rollback plan

**PASS — Separate explicit approval received** for this exact schema/grant/trigger candidate and existing Render/Vercel deployments, conditional on a fresh verified backup/restore. That gate passed; migration committed with unchanged original row hashes. Evidence: [approved production migration](test-results/admin-production-migration.json). Fresh private backup: `H:/apps/HelpEarly-backups/admin-production-2026-10-11T11-35-29-059Z`; [fresh backup verification](test-results/admin-backup-restore.json) contains the current dump hash. The earlier 08:07 backup below remains a historical checkpoint.

After approval, the safe order is:

1. Warm/check the existing services; pause privileged admin edits during cutover. Re-run fresh production backup, isolated restore, exact candidate and rollback validation. Compare migration hash and current live schema/record inventory; abort if either differs.
2. Apply only the exact additive candidate in one transaction using the dedicated `server/db/adminMigration.js --approved` runner with privately injected existing production settings. Do not run the old general seed/migrator against production. Obtain any required account-access confirmation before the live action.
3. Verify schema 3, preserved records/media, restricted consumer grants and an active existing administrator. Deploy this tested API version to the existing Render service. Keep current environment/FCM/Gemini settings. Check `/api/ready`, auth, audit and synchronization before proceeding.
4. Deploy the prepared web build to the existing Vercel `client` project/domains. Retain the previous deployment for rollback. Perform supervised, labeled live admin workflow checks; do not delete historical data or silently change ordinary accounts.
5. Build one approved preview APK from the same source, existing package/signing identity and production API after backend/web checks. Execute the paired phone checklist below. No final branded APK until branding approval and regression/device testing.

**PASS — Pre-commit rollback:** tested SQL `ROLLBACK` restored schema 2, all original row hashes and absence of the new audit table in isolation. If any migration check fails before COMMIT, roll back and keep existing production code/deployments.

**IMPLEMENTED/UNVERIFIED — Post-commit operational recovery plan:** prefer a forward correction while retaining additive columns and audit/history. Stop admin edits and take a new backup first. Code rollback can use the retained Vercel deployment and prior Render commit `9671e4862820df85bce27a1a91f53c278186e7b1`; version 2 remains recorded for compatibility. Old code ignores moderation flags and has weaker admin controls, so restrict admin access operationally during recovery rather than presenting that rollback as a security fix. Test compatibility/visibility in isolation before executing it. Do not drop the audit table or restore an old dump over newer marketplace activity. Full database recovery requires separate approval, reconciliation of intervening writes and an isolated restore target. No post-commit production rollback was executed here.

## Physical Android/Web acceptance checklist

**IMPLEMENTED/UNVERIFIED — Execute on the newly built preview, not the older APK.**

1. Household/worker/both-role navigation, icons, category order and layouts match the approved ordinary UI. Android admin login/restored-session access fails clearly; there is no admin dashboard/navigation/control.
2. Web admin verifies a labeled worker; phone discovery/profile and durable inbox update. Disconnect/reconnect phone and repeat after foregrounding.
3. Web hides/restores a test category/service/job/review. Phone discovery/selectors reflect current visibility; saved bookings/photos/source review history remain intact. Check real derived ratings after review moderation.
4. Phone submits a labeled complaint; web admin resolves it with notes; phone shows the decision/inbox after reconnect and relogin.
5. Web deactivates/reactivates a consenting disposable test account. Existing phone token/socket access is rejected during suspension. Test admin self-lockout/last-admin rejection using isolated tests, never risk the only live administrator.
6. Run photo booking, photo job→proposal→acceptance, two-way chat, completion/review and one coordinated test emergency across phone/web. Check cold start, network loss and logout/login persistence.
7. Inspect audit actor/action/target/time/outcome for each admin action; ordinary users cannot retrieve admin logs/private monitors. Check FCM delivery and Gemini/history independently using the existing free configuration.

Branding remains **BLOCKED until explicit approval** and functional/device gates. No ordinary Android redesign was started.

## Modified files and repeatable local checks

Main implementation files: `server/controllers/centralAdminController.js`, `server/utils/admin.js`, `server/routes/admin.js`, audited complaint-route compatibility, `server/middleware/auth.js`, candidate SQL, migration/readiness code; `client/src/pages/AdminDashboard.jsx`, `client/src/utils/api.js`, authoritative Footer category links; `mobile/App.js`, `mobile/src/context/AuthContext.js`, deleted Android admin screen, authoritative category hook and data bindings in Home/Explore/Jobs/Register.

Public discovery/registration/service/job/booking/emergency/review/AI queries were adjusted only to honor administrative visibility. Existing lifecycle/concurrency/media/history behavior was covered by regression tests. Test files and documentation/evidence are listed in the complete [changed-file manifest](test-results/admin-changed-files.json). Unrelated pre-existing untracked scripts and `mobile/CLAUDE.md` were not staged or executed.

Run from `H:/apps/HelpEarly/server`: `npm run test:free`, `npm run test:config`, `node tests/androidVisualBaseline.js`. Run from `H:/apps/HelpEarly/client`: `node tests/adminComponents.cjs`, `npm run test:config`, and the production build with the Render API environment. Run from `H:/apps/HelpEarly/mobile`: Android export and `npx expo-doctor`. All were actually executed above.

For React lifecycle/real SQL tests, use two PowerShell terminals and a private test-tools directory containing the already installed `react@18.3.1` and `react-test-renderer@18.3.1`:

```powershell
# Terminal 1, repository root; server/.env must point to local PostgreSQL.
$env:ADMIN_FIXTURE_DIR='H:/apps/HelpEarly-test-tools'
node server/tests/adminUiFixture.js

# Terminal 2, client directory; only the disposable fixture URL is allowed.
$env:ADMIN_TEST_RUNTIME='H:/apps/HelpEarly-test-tools/node_modules'
$env:ADMIN_TEST_API_URL='http://127.0.0.1:5074/api'
node tests/adminDashboardIntegration.cjs

# Stop only this fixture, removing its own synthetic database/processes.
Set-Content -LiteralPath H:/apps/HelpEarly-test-tools/stop-admin-browser-fixture -Value stop
```

No production dependency or lockfile was changed for this test runtime. The disposable fixture uses documented synthetic credentials in its test code; they are not production credentials. Keep source/test evidence in the local Git checkpoint, the verified database backup privately, and preserve Firebase/signing/environment files in their existing ignored/private locations. Do not push/deploy this checkpoint automatically.
