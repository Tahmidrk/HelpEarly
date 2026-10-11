# HelpEarly Android, AI and synchronization checkpoint — October 11, 2026

## Current result

Signed **preview** APK is available at `H:/apps/HelpEarly-artifacts/HelpEarly-preview-20261011.apk` (82,322,593 bytes). This is a testing build, not the final branded release. It uses the existing HTTPS Render backend and preserves the approved Android screens, navigation, assets, app name and styling. **This first APK does not include Firebase Android configuration; native FCM delivery is not ready.** In-app notifications and foreground synchronization remain available.

- Existing website: https://atyour-service.vercel.app/ (Vercel project `client`, unchanged during this phase).
- Existing API: https://helpearly-api.onrender.com (Render Free service `helpearly-api`).
- Existing database/private media: Supabase `at-your-service`, unchanged schema and existing records.
- Expo: `@tahmid_041/at-your-service`, UUID `af6f6973-68c9-4e56-af9f-1e8896877b9d`; Free plan, no billing upgrade.
- Firebase project created by owner: `AtYourService` / `atyourservice-24d4c`; Spark verified when accessed. Existing package `com.atyourservice.app` registered as `HelpEarly Android`. Latest console access fails, so configuration download and FCM key upload remain pending.

## Real AI

Owner confirmed the existing Gemini project is free/no billing and approved storing its existing key in Render. Configuration-only deploy `dep-db5ang2jnfac739qp48g` succeeded using the existing backend commit `9671e4862820df85bce27a1a91f53c278186e7b1`. No backend code, database or website redeployment was needed.

Real `gemini-3.6-flash` generation passed. The live authenticated API returned names present in Supabase Electrical worker records and booking guidance. Actual Web and Android API modules read identical saved AI history. Separate household/worker accounts could not read each other's histories; logout/login retained history. Both active roles of one dual-role account share that account's history. Existing marketplace rows were fingerprinted before/after, probe accounts cleaned, and original records preserved.

An initial live probe returned 503; the next probe passed. Its initial cause was not captured, so AI availability is not guaranteed. Controlled provider quota, non-OK response, empty reply and timeout tests passed using a mocked provider and real isolated SQL. No failed-answer history or provider secrets were returned. We did not exhaust a real provider quota intentionally.

Evidence: [live AI](test-results/ai-production-next.json), [direct provider](test-results/gemini-provider-next.json), [AI deployment proof](test-results/render-ai-deployed-20261011.jpg).

## Native APK evidence

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
| Real FCM tickets/receipts and phone presentation | NOT RUN; credentials and phone required |

Details: [free stack](test-results/free-stack.json), [two-way tests](test-results/next-phase-protocol.json), [visual source baseline](test-results/android-parity.json). Protocol tests do not establish that phone UI renders or that Android delivers background notifications.

## Dependency audit

Actual `npm audit` snapshots: backend **0** advisories; web **4** (3 moderate, 1 high); mobile **23** (8 moderate, 15 high). No dependency or lockfile changed. Web Vite/esbuild/React Router remediation requires major-version migration. Mobile audit's automatic plan proposes incompatible Expo/RN changes; remaining braces/node-forge issues lack patched versions, and changing uuid under xcode would change major compatibility assumptions. No forced downgrade or speculative override was applied.

Keep these as release limitations, not a claim of complete commercial security. Raw audit snapshots remain outside the repository in `H:/apps/HelpEarly-test-tools/*-audit-next.json`. Primary advisories: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Reassess vendor patches before a commercial release.

## Remaining FCM actions

1. Owner opens the existing `AtYourService` Firebase project. Confirm actual ID `atyourservice-24d4c` and Spark. No second project, Firestore, Firebase Auth, Storage, Functions or billing setup is needed.
2. Project settings → General → Your apps → `com.atyourservice.app`: download `google-services.json` to ignored `H:/apps/HelpEarly/mobile/google-services.json`. Browser download did not complete here; no file was fabricated.
3. Project settings → Cloud Messaging: confirm Firebase Cloud Messaging API (V1) is enabled. Legacy FCM is unnecessary.
4. Project settings → Service accounts: owner generates/downloads a private key and saves it outside Git as `H:/apps/HelpEarly-test-tools/fcm-service-account.json`. Never paste it into chat or mobile source. This requires owner interaction for credential creation; do not rotate existing keys or expand unrelated services.
5. Validate both files reference the same real Firebase project/package. Prefer a dedicated account restricted to Firebase Cloud Messaging API Admin for commercial operation; the broad Firebase Admin SDK account must be restricted/reviewed before commercial use.
6. In `mobile`, upload `GOOGLE_SERVICES_JSON` as a **file** variable in EAS preview/production, then upload the real FCM V1 service account through `npx eas-cli credentials --platform android` → Google Service Account → Push Notifications (FCM V1). Never put private service keys in `EXPO_PUBLIC_*` variables or the app archive. Run `node scripts/checkPreview.cjs`.
7. Generate a new preview APK with the Firebase Android file included, reusing the same signing key and API. First APK's missing native Firebase config cannot be fixed merely by changing server settings.
8. Obtain approval for the production Render push configuration/redeploy when credentials are ready. Do not enable live delivery prematurely. Optional enhanced Expo push security needs a private backend token and a separate deliberate credential setup.
9. Install/test on a physical phone. Confirm authenticated device registration, live push ticket/receipt, foreground/background handling and correct tap destination. Provider receipt `delivered` is not proof that a phone displayed the notification.

See [official FCM setup](https://docs.expo.dev/push-notifications/fcm-credentials/) and [official Expo pricing](https://expo.dev/pricing). Use Free allowance only; stop if a paid plan/card is requested.

## Backups and next gates

APK plus signing JKS/credential metadata backed up privately in `H:/apps/HelpEarly-backups/android-signing-20261011`. Keystore hash matched the local ignored copy; APK copy hash matched the downloaded artifact. Keep signing credentials encrypted/offsite separately from source, never in Git. Retain the existing verified Supabase production backup/restore drill and Vercel rollback deployment. No new production DB migration occurred.

Use [phone checklist](ANDROID_PHONE_TEST.md). Branding audit/proposal remains deferred until functionality/device gates are complete and owner explicitly approves beginning that separate phase. No new logo, icon, colors, screen redesign, final APK, Play submission or AAB was produced. Future final APK must reuse this signing identity after approved branding and regression/physical tests; production AAB profile is prepared but unexecuted.
