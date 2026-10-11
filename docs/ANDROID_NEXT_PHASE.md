# HelpEarly Android, AI and synchronization checkpoint — October 11, 2026

## Current result

Latest signed **FCM-configured preview** APK is available at `H:/apps/HelpEarly-artifacts/HelpEarly-preview-FCM-20261011.apk` (82,325,365 bytes). This is a testing build, not the final branded release. It uses the existing HTTPS Render backend and preserves the approved Android screens, navigation, assets, app name and styling. The earlier APK at `HelpEarly-preview-20261011.apk` is retained for comparison but lacks Firebase Android configuration; use the new FCM APK for testing.

Second functional preview build `dcf6a4bd-1d56-447b-b131-6c8d6b471d3c` succeeded with the actual Firebase Android file supplied through EAS. Official APK signature verification passed with the existing signing identity; compiled Firebase app/project/sender resources match the real local file. ZIP integrity, packaged Render URL, private backup hash and all-entry known-secret checks passed. The owner-supplied FCM V1 service-account key is stored outside Git, assigned to `com.atyourservice.app` in EAS, and passed real Google authentication plus FCM validation-only requests (both HTTP 200). No notification was delivered by that validation. Physical notification and Android/Web tests remain NOT RUN.

Latest APK SHA-256: `8019e0da86bb4902f7695acae4173e7e18be34f43c71c68dc2e6e0593efb4903`. Build completed October 11 at 13:25 Dhaka. Source base `dc61d0681ee4555643b98fcf035372d3afc2565f` had documentation/evidence changes; Firebase file was injected through the EAS secret file variable. Fingerprint `442af21a32a55f2846aafa228c41e30e8837230a`. Evidence: [actual APK checks](test-results/android-fcm-preview-build.json), [EAS success](test-results/expo-fcm-preview-succeeded-20261011.png).

New [web-only admin roadmap](WEB_ADMIN_ROADMAP.md) is planned before branding. This preview still contains the existing Android admin dashboard; its removal and expanded web administration have not been implemented or tested.

Approved Render `PUSH_ENABLED=true` configuration-only deployment `dep-db5jh2l9fdbs73d3sad0` is LIVE on unchanged backend commit `9671e4862820df85bce27a1a91f53c278186e7b1`. The saved flag was verified through the dashboard; `/api/ready` returned HTTP 200/schema 2 and unauthenticated notification access returned 401. No FCM private key is stored in Render: the existing durable dispatcher uses Expo, whose FCM credential is held in EAS. No production records, schema or website deployment changed. Proof: [live deployment](test-results/render-push-deployed-20261011.png), [saved push flag](test-results/render-push-enabled-20261011.png).

- Existing website: https://atyour-service.vercel.app/ (Vercel project `client`, unchanged during this phase).
- Existing API: https://helpearly-api.onrender.com (Render Free service `helpearly-api`).
- Existing database/private media: Supabase `at-your-service`, unchanged schema and existing records.
- Expo: `@tahmid_041/at-your-service`, UUID `af6f6973-68c9-4e56-af9f-1e8896877b9d`; Free plan, no billing upgrade.
- Firebase project created by owner: `AtYourService` / `atyourservice-24d4c`; Spark verified when accessed. Existing package `com.atyourservice.app` registered as `HelpEarly Android`. Owner-supplied `google-services.json` is installed locally, package-checked and uploaded as an EAS secret file variable for preview and production. Console access is restored, and Firebase Cloud Messaging API (V1) is verified enabled. FCM V1 service-account key is uploaded and assigned in EAS; it is absent from application source/build archive.

## Real AI

Owner confirmed the existing Gemini project is free/no billing and approved storing its existing key in Render. Configuration-only deploy `dep-db5ang2jnfac739qp48g` succeeded using the existing backend commit `9671e4862820df85bce27a1a91f53c278186e7b1`. No backend code, database or website redeployment was needed.

Real `gemini-3.6-flash` generation passed. The live authenticated API returned names present in Supabase Electrical worker records and booking guidance. Actual Web and Android API modules read identical saved AI history. Separate household/worker accounts could not read each other's histories; logout/login retained history. Both active roles of one dual-role account share that account's history. Existing marketplace rows were fingerprinted before/after, probe accounts cleaned, and original records preserved.

