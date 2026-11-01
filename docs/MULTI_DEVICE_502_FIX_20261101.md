# At Your Service: multi-device backend availability fixes

Status: implemented and verified locally; **not deployed**. Existing APK, package, Firebase credentials, signing identity, website and live database are unchanged. The incident's historical Render runtime logs remain unavailable, so the exact trigger of the owner's two-phone 502 cannot yet be certified. These are reproduced backend defects, not a claim that the observed hosted incident has already been resolved.

## Report and reproduced defects

Owner reports two Android devices failing after app startup, including Login. A single healthy probe cannot dismiss this intermittent failure.

1. **Process crash on checked-out database connection loss.** The pool handled errors on idle clients only. `pg-pool` removes its idle error listener when a connection is checked out. A database connection lost between queries consequently emitted an unhandled client `error` and terminated Node. Reproduced with a real local PostgreSQL session terminated by a separate local connection. Fix: attach a client error listener when the pool creates each connection. Query promises still reject; request/worker owners perform cleanup. No global `uncaughtException` or `unhandledRejection` suppression was added.
2. **App-start push registration could crash Express.** `POST /api/notifications/devices` checked out its connection outside `try`; its error handler also awaited a rollback that could itself reject. Express 4 does not automatically forward rejected async handler promises. Controlled checkout and rollback failures both exited the test process before the fix. Checkout is now protected; rollback failure discards the failed connection and forwards the original failure. Failed writes still return an error, followed by a successful health request; they never report registration success. This route is called after a physical device signs in, making it relevant to the reported app-start sequence, without proving it was the historical trigger.
3. **Worker connection leaks.** Notification dispatch and orphan-media cleanup skipped `release()` when advisory unlock failed. A small shared pool could progressively lose every slot. Both paths now discard connections when unlock fails, retaining the real failure and making fresh connections available.
4. **HTTP origin keep-alive mismatch.** Server inherited Node's 5-second keep-alive. Two real TCP connections to actual server startup were closed across a 6.5-second idle gap. Origin keep-alive is now 120 seconds, with a 125-second headers deadline; both connections remain reusable. This addresses the Node timeout/reset failure class described in [Render's official troubleshooting guidance](https://render.com/docs/troubleshooting-deploys#502-bad-gateway). It does not increase API operation timeouts, retry mutations, or prove the hosted proxy experienced this race.

## Before and after evidence

`server/tests/backendAvailability.js` runs each case in its own process, so a real crash cannot be hidden by a parent catch. The HTTP case uses actual `server.js` and real sockets, with startup/database/storage dependencies isolated. Worker unlocks and push-route faults are controlled injections; the checked-out connection-loss case uses real PostgreSQL.

| Failure condition | Before | After |
| --- | --- | --- |
| Checked-out PostgreSQL session terminated | Process exit 1 | Process survives; two concurrent reads succeed |
| Notification worker unlock failure | Checked-out connection leaked | Bad connection discarded; reads succeed with pool maximum 1 |
| Media cleanup unlock failure | Checked-out connection leaked | Bad connection discarded; reads succeed with pool maximum 1 |
| Two HTTP connections idle for 6.5 seconds | Both closed | Both reused successfully; 200 responses |
| Push registration checkout rejection | Process exit 1 | Failed write returns 500; next health request returns 200 |
| Push registration rollback rejection | Process exit 1 | Failed connection discarded; failed write returns 500; next health returns 200 |

[Before evidence](test-results/backend-availability-before-20261101.json) and [after evidence](test-results/backend-availability-after-20261101.json). These are fault-recovery outcomes, not before/after native rendering benchmarks.

## Multi-device feature coverage

`server/tests/multiDeviceFeatures.js` passed **12 feature groups** with four independent module/storage instances and four authenticated Socket.IO sessions: two principal Android API instances, React Web sharing the dual account, and an additional separate household Android API instance. The backend and PostgreSQL database are shared. Native platform/storage bindings are simulated on Node; this is not four physical devices.

| Feature group | Verified behavior |
| --- | --- |
| Login/session isolation | Simultaneous same-account and separate-account login; distinct tokens |
| Registration | Household/worker registrations in parallel without replacing existing client sessions |
| Major tabs/resources | Concurrent profile, discovery, category, booking, job, inbox, revision, chat, complaint, emergency and AI-history reads |
| Profile and Worker settings | Concurrent edits persist and can be read through peer clients |
| Booking/job posting | Concurrent booking creation, job creation and worker browsing; peer persistence |
| Booking/reviews | Worker confirmation/completion and household review visible to Web |
| Proposals/jobs | Worker proposal, household acceptance, shared booking and completed job state |
| Chat | Three simultaneous message writes, persisted histories and unrelated-user denial |
| Complaints | Concurrent Household/Worker complaints; scoped private histories |
| Emergency | Parallel broadcasts, per-worker decline, acceptance, cancellation and persisted peer state |
| Notifications/devices | Shared inbox read state and independent installation registration/deactivation; not a claim of physical FCM delivery |
| Role/reconnection/logout | Role change affects its session; authorized socket reconnection; logout leaves the other three sessions authorized |

[Feature evidence](test-results/multi-device-features-20261101.json). An initial test-only SQL assertion used `text[]` for a UUID column and was corrected to `uuid[]`. Its interrupted synthetic emergency booking was completed through the normal local API before rerunning; the final full matrix passed. No application change was needed for that test assertion.

The additional three-client write/read probe passed five rounds of concurrent booking, job posting and browsing, plus chat, role/logout isolation and private-history rejection. Both feature probes were rerun against a fresh local API process after the final notification-route change. Maximum pool connections: **5**; peak queue: **15**; maximum checkout wait: **12.60 ms**; checkout errors: **0**. Local API medians: booking **10.74 ms** (n=5), job posting **7.21 ms** (n=5), chat send **12.86 ms** (n=3). These are warm local protocol timings, not phone input/paint measurements. [Evidence](test-results/preview-concurrency-20261101.json).

The full isolated PostgreSQL/free-stack suite passed **22 outer groups**, including 14 MVP groups, 20 authorization/concurrency/outbox groups, two-way Android/Web workflows, Web-only administration, password sessions, role/privacy checks, restart persistence, storage contracts and synchronization. Provider responses are simulated where labeled. Final run exit code: 0. [Suite record](test-results/backend-502-regression-20261101/run.json), [suite results](test-results/backend-502-regression-20261101/free-stack.json), [log](test-results/backend-502-regression-20261101/suite.txt). Database configuration/TLS checks, static parsing of 118 files, and concurrency guards also passed. Existing report JSON files were preserved while fresh suite outputs were saved in the dated folder.

## Hosted evidence and remaining gates

The existing, **unmodified hosted deployment** was tested using the real Android/Web API modules with existing synthetic accounts. Login was the first operation of this run; no readiness preflight was added. Earlier investigation probes had already contacted the service, so this is **warm hosted evidence**, not a cold-start test.

- Three simultaneous logins: 200, with distinct sessions and three authorized sockets.
- **94 HTTP requests**: 93 successful 200 responses, one expected 401 after local logout; **zero 502** in this sample. Peak concurrent fetches: **21**.
- Three initial login response-header durations: **1.830 s, 2.712 s, 2.835 s**. Fourth, separate-household login: **0.848 s**. Successful response-header median **1.165 s**, p95 **1.750 s**, maximum **2.835 s**. These are network/proxy/API observations, not pure server execution or native UI timings.
- Role/logout isolation and separate household login passed. No hosted business records were written. [Request IDs and raw timings](test-results/hosted-login-502-20261101.json).
- Supabase was healthy during inspection, with no waiting backend or long-running transaction in the activity snapshot. No incident was reproduced in the available live sample. This does not rule out an earlier transient database disconnect or Render restart.

Render Free can spin down after inactivity; [Render documents its startup limitations](https://render.com/docs/free#spinning-down-on-idle). No deliberate keep-alive traffic, fake success, hidden fallback backend, paid service or changed client timeout was introduced. A cold start was not proven or measured in this run.

Required next steps: approve this focused GitHub push and existing Render Free backend deployment; review Render Events/Logs around the reported phone failure; then repeat hosted login/concurrency checks against the deployed fix and real phones. Fresh physical-device UI, keyboard, installation, live push delivery and live AI response behavior remain unverified. A broad protocol suite cannot certify every device-specific feature.

## Exact deployment scope

Only these runtime files change:

- `server/config/db.js`: handle checked-out client connection errors.
- `server/routes/notifications.js`: protect registration checkout and rollback cleanup.
- `server/utils/notifications.js`: discard failed unlock connection.
- `server/utils/storage.js`: discard failed unlock connection.
- `server/server.js`: origin keep-alive/header deadlines.

Tests and this evidence accompany the patch. No migration, Supabase data edit, Render plan/config/credential change, Vercel deployment, Android visual change, package/signing/Firebase change, or EAS build is needed. Once deployed, this backend-only correction also serves the existing APK at its existing Render URL. Deployment has not been performed: the owner's earlier release instruction requires approval for new live changes.
