# HelpEarly: free demonstration, commercial upgrade path

Updated 2026-10-10. This is the current strategy. It supersedes the previous paid-disk/standalone Compose deployment advice. No production deployment, database migration, bucket creation or security permission change was performed.

## Target architecture

| Component | University demonstration | Commercial upgrade |
|---|---|---|
| Website | Existing `https://atyour-service.vercel.app/` project | Same React application/project |
| API | One Express + Socket.IO service on Render **Free** | Always-on Render, Cloud Run, VPS or another Node/container host |
| Database | Existing Supabase `at-your-service`, ref `gjwkrqlzroujlueexcxc` | Same PostgreSQL database; upgrade capacity/backups first |
| Media | Private Supabase Storage bucket, created only after approval | Keep Supabase or implement another adapter behind the same storage interface |
| Android | Existing Expo application, same configurable HTTPS API | Same application and signing identity |
| Push | Expo Push Service → Firebase FCM on Android | Same durable outbox; independent worker and monitoring |
| Synchronization | Authenticated Socket.IO hints + PostgreSQL resource revisions | Cross-instance Socket.IO adapter plus durable recovery |

PostgreSQL is authoritative for users, roles, bookings, jobs, proposals, messages, reviews, complaints, emergencies, notification inbox, device registration, push attempts, media cleanup journal and synchronization revisions. Browser/phone caches and Socket.IO events are disposable. No Firestore, Firebase Functions, Firebase Storage, billing-enabled Google Cloud service, paid domain, card or paid infrastructure is required by this implementation.

