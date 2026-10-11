# Android performance and keyboard corrective release — 12 October 2026

This is a corrective functional-test release. The website, Render backend, Supabase schema/data and permissions were not changed. No branding work or new dependencies were introduced. Existing `com.atyourservice.app`, Expo project, signing key, Firebase client configuration and HTTPS API remain the release target.

## Findings and implementation

### Login/signup keyboard — IMPLEMENTED; native checks listed below

The old signed physical-fixes APK was installed on a disposable Android 16 emulator. Its keyboard covered Sign In despite native `adjustResize`. Android 36 edge-to-edge windows can keep their full height; the old shared scroll wrapper only revealed a focused input and did not shrink the obstructed viewport. Login also used `minHeight: '100%'`, limiting useful scrolling. RN 0.86 Android `measureInWindow` uses a status-bar-relative origin, while keyboard coordinates use screen coordinates. Native measurements confirmed that mismatch; a first proposed correction still left the viewport behind the keyboard and was rejected.

`mobile/src/components/FormLayout.js` now measures the actual obstruction, normalizes coordinates using the actual Android status-bar height and removes exactly the obstruction from the viewport. Focus events explicitly reveal their input. Android drag scrolling retains the keyboard; iOS keeps its existing avoidance behavior. Nested form scrolls share one resize owner; otherwise the job modal disappeared under double resizing, reproduced and corrected in native testing. Android native nested scrolling is enabled so the inner modal can scroll to its submit action. Each native modal resets ownership because it has a separate window. There is no arbitrary large keyboard padding or additional Android KeyboardAvoidingView.

`LoginScreen.js` changes only its content sizing from percentage minimum height to `flexGrow: 1`. `FormTextInput` is reused in login, signup, booking, date, location, jobs, profiles, complaints, emergencies and worker forms. `ChatScreen.js` and `AiAssistantScreen.js` use the same measured viewport for their fixed composers. Existing ordinary screen styles/assets remain unchanged except the specifically requested section organization and profile order.

### Infinite loading / refetch storms — PASS in automated regression; phone retest pending

The old API transport had no deadline. Worker dashboard called the same loader twice on mount. Jobs depended on the entire user object and loaded both on focus and in another effect. Every resource consumer subscribed to one global revision, and 30-second polling/socket connection forced revision changes even when records had not changed. Category hooks also ran separate timers per mounted screen.

`mobile/src/api/client.js` bounds HTTP and response reading, cancels obsolete session/role work and rejects late responses even when the transport ignores abort. Identical concurrent GETs share one fetch; mutations are never automatically retried. Default deadline: 20 seconds; sync: 10 seconds; login: 60 seconds to allow a free-host wake-up; AI: 45 seconds. These are limits, not measured normal latency or a guarantee of cold-start success.

`NotificationContext.js` consumes durable resource revisions, performs non-forced polling/reconnect checks and retains forced foreground recovery. Screens subscribe only to their relevant resources. `AuthContext.js` booking/profile callbacks are stable. `WorkerDashboardScreen.js` and `JobsScreen.js` display primary results as they arrive; unrelated requests do not hold the entire screen behind a spinner. Home, Helpers, Jobs and Worker Dashboard surface real retryable errors. `useMarketplaceCategories.js` uses durable category invalidation instead of independent timers. Previous safe data can remain visible during refresh; it is never substituted for successful server confirmation.

### Slow buttons — IMPLEMENTED / partial native verification

Navigation no longer waits for push registration/audience cleanup. Login/signup, chat sends, proposal submission and notification opening reject duplicate pending actions and show busy state. Existing booking/job/emergency mutation confirmation remains database-backed. Chat restores unsent text on failure. All HTTP actions have bounded failure paths.

Files: `LoginScreen.js`, `RegisterScreen.js`, `ChatScreen.js`, `JobsScreen.js`, `NotificationsScreen.js`, the shared API/auth/notification modules. All button paths were not individually timed on a phone; do not infer that from build or component checks.

### Dual-role switching — PASS automated/native scope; phone timing pending

