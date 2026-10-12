# At Your Service — October 13 testing preview

Status: local checks passed; production deployment approval pending; APK not built yet.

The owner explicitly chose **TESTING PREVIEW with missing native checks disclosed**, instead of manually restarting the emulator. This changes the preview gate only. It does not establish that native latency, every keyboard form, both navigation modes or physical phones passed. The earlier emulator relaunch was rejected by automatic approval review (“blocked by policy”) and was not bypassed.

## Changes ready for deployment/build

Backend: five-connection PostgreSQL pool retained; bounded statement/lock/transaction timeouts and safe checkout failures; registration validates/hashes before acquiring a transaction; worker profile assembled with one SQL query instead of three; distinct JWT session IDs and verified-token rate-limit buckets; Socket.IO accepts authorized same-origin/native connections while preserving JWT, account and role checks. No database migration or production configuration change is required.

Web: scoped GET sharing, cancellation on session/role changes and bounded deadlines; saved-session restoration stops with a recoverable error; synchronization invalidates only changed resources; bounded socket reconnects; duplicate job-submit guard; chat draft and stale-intent protections.

Android: preserve the verified Worker Home header-before-subtabs hierarchy, roles, chat Back behavior, safe-area/keyboard layout, Firebase configuration and Web-only admin boundary. Remove unused household booking-cache work in Worker mode. Format booking dates/times with two locale formatters per batch, skip unchanged cache commits, and publish booking confirmation before refreshing the list. Home/Helpers fetch on focus or helper revision, ignore older responses and retain unchanged lists; booking-only updates no longer refetch helper discovery. Complaint history also rejects older responses. Existing duplicate-submit, stale-job and polling fixes remain included.

Expo SDK patch alignment: expo ~57.0.28, expo-location ~57.0.21, expo-splash-screen ~57.0.10. Package, owner, project, Android visual assets and Firebase file preserved. No branding or redesign.

## Fresh measurements and evidence

| Check | Before | After | Scope |
|---|---:|---:|---|
| Format 100 bookings; 30 alternating paired runs, median | 5.483 ms | 0.409 ms | Actual old/new formatter on Node/V8; not Hermes/native paint |
| Worker login/background cache | Household booking read/formatting | No household cache read | Actual AuthProvider with controlled boundaries |
| Unchanged household booking refresh | New context booking array | Same array; zero consumer commits | Actual React test renderer; not native rendering |
| Role switch while push audience reply held | 510 ms | 29 ms | Controlled React test; historical source comparison |
| Logout while push cleanup reply held | 529 ms | 32 ms | Controlled React test; historical source comparison |
| Native transport that ignores cancellation | — | 31 ms at 30 ms test deadline | Actual mobile API module; synthetic hung transport |

The formatting outputs were compared field-for-field, including locale dates/time, booking IDs/status/service/price/location/photo and missing dates. Changed bookings still refresh; switching back to Household repopulates the cache; a late booking response cannot restore a logged-out account. [Raw formatter/context results](test-results/android-session-performance-20261013.json).

Fresh concurrency used three independent module/storage/session instances: two actual Android API modules and the Web API module on Node/V8, against the same running local backend and isolated shared PostgreSQL. Five rounds of 18 concurrent reads plus concurrent booking/job creation and Worker browsing passed. Three simultaneous chat writes persisted in every session. Actual authorized Socket.IO IDs were distinct. Same-account JWTs were distinct; role switching and logout in one client left peers authenticated; separate Household account could not read the private thread or escalate its role. This is protocol evidence, **not a fresh two-emulator native run**. [Report and raw timings](test-results/preview-concurrency-20261013.json), [server/pool trace](test-results/preview-concurrency-server-20261013.jsonl).

| Fresh local protocol operation | n | Median |
|---|---:|---:|
| Booking creation during concurrent writes | 5 | 29.48 ms |
| Web job posting during concurrent writes | 5 | 23.78 ms |
| Worker browsing during concurrent writes | 5 | 20.65 ms |
| Concurrent chat sends | 3 | 26.92 ms |
| Authenticated profile reads in 18-request batches | 15 | 97.31 ms |

Pool maximum 5 connections; peak 15 queued checkouts; maximum measured checkout wait 314.41 ms; zero checkout errors. Request queuing is finite and distinct sessions completed. These values cannot replace Android operation timings or be compared directly with the previous overloaded emulator cohort.