Firebase lists FCM as no-cost on its [pricing page](https://firebase.google.com/pricing). Use Spark; do not enable Blaze, Firebase Storage or Firebase Functions. Expo's existing push integration forwards Android delivery through FCM v1; a second Firebase Admin delivery implementation is unnecessary. [Expo FCM setup](https://docs.expo.dev/push-notifications/fcm-credentials/).

## What is actually live

The existing Vercel site is available, but its audited bundle points at `https://at-your-service-api-production.up.railway.app/api`. That endpoint returned Railway “Application not found.” The deployed bundle lacks several latest local HelpEarly workflows. It has not been replaced or redeployed.

The existing Supabase project is healthy, with 13 public tables and an older schema. Read-only checks still show 31 users, 22 helpers, 10 bookings, 12 jobs, 27 messages, 5 reviews and 2 complaints. Storage has zero buckets and zero objects. These records were not copied, modified or deleted. Local Express uses local PostgreSQL; no evidence of a running Render backend was established. Detailed previous observations: [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md).

## Implemented locally

### Durable two-way synchronization

Database triggers increment `sync_revisions` in the transaction that changes each resource. `/api/sync` returns authenticated global and personal revision tokens, without private row IDs or records. Private booking/message/complaint revisions are limited to their account; admin revisions are visible only to admins. Global helper/job/category/emergency revisions contain no private content.

Successful API writes broadcast a payload-free `sync_hint` only to authenticated Socket.IO connections. Web and mobile check database revisions before invalidating their existing screens. They also check after Socket.IO connect/reconnect, app foreground/browser focus/network return, and every 30 seconds while visible/active. Offline failures keep the previous successful snapshot. A hint arriving during a request schedules another check. Full foreground refresh renews signed media links. REST authorization still controls all fetched records.

The visible/active 30-second fallback performs a full refresh as well, so a screen read that failed after a successful revision lookup is retried even if no new write occurs. Booking dashboards retain previously loaded records and show refresh errors instead of replacing them with an empty list. Web session restoration retries temporary backend failures without erasing the stored token.

Web discovery, helper profile, booking dashboards, proposals/job detail/listings, chat, complaints and admin lists now refresh relevant data. Mobile's existing revision mechanism now also recovers missed updates, reloads bookings/discovery and refreshes the admin screen. Existing booking/proposal/chat/emergency logic remains authoritative.

Socket.IO rejects missing/invalid/expired JWTs, inactive accounts and unapproved browser origins. Personal rooms are assigned by the server. Conversation joins/typing/read events check participation; socket message writes are rejected in favor of the authenticated REST transaction. JWTs are rechecked on packets; expiry disconnects the socket. Chat rejoins its selected conversation after reconnect.

### Persistent media and provider boundary

`server/utils/storage.js` owns `put`, `remove`, `url`, `check`, `list` and `read`. Development uses local files; production requires Supabase configuration. Business records store stable `/uploads/<UUID>.<extension>` keys, independent of the storage host. To add S3 or another object store later, implement this interface and select its adapter; controllers and record keys stay unchanged.

Uploads validate image type/content, limit size to 5 MB and count to five, use generated filenames and refuse overwrites. The backend uploads to a **private** Supabase bucket with a server-only service key. Authorized JSON responses translate stored photo/avatar keys to one-hour signed URLs. Production does not expose the local `/uploads` folder or an unauthenticated remote redirect. Signed links are bearer links: recipients can share them until expiry. Database timestamps remain intact when signing media.

`media_uploads` journals uploads before storage writes. Failed requests remove only unreferenced files. If storage signing fails after a database commit, cleanup preserves the committed photo. A database-backed cleanup scan removes journaled, unreferenced objects older than one day after the API/worker resumes. Pre-existing files outside this journal are never deleted automatically. New app files use UUID keys; legacy external URLs are preserved. Legacy non-UUID local paths need an explicit, reviewed migration rather than being silently discarded.

### Durable jobs and push

Existing transactional SQL notification triggers and `push_deliveries` remain in PostgreSQL. An API-hosted dispatcher handles them while the free service is awake. `npm run worker` runs the same dispatcher/cleanup separately for future always-on hosting. Advisory locks prevent competing dispatchers from submitting the same job simultaneously; delivery/device ownership and active-account checks are enforced. A standalone worker does not falsely mark Socket.IO delivery as sent when no socket server exists.

Retries, ticket IDs, attempts and receipt checks survive restarts. Device token ownership/rotation/logout revocation are enforced. Push carries an inbox notification ID; mobile fetches the authorized inbox before navigation. Provider receipt acceptance is not proof the phone displayed it. An uncertain network submission stays `unknown` rather than silently resending a possible duplicate; the durable inbox and revision recovery remain available. Commercial operations need monitoring/reconciliation of unknown/failed/old jobs. Exactly-once third-party push delivery is not promised.

Render Free sleeps after idle traffic and loses its local filesystem. It cannot run a free dedicated background worker, attach a persistent disk or scale horizontally. Push and expiry dispatch may be delayed until a request wakes the API; clients recover state from PostgreSQL. Do not describe this as commercial uptime or guaranteed urgent delivery. See [Render Free limits](https://render.com/docs/free). Supabase media avoids ephemeral-disk loss. Monitor all free quotas; do not add billing to work around a demo limit.

### Approval and security gates

Production and remote-database startup are **read-only**. They require schema version 2 and fail safely if migrations are missing. Only local non-production startup auto-initializes the local database. `npm run db:migrate` refuses changes without `--approved`; that flag is an execution guard, not a substitute for the owner's actual approval.

The complete migration (base/additive schema, existing production triggers, free-stack additions, RLS/grants) now executes under one PostgreSQL transaction/advisory lock. A legacy conflict rolls everything back. Existing rows are not replaced; missing categories are added and worker rating aggregates are recomputed from actual reviews.

Audit found RLS disabled and anon CRUD grants on all 13 existing public tables. Live exposure remains until an approved remediation. The prepared `api-security.sql` enables RLS on application tables, removes public/anon/authenticated table access and application RPC execution, and restricts new objects created by the migration owner. Express JWT integer user IDs are not Supabase Auth UUIDs; no invalid `auth.uid() = users.id` policy is introduced. Owners/service_role retain access. Existing policies/other Data API consumers must be reviewed before approval. Disabling unused Data API is optional and also requires approval; Storage remains separate. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

Logs use request IDs, method/status/duration and route patterns, without tokens, passwords, request bodies or SQL error detail. API responses are not cached publicly; CORS is an explicit allowlist. Database outages return temporary authentication errors without declaring a valid token invalid. TLS validation is enabled for remote PostgreSQL; use Supabase direct/session pooling on port 5432. Transaction pooling on 6543 is rejected because session advisory locks are used. Connection pool size is configurable, default five.

## External actions, in order — approval required for live changes

1. Obtain existing Supabase direct or **session-pooler** credentials privately. Keep them in provider settings or an ignored environment file, never chat/Git. Confirm backup access and the project ref. Create a fresh production DB + media backup, verify restoration into isolation, record counts and known-good Vercel deployment. Never restore the local dump over Supabase.
2. Review `server/db/ensureSchema.js` and all three migration files. Review duplicate booking reviews, existing roles/policies and any other Data API consumers. Approve the exact schema/RLS/grant changes. Run the approved migration against **only the existing project**; check counts, role check, actual ratings, triggers, indexes and advisor results afterward. No production migration has been run in this task.
3. Approve creation of a dedicated **private** media bucket in the existing Supabase project. Set a 5 MB object limit and JPEG/PNG/WebP/GIF allowlist. Leave anon/authenticated Storage access denied. Configure backend URL, bucket and service key privately. Do not change existing bucket policies or remove existing files. Transfer any genuinely referenced local media under its original key, verify bytes/checksums, then keep the original backup.
4. Approve a Render **Free** web service for this repository, root `server`, build `npm ci --omit=dev`, start `npm start`, health `/api/ready`. `render.yaml` has no disk or paid plan and automatic deployment is disabled. Use the real generated HTTPS hostname; no fake domain is provided. Keep one instance, `RUN_BACKGROUND_WORKER=true`, `PUSH_ENABLED=false` initially. If provider account verification demands a payment card, stop that setup and use the supervised fallback; do not enroll billing.
5. Fill `server/.env.production.example` values in Render settings. Use existing Vercel origin in `CLIENT_URL`, a strong random JWT secret, TLS-verifying session connection, private storage settings and optional AI key. Never place DB/service/push/AI keys in `VITE_*` or `EXPO_PUBLIC_*`. Verify health/readiness, CORS, login, role isolation, uploads and WSS on the actual hostname.
6. After approval, edit environment values and redeploy **the existing Vercel project**. Set `VITE_API_URL` to the actual Render origin (optional `/api`); `VITE_SOCKET_URL` can stay absent and derives from it. Preserve the previous deployment for rollback. Do not create another web project.
7. Set Android `EXPO_PUBLIC_API_URL` to that same HTTPS API. Link the intended EAS project, configure Firebase Spark Android package `com.atyourservice.app`, google-services file and FCM v1 credentials privately. Follow [DEPLOYMENT.md](DEPLOYMENT.md). Use available free Expo build quota or local Android tooling; no purchase is required by the code. An Android JavaScript/Hermes export is not a signed APK.
8. Install the signed preview APK; verify foreground/background push, tap/cold-start routing, token rotation/logout, Wi-Fi/mobile-data reconnect, media after backend restart and paired Web↔Android flows. Enable `PUSH_ENABLED=true` only after credentials are verified. Native push is unavailable in Expo Go. Real delivery remains pending.

## Safest supervised demo and fallback

Before presenting, open the actual Render `/api/ready` and wait for a JSON `ready` response; allow cold-start time. Keep Web and Android open. Do not depend on a background emergency push for the main presentation.

Three-to-five-minute sequence: household browses an electrician → offers fee/describes work with a photo → worker confirms → both exchange messages → worker completes → household reviews. Then show job proposal acceptance producing a booking and an admin verification/complaint update. Emergency acceptance can be shown with both apps open.

If Render is unavailable, run this same Express server locally against the already-approved Supabase schema/Storage, with private environment settings and automatic migrations disabled by the remote/production startup gate. Run `cloudflared tunnel --url http://localhost:5000` for a temporary HTTPS address. Keep JWT authentication, private media, exact web CORS and no admin debug bypass. A Quick Tunnel URL is temporary and public, not a security credential or permanent host. Do not tunnel the PostgreSQL port or the separate C2C workspace connector. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Using that tunnel from Vercel needs your approval for an environment change/redeploy of the **existing** project and a prepared Android build with the same tunnel address. Do not promise instant runtime switching of an already-built APK or compiled Vite bundle. Prepare/test the fallback in advance; alternatively demonstrate local web + Expo Go on supervised Wi-Fi against a separate local test database, clearly labeled as local. Restore the original Vercel API setting afterward only with approval. Stop the tunnel after the presentation. If Supabase itself is unavailable, a restored isolated local snapshot is a demonstration copy, not a live database replacement; never merge its writes into production silently.

## Backups and rollback

`node server/scripts/backup.js ABSOLUTE_PRIVATE_DIRECTORY` dumps the configured PostgreSQL database and copies local media or authenticated Supabase bucket bytes plus a SHA-256 manifest. `COMPLETE` is written only after both finish. Secrets are supplied privately through the environment. Take consistent backups during a short approved write pause; DB and object storage do not share a transaction. Encrypt and copy backups off the laptop. Confirm that the selected database is the intended one. Supabase restore validation must not mutate the live project.

Keep Git commit/bundle, DB dump, media/manifest, private environment settings, production connection CA, Firebase service account, Expo project identity, Android keystore and previous Vercel deployment privately. Restore DB/media into a fresh isolated database/bucket, validate counts/relationships/login/photo bytes, then decide on a traffic switch. Prefer code/config rollback with additive schema retained. Do not reset/drop live tables or overwrite newer user activity.

Local backup `H:\apps\HelpEarly-backups\helpearly-2026-10-10T17-35-39-470Z` was restored into a new local database: nine table counts, foreign keys, notification functions and media verified. This is a **local database backup**, not a backup of the existing Supabase records. A fresh final local backup and Git bundle are produced at task completion; see the execution report for their exact paths.

After local schema version 2 initialization, backup `H:\apps\HelpEarly-backups\helpearly-2026-10-10T17-46-09-722Z` was restored successfully, including 12 table counts, foreign keys, notification functions and media. The source Git bundle is `H:\apps\HelpEarly-backups\helpearly-free-stack-20261010.bundle`; it contains committed source/history, not runtime secrets or a production Supabase backup.

## Future commercial release, minimal downtime

1. Keep Supabase initially. Upgrade uptime, DB connections/backups and storage quotas. Deploy the same API/container to an always-on host with the same JWT key, PostgreSQL URL, private Storage provider settings and CORS origins. Validate a candidate endpoint before switching traffic. Render/Cloud Run/VPS selection does not enter business controllers.
2. For the first host change, use one active writer/dispatcher during cutover. Stop/drain old writes and connections, switch the existing Vercel API configuration and a compatible Android release, and leave a redirect/proxy from the old API URL during client rollout if that host permits it. Free provider hostnames have no owner-controlled DNS switch; zero-downtime migration of already-installed clients cannot be guaranteed without a retained compatibility endpoint or a stable API hostname. When commercially appropriate, add a stable API domain so later host changes use DNS/load-balancer configuration.
3. Before enabling multiple API instances, wire the official [`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) into Socket.IO bootstrap with authenticated publisher/subscriber Redis connections from private `REDIS_URL`. Use TLS/ACLs, managed limits and reconnect monitoring. Provide sticky load-balancer sessions when HTTP long-polling is enabled; a shared adapter alone is insufficient. Current deployment is single-instance; this adapter is **documented, not provisioned or live-tested**.
4. Run one or more dedicated `npm run worker` processes; disable API workers with `RUN_BACKGROUND_WORKER=false` after validating separation. Route worker socket notifications through a cross-instance emitter/adapter instead of assuming it owns an API socket server. Retain PostgreSQL advisory-lock claiming or replace the one global dispatcher with tested `FOR UPDATE SKIP LOCKED` leases when throughput requires parallel work. Durable state and stable notification IDs remain. PostgreSQL reconciliation works even if Redis misses an event. Do not use free volatile Redis as the authoritative job queue.
5. Replace the current single-instance memory rate limiter with a shared limiter before scaling. Give the API a least-privilege DB role and scoped storage credentials; test owner/RLS behavior explicitly. Add secret rotation, session revocation, admin MFA/audit trails, dependency remediation, monitoring/alerts, dead-letter/unknown-push reconciliation and tested backup retention. No such paid service was provisioned now.
6. If changing object storage, implement/test one adapter, copy objects preserving keys, verify manifest/checksums, then switch `STORAGE_PROVIDER` and credentials during a short approved write pause. Keep old objects until all old signed links expire and rollback is safe. Moving PostgreSQL itself requires a separately reviewed replication/export plan with sequence/FK validation; it is not necessary for the first hosting upgrade.
7. Run real paired devices, external WSS/load-balancing, concurrency/load/soak tests, authorization/RLS penetration tests, live FCM delivery and restore drills before calling this a reliable commercial service. Free-demo success is not commercial certification.

## Executed validation and limits

`npm run test:free` reconstructs the read-only 13-table/109-column Supabase catalog in a disposable local PostgreSQL database, uses synthetic records, and never copies customer rows. It checks migration preservation/repeatability, rollback on duplicate legacy reviews, read-only production startup, RLS/table/RPC denial using a non-owner role, CORS, 14 MVP groups and 20 authorization/concurrency/outbox groups. It executes the Web/mobile shared recovery engines against a real API/database in both directions, including missing socket updates, API restart/media bytes, outbox persistence and dedicated-worker restart. Remote Supabase HTTP storage contracts are mocked and labeled accordingly. Latest machine-readable results: [test-results/free-stack.json](test-results/free-stack.json).

Web production build, Android Hermes export, Expo web export, Expo Doctor (21/21), configuration tests, static parse/reference check and whitespace check were executed. Signed APK/AAB, physical phone rendering/push, live Supabase Storage access, Render deployment, real external HTTPS/WSS and cross-instance Redis were not executed. Browser UI inspection was blocked by the browser tool's security policy; no bypass was attempted. Protocol/recovery tests do not substitute for a physical Android walkthrough.

Known dependency advisories from the preceding audit still require review before commercial exposure. Existing demo behavior is preserved; no claim of complete penetration testing, unlimited free capacity, guaranteed delivery, zero data loss under every disaster or production readiness is made.