The previous switch awaited notification-audience HTTP before updating active role. `AuthContext.js` now updates the installed API role, navigation and booking scope immediately, cancels old work and persists the preference. Push audience registration happens separately. Backend active-role checks remain unchanged and passed actual isolated PostgreSQL authorization tests. Every notification/history route still authenticates and checks audience.

Controlled comparison using the actual old/current AuthProvider and a held 500 ms server reply is stored in `test-results/android-performance.json`. This is React state latency with explicitly simulated storage/transport boundaries, not physical-device timing. The latest run measured 517→29 ms for role change and 515→31 ms for logout. Native adb upper bounds include UI-dump and intentional wait overhead and must not be presented as raw button latency.

### Logout — PASS automated/native offline scope; physical retest pending

The old implementation awaited push-device deletion and refused logout when that request failed. With unbounded fetch this could trap the user for minutes. Logout now immediately clears rendered identity, bookings, role, installed API credentials and in-flight work. Local persisted credentials/push-routing state are removed. Captured remote cleanup has a five-second deadline and cannot restore the session. Only a device ID/account ID is persisted for a cleanup retry after the same account signs in; no token/password is persisted for cleanup. A new device ID avoids a delayed deletion removing a fresh registration.

An offline device cannot guarantee immediate server-side push-token deactivation until it reconnects. Protected REST/Socket.IO access still requires a valid authenticated session; this work does not change existing server-side JWT policy. Foreground old-session callbacks are suppressed. Android can deliver an already queued background notification while offline; never claim otherwise. The actual isolated tests verify device ownership, rotation, deactivation, ban/password revocation and role isolation.

### Worker Home / Household Posts — PASS component and native checks

`RoleSections.js` exposes Dashboard / Complaints / Broadcasts for workers and My Posts / Complaints / Broadcasts for households. Exact existing Household Helpers segment styles were compared in an executed AST/component test. Worker sections use the actual top safe area; native testing reproduced the old status-bar overlap. Dashboard avoids its old duplicate status-bar spacer when embedded beneath those tabs.

`ComplaintsScreen.js` receives `historyOnly` for the Worker Home history tab: no Submit complaint action there. Subject, status, description, related booking, date and authorized administrator response are retained. Other legitimate complaint submission routes remain. Native testing used a synthetic complaint with the correct `helper` audience in an isolated PostgreSQL fixture; no production complaint was modified.

Broadcasts retain existing backend eligibility, category, availability, contact and concurrency behavior. Empty-state navigation was executed natively; actual acceptance/expiry/self-exclusion/authorization passed database tests. No live emergency was broadcast to existing workers for these tests.

### Profile and notification organization — PASS automated / partial native

`ProfileScreen.js` renders identity/avatar/name/email first, personal details second, then existing worker/account/role controls. No fields or styles were removed. Background profile updates cannot overwrite an active edit draft; the executed renderer test verified unsaved input survives a user refresh. Native profile order and keyboard checks were also executed.

`NotificationsScreen.js` retains authenticated routing, adds unread labels and busy state, and avoids duplicate open actions. Complaints retain real loading/error/empty states. Broadcasts retain existing authorized information. These are targeted organization corrections, not a brand redesign.

## Executed test evidence