The October 12 actual Android/Web cohort and six native Worker Home screenshots remain in [the previous report](ANDROID_CONCURRENCY_PERFORMANCE.md). Its slower native booking result (39 → 1,064 ms median) remains **unresolved as a measured native regression**: host memory pressure and Expo Go input-focus ANRs confounded those results. The new fixes remove confirmed unnecessary work, but native improvement has not been measured. Fresh all-form keyboard verification is unavailable; component boundary checks passed, and keyboard code was preserved. Login, Registration, Booking, Worker Setup, Job Posting, Profile, Complaints, Emergency and Chat must all be accepted on the signed APK with keyboard open and both three-button/gesture navigation.

Render Free cold-start delay is separate from local application work. Prior production read-only health measurements were 22,507.58 ms then 366.63 ms; no platform wake telemetry proved the first was a cold start. The existing Render dashboard warns of idle spin-down delays of 50 seconds or more. Local process startup is not Render cold-start evidence. No artificial keepalive or paid infrastructure was added. [Render Free behavior](https://render.com/docs/free#spinning-down-on-idle).

## Verification completed

- Isolated PostgreSQL replica preservation/rollback and RLS/grant checks; 14 MVP groups, 20 authorization/concurrency/outbox groups; password/session revocation; Web-only admin guards; real API/Socket.IO synchronization, restart persistence and offline recovery.
- Actual component regressions: Worker header/subtabs, six ordered role tabs, chat Back/draft/stale intent, duplicate booking submit/confirmation, stale jobs and complaint history, keyboard ownership/focused-field scroll/safe insets with simulated native boundaries.
- Web component/config tests and production build with explicit Render API/socket URLs; rendered local Web synthetic login, Helpers data, Worker dashboard switching and logout observed through browser UI.
- Android Hermes export, Expo Doctor **21/21**, preview/Firebase/package configuration checks and static parsing/reference checks.
- AST/style/asset protection: 14 existing StyleSheets and nine protected identity/assets/configuration files; only previously authorized keyboard wrapping/growth and Worker name shrinking accepted. No fresh pixel comparison.
- Security audit: server production dependencies **0** advisories; Web production dependencies **2 moderate**; mobile dependency tree **8 moderate/16 high**, no critical. Remaining advisories include transitive SDK/build tooling and React Router. Suggested fixes require incompatible major upgrades/downgrades; they were not automatically applied. This preview is not a declaration of zero security findings.

Provider-backed FCM delivery, real phone rendering/timing, keyboard variants, background/foreground transitions and mobile network behavior remain unverified. Provider simulations in local suites are labeled as such.

## Deployment and single APK plan

Await explicit owner approval before pushing the reviewed source to the existing GitHub main branch and manually deploying existing Render Free `helpearly-api` / existing Vercel `client`. Preserve existing domains, Supabase schema/data, runtime environment, Expo/Firebase credentials and signing. No migration, new project, paid service or Play release.

After deployment, verify actual HTTPS readiness/schema, Website/CORS, authentication and authorized WSS, labeled synthetic booking/job/chat persistence and concurrent session/role/logout behavior. Then build exactly one internal preview APK using existing EAS project `af6f6973-68c9-4e56-af9f-1e8896877b9d`, owner `tahmid_041`, package `com.atyourservice.app`, API `https://helpearly-api.onrender.com` and existing signing/FCM credentials. Free Android allowance before build: **7 used of 15**; no paid overage.

[Prepared mobile source manifest](test-results/android-testing-preview-source-20261013.json). Signing is confirmed only after the downloaded APK certificate matches the previous verified certificate `90cb140d12144596e8287484c2fec5d6d117e0048772350abbda3dcf9699ca33`. APK link, size, hash and build ID will be added after actual completion and download verification.

## Physical phone acceptance

1. Install the testing APK over the existing At Your Service app; confirm records and login survive.
2. Use two phones plus Web concurrently, both separate Household/Worker accounts and shared dual-role account. Book, post, chat, switch roles and log out one session; verify others remain usable/authenticated.
3. Open every listed form with keyboard visible. Focus first/last/multiline/numeric fields; scroll to submit/cancel; repeat with three-button and gesture navigation.
4. Check exact Worker header → Dashboard/Complaints/Broadcasts → content order; check Chat Back after new messages.
5. Record login/tab/booking/job/chat/role/logout timings on warm API and after idle wake. Test Wi-Fi/mobile/offline/reconnect, background return and opt-in system notification delivery. Report screenshots/error/time when any operation hangs.