An initial live probe returned 503; the next probe passed. Its initial cause was not captured, so AI availability is not guaranteed. Controlled provider quota, non-OK response, empty reply and timeout tests passed using a mocked provider and real isolated SQL. No failed-answer history or provider secrets were returned. We did not exhaust a real provider quota intentionally.

Evidence: [live AI](test-results/ai-production-next.json), [direct provider](test-results/gemini-provider-next.json), [AI deployment proof](test-results/render-ai-deployed-20261011.jpg).

## Earlier preview APK evidence

Build `1d3a2f1e-35fa-4ae6-a126-4924211fabc1` succeeded in EAS on October 11, 03:38 Dhaka time. Profile `preview`, internal distribution, Expo SDK 57, Android package `com.atyourservice.app`, app version `1.0.0`, versionCode `1`. Native Gradle build, remote Expo doctor, credential preparation and artifact upload ran successfully.

Build source was base commit `32a7e2bf4ecb5403aeee0efc63de104e98317c9d` **with uncommitted EAS/API configuration**. EAS fingerprint `309ff1615cea10a3b0567a8bc669bd2aa7c582d8` and inspected local upload archive preserve that distinction. Do not represent the base commit alone as the complete APK source.

Official Android SDK `apksigner verify` passed the APK v2 signature. Certificate SHA-256 `90cb140d12144596e8287484c2fec5d6d117e0048772350abbda3dcf9699ca33` matches the EAS keystore. Official `aapt` confirmed release mode, preserved display name `At Your Service`, min SDK 24, target SDK 36, and four native architectures. ZIP CRC passed. The **actual packaged Hermes bytecode** contains the verified Render URL and no known backend credentials.

APK SHA-256: `82ed0ab5f2b45ef38b980646cf8c7b99b350fe12733aa57dcc3bef07b81dc504`.

Evidence: [build/signature/package checks](test-results/android-preview-build.json), [build screenshot](test-results/expo-preview-succeeded-20261011.jpg), [archive/JavaScript export checks](test-results/preview-materials.json). No physical installation or rendered phone screenshot was executed.

## Executed checks

| Check | Actual result / scope |
| --- | --- |
| Database-backed MVP | PASS: 14 groups on a suite-created local PostgreSQL database |
| Authorization, transactions, concurrency, notification outbox | PASS: 20 isolated groups |
| Two-way Web/Android client protocols | PASS: profiles, booking/lifecycle, proposals, chat, emergencies, reviews, complaints, notification read state and AI history |
| Offline/reconnect/missed updates | PASS: protocol retry/revision tests; authenticated Socket.IO hints/origin isolation; database state survives API/worker restart |
| Android foreground refresh | PASS in synchronizer tests; actual OS background/foreground transitions NOT RUN |
| Web production build | PASS: 104 modules with verified Render API/socket settings; artifact `index-DI4o7ysn.js` matches deployed filename |
| Android export | PASS: 1,050 modules / Hermes; native APK build also passed separately |
| Local Expo doctor | PASS: 21/21 checks |
| Android visual source preservation | PASS: 15 screen/component JSX/style modules; navigation/assets/dependencies unchanged; only EAS/API config additions permitted |
| Static source parsing | PASS: 103 JS/JSX files; narrow parser/undeclared-reference check, not full lint/type validation |
| Preview config fixtures | PASS: linked project fallback, invalid override, missing/mismatched Firebase file and wrong API checks |
| Live shared Supabase AI | PASS through actual Web/Android API modules with simulated native session bindings |
| Real Android/Website physical synchronization | NOT RUN; phone required |
| Live emergency broadcast | NOT RUN on production: avoids alerting existing workers with fake emergencies; isolated lifecycle/concurrency tests PASS |
| Real FCM credential/API validation | PASS: Google OAuth 200 and FCM HTTP v1 200 with `validate_only`; no message delivered |
| Real Expo push tickets/receipts and phone presentation | NOT RUN; installed/registered phone required |

Details: [free stack](test-results/free-stack.json), [two-way tests](test-results/next-phase-protocol.json), [visual source baseline](test-results/android-parity.json). Protocol tests do not establish that phone UI renders or that Android delivers background notifications.

## Dependency audit