- **PASS:** `node server/tests/freeStack.js`: actual disposable PostgreSQL migration/preservation/RLS, 14 MVP groups, 20 authorization/concurrency/outbox groups, central web administration/audit/last-admin controls, password-session revocation, active-role isolation, real Web/Android API-module two-way synchronization, missed-update recovery, process restart persistence, notification jobs. Provider HTTP storage/AI boundaries are explicitly simulated in the suite; physical delivery is not claimed.
- **PASS:** `databaseConfig.js`, `webRoleComponents.js`, `androidUiFixes.js`, `androidPerformance.js`, `androidFixesVisual.js`. The visual check compares 14 existing StyleSheet definitions and nine asset/signing configuration files; it is not a physical screenshot comparison.
- **PASS:** React web production build (104 modules), Android Hermes export and Expo Doctor 21/21. No live website deployment.
- **PASS:** actual Android 16 emulator, Expo Go SDK 57 latest source, isolated PostgreSQL API: login/signup keyboard including smaller 720×1280 three-button navigation; persisted fixture login; worker tabs/history/broadcast empty state; household Posts; profile ordering; offline logout; job modal first/multiline fields/action; booking multiline service/numeric fee/notes/submit action; profile editing; AI composer. Bounds assertions require a positive visible height above the actual keyboard, rejecting clipped/inverted accessibility rectangles. See separate native reports/screenshots. Expo Go is not the new signed APK and cannot prove FCM delivery.
- Read-only live warm HTTP/SQL latency: `android-live-latency.json`. Observed readiness 336–894 ms, categories 384–405 ms, helper listing 343–1018 ms; one TLS connection 808 ms and simple SQL 119–127 ms. No deliberately induced Render cold start. These measurements do not establish phone latency or blame all slowness on Render Free.
- **IMPLEMENTED / UNVERIFIED:** Android 13 physical behavior; device manufacturer keyboard differences; full signed-APK authenticated marketplace/FCM verification; background/locked-screen push arrival; actual cold-start/offline recovery on the user's phone; individual complaint/chat/worker-setup/emergency/date native form paths not separately run.

## Release and installation

One new free EAS preview is authorized after local gates pass. Reuse existing project `af6f6973-68c9-4e56-af9f-1e8896877b9d`, package `com.atyourservice.app`, existing signing key and private Firebase file. API: `https://helpearly-api.onrender.com`. No production backend/database/frontend change is required for this mobile correction. Build identity, artifact path/hash/signature and final native evidence will be added after the actual build completes. The older physical-fixes APK does not contain this corrective source.

## Physical retest — required before calling the phone bugs fixed

1. Install the new preview over the old app. Preserve app data; do not uninstall unless Android reports an actual installation conflict. Record model, Android version, navigation mode and keyboard app; keep passwords/push tokens private.
2. On Login, focus password; scroll to Sign In while the keyboard stays open and submit. On Signup, repeat first/last fields, numeric phone/NID and Create Account; check typed values survive keyboard close/open. Test gesture and three-button navigation if supported.
3. Login household/worker/dual roles. Each screen must show data or a meaningful bounded error; no permanent spinner. Switch dual role repeatedly, verify correct role records/history and no previous-role leak. Record elapsed times without exposing credentials.
4. Focus lowest fields in booking/photo, job/photo, profile/address, worker settings, date, complaint, emergency, chat and AI forms. Scroll actions above the keyboard; verify ordinary layouts, typed values and server results.
5. Worker Home: three visible tabs, real complaint history/admin response with no submission action, correct eligible broadcasts. Household Posts: three matching subtabs. Both profiles: identity then personal details. Notifications: unread state and correct destination.
6. Begin a normal request, disconnect network, then logout. Login must appear promptly. Reconnect/sign in; Web and Android should retain and synchronize actual records. Test background/foreground and a free-server cold start; a timeout must be recoverable by retry.
7. With consenting accounts, verify Web↔Android booking/proposal/chat/review/complaint/admin updates and reconnect recovery. Enable Android notifications; test foreground, background and locked-screen delivery plus tap routing, and wrong-role suppression. Do not send a test emergency to unrelated workers.
8. Report PASS/FAIL per step with safe screenshots and measured time. No final branded APK or branding phase until these functional results are reviewed and branding is separately approved.

## Backup and rollback

Keep the previous APK, new APK/hash/signature report, local source commit and verified Git bundle, private existing Android signing backup, Firebase credentials and prior verified production database/media backup. Never commit keys, service-account JSON, `.env*`, signing material or APK binaries. Mobile rollback is the preserved signed prior preview; it reintroduces known usability defects and is not preferred. Production schema/deployment rollback is unrelated and requires its own approval. Source remains local until an explicitly authorized production-triggering push/deployment is needed.