Actual `npm audit` snapshots: backend **0** advisories; web **4** (3 moderate, 1 high); mobile **23** (8 moderate, 15 high). No dependency or lockfile changed. Web Vite/esbuild/React Router remediation requires major-version migration. Mobile audit's automatic plan proposes incompatible Expo/RN changes; remaining braces/node-forge issues lack patched versions, and changing uuid under xcode would change major compatibility assumptions. No forced downgrade or speculative override was applied.

Keep these as release limitations, not a claim of complete commercial security. Raw audit snapshots remain outside the repository in `H:/apps/HelpEarly-test-tools/*-audit-next.json`. Primary advisories: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Reassess vendor patches before a commercial release.

## Remaining FCM actions

Android configuration update: local preflight passed all four checks; app configuration resolves `./google-services.json`; Git ignores the file. EAS lists `GOOGLE_SERVICES_JSON` as project-scoped, type file, visibility SECRET, environments preview and production. After FCM credentials became ready, exactly one additional preview build was submitted. No UI, dependency or business-logic changes were needed. Evidence: [Firebase configuration checks](test-results/firebase-android-config.json), [real FCM credential validation](test-results/fcm-credential-validation.json). Firebase's documented `validate_only` mode tests permission/request acceptance without delivering a message: [official REST reference](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send).

1. Owner opens the existing `AtYourService` Firebase project. Confirm actual ID `atyourservice-24d4c` and Spark. No second project, Firestore, Firebase Auth, Storage, Functions or billing setup is needed.
2. DONE: owner supplied the downloaded Android file; it is placed at ignored `H:/apps/HelpEarly/mobile/google-services.json`, with matching source/destination hash and package `com.atyourservice.app`.
3. DONE: Project settings → Cloud Messaging reports Firebase Cloud Messaging API (V1) enabled. Legacy FCM remains disabled and is unnecessary. Evidence: [FCM API status](test-results/firebase-fcm-v1-enabled-20261011.png).
4. DONE: owner generated/downloaded the key; its verified exact copy is outside Git at `H:/apps/HelpEarly-test-tools/fcm-service-account.json`, with a matching private backup. No key contents were printed or committed.
5. DONE: Firebase project matches both files; private RSA signing/verification passed. Prefer a dedicated account restricted to Firebase Cloud Messaging API Admin for commercial operation; the broad Firebase Admin SDK account must be restricted/reviewed before commercial use. Its existing FCM permission passed a real validation-only request without changing IAM grants.
6. DONE: Android file uploaded to preview/production; FCM V1 key assigned to the same app identifier in EAS. Private FCM key, signing keys and backend secrets were excluded from the source archive. Local preflight passed; native device registration/delivery remains a separate test.
7. DONE: one new preview build `dcf6a4bd-1d56-447b-b131-6c8d6b471d3c` succeeded, reusing the existing signing key and API. Real Firebase resources, release package, APK signature, integrity and known-secret exclusion passed. First APK's missing native Firebase config cannot be fixed merely by changing server settings.
8. DONE: owner-approved `PUSH_ENABLED=true` is saved and deployed LIVE on the same backend commit. Read-only Supabase preflight found zero push devices and zero eligible queued deliveries; no database records changed. See [preflight](test-results/push-enable-preflight.json). Optional enhanced Expo push security remains a separate deliberate credential setup.
9. Install/test on a physical phone. Confirm authenticated device registration, live push ticket/receipt, foreground/background handling and correct tap destination. Provider receipt `delivered` is not proof that a phone displayed the notification.

See [official FCM setup](https://docs.expo.dev/push-notifications/fcm-credentials/) and [official Expo pricing](https://expo.dev/pricing). Use Free allowance only; stop if a paid plan/card is requested.

## Backups and next gates

APK plus signing JKS/credential metadata backed up privately in `H:/apps/HelpEarly-backups/android-signing-20261011`. Keystore hash matched the local ignored copy; APK copy hash matched the downloaded artifact. Keep signing credentials encrypted/offsite separately from source, never in Git. Retain the existing verified Supabase production backup/restore drill and Vercel rollback deployment. No new production DB migration occurred.

Use [phone checklist](ANDROID_PHONE_TEST.md). Branding audit/proposal remains deferred until functionality/device gates are complete and owner explicitly approves beginning that separate phase. No new logo, icon, colors, screen redesign, final APK, Play submission or AAB was produced. Future final APK must reuse this signing identity after approved branding and regression/physical tests; production AAB profile is prepared but unexecuted.
