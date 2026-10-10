# HelpEarly existing production architecture audit

Audit: 10 October 2026. Public HTTP requests, compiled frontend inspection, local source/configuration inspection and **read-only SQL** against the user's existing Supabase project. No production migrations, record updates, deployments, project creation, credential retrieval or paid operations performed.

## What is live

| Component | Verified current state |
|---|---|
| Existing React/Vercel frontend | `https://atyour-service.vercel.app/` returns HTTP 200 with Vercel headers. Existing site preserved |
| Frontend's compiled API target | `https://at-your-service-api-production.up.railway.app/api` |
| Configured Railway backend | Host responds, but Railway returns HTTP 404 **Application not found** on all inspected API and Socket.IO paths. No running Express application verified at this URL |
| Local Express | `http://localhost:5000/api/health` returns `status: ok`, `database: connected` |
| Local database | `server/.env` selects local PostgreSQL (`localhost`, database `at_your_service`). No DATABASE_URL configured in that file/process |
| Existing Supabase | Project `at-your-service`, ref `gjwkrqlzroujlueexcxc`, region ap-northeast-1, ACTIVE_HEALTHY, PostgreSQL 17. Existing records verified |
| Railway → Supabase connection | **Unknown.** Railway's application/environment settings are inaccessible and the configured application is unavailable. Supabase existence alone does not prove this connection |
| Expo Android | Source/configuration exists locally. No configured production API override found in local mobile environment. Its development fallback does not connect a standalone physical phone to Railway/Supabase |

Verified Supabase record counts: 31 users, 22 helpers, 10 bookings, 12 jobs, 27 messages, 5 reviews and 2 complaints. Only aggregate counts/schema metadata were read; no customer records or password hashes were retrieved.

Repeated aggregate counts at the end of the audit were identical. The Vercel homepage still returned 200 with the same live asset; Railway health still returned 404. All Supabase SQL ran in read-only transactions.

There may be a renamed or alternate backend in the owner's hosting account. This audit proves the **configured** URL is unavailable, not that no backend could exist elsewhere. Railway account settings, deployment logs, live environment values and Vercel dashboard deployment commit/settings remain unverified.

## Exact live frontend evidence

Live HTML title: `At Your Service - Find Trusted Home Helpers`.

Loaded production asset: `/assets/index-C7KjbsDV.js`, 309,263 characters; SHA256 `0b45fa3d5ddb7d5245c608d7fd85eb63708fe1c57c7abf81ab1029294a90993d`.

The compiled API constant is the Railway origin, normalized to `/api`. Auth endpoints use it. It is not a localhost target and does not directly use the Supabase SDK/API. Compiled code also contains Socket.IO; with this target unavailable, live chat cannot reach the backend.

The inspected live bundle contains none of the newer `emergency`, `chatbot`, `photos`, `service_description` or `notifications` feature markers present in current local source. Its asset differs from the local build. This demonstrates an older frontend; backend fixes cannot be inferred from frontend code. Existing login/discovery/bookings/jobs/chat/complaint/admin UI code remains in that older bundle, but data workflows currently fail against the configured API.

## HTTP, CORS, auth and uploads

The following Railway GET paths all returned 404 JSON `Application not found` from `railway-hikari`:

- `/api/health`
- `/api/categories`
- `/api/helpers?limit=1`
- `/api/jobs?limit=1`
- `/api/notifications`
- `/api/chatbot`
- `/api/emergency`
- `/api/admin/stats`
- `/socket.io/?EIO=4&transport=polling`

OPTIONS preflights for auth login, bookings and jobs with Origin `https://atyour-service.vercel.app` also returned 404, with no Access-Control-Allow-Origin header. This is a missing application/domain mapping result, **not evidence of an Express CORS bug**. Authentication, actual WSS upgrades, authorized uploads, uploaded-file durability, Gemini configuration and notification delivery cannot be verified against a missing API. No test accounts/bookings/files were created in production.

Vercel `/api/health` and `/api/categories` returned HTTP 200 **HTML**, not API JSON. Current `client/vercel.json` rewrites every path to index.html; it hosts the SPA and does not proxy the backend. Therefore a blank VITE_API_URL is incorrect for this Vercel deployment. The Vite development proxy applies locally, not to the deployed static site.

Local server CORS environment currently lists localhost:5173; code adds local mobile-web development origins. A hosted Express service must allow exactly the existing Vercel HTTPS origin through CLIENT_URL for REST and Socket.IO. No hosted CORS/environment values were inspected because no hosting-account access exists.

Uploads in latest code are served by Express at `/uploads`; they require persistent backend storage and URLs targeting the backend origin. Supabase PostgreSQL does not automatically store those filesystem photos. No Supabase public user avatar paths are currently populated (zero relative or absolute avatar URLs). Actual live upload/storage configuration remains unknown.

## Exact Supabase schema comparison

Compared catalog metadata against actual latest local PostgreSQL, without running startup migrations remotely.

| Catalog | Existing Supabase | Latest local |
|---|---:|---:|
| Public application tables | 13 | 19 |
| Columns | 109 | 162 |
| Constraints | 49 | 75 |
| Indexes | 36 | 55 |
| Relevant trigger definitions (event rows) | 0 | 12, representing 7 triggers |
| Rating/notification functions | 0 | 4 |

Supabase is missing these six local tables:

`ai_messages`, `emergency_requests`, `emergency_declines`, `notifications`, `push_devices`, `push_deliveries`.

Existing tables are missing these six columns:

- `users.nid_number`
- `jobs.photos`
- `bookings.photos`
- `bookings.service_description`
- `bookings.job_application_id`
- `bookings.request_key`

Other verified differences:

- Supabase users_role_check permits household/helper/admin only; latest local also permits both. Dual-role registration requires the reviewed constraint migration.
- Supabase helpers.avg_rating still defaults to 0; local removes this default and refreshes ratings from actual reviews.
- Supabase lacks unique review-per-booking, unique proposal-to-booking and per-user booking-request-key indexes, plus active schedule/indexing and notification device/event constraints.
- Supabase has no current rating refresh or marketplace notification triggers/functions.
- Supabase migration history and Edge Function list are empty. SQL-editor/manual schema creation can explain existing tables without recorded migrations; empty history does not mean empty database.
- Duplicate non-null review booking groups: 0 at audit time. Recheck before adding the unique index; do not delete records to force it through.
- No extra live public columns relative to local schema were found. Preservation still requires reviewing migrations and current activity before applying them.

The new backend expects these schema additions. Deploying new frontend alone or pointing new backend at this older schema is insufficient.

## Confirmed security blocker

Supabase advisor reports RLS disabled on **all 13 public tables**. Catalog checks confirm `anon` has SELECT, INSERT, UPDATE and DELETE privileges on all 13, including users, bookings, conversations, messages, payments and complaints.

This is a critical direct Data API access risk if that API is enabled. The Express JWT/role checks do not protect direct Supabase Data API access. No anonymous key was retrieved and no private-row or write probe was attempted. Actual API enablement was not inspected.

Before public release, review Data API exposure and restrict anon/authenticated access or enable appropriate RLS on existing and newly added tables. This application currently uses **Express-issued JWTs and integer user IDs**, not Supabase Auth identities; do not paste a policy comparing auth.uid() to these integer IDs. Confirm the privileged backend connection remains functional and test access policies before rollout. No remote grants/RLS were changed during this audit.

Advisor remediation: [Supabase RLS-disabled advisor](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

## Safe local fixes completed

1. AI chat now uses the shared API request helper instead of its separate localhost fallback. API origin and `/api` suffix are consistent; history/send retain auth headers.
2. Chat and emergency Socket.IO clients share normalized socket configuration. VITE_SOCKET_URL may be omitted to reuse the API origin.
3. Relative user/helper avatar URLs resolve against the configured backend instead of incorrectly loading from Vercel.
4. Invalid HTML/non-JSON API responses produce a deployment/configuration error message instead of a raw JSON parse failure.
5. Vercel builds reject missing/non-HTTPS/local/credential-bearing backend URLs. Same-origin Caddy builds and local Vite development remain supported. This does not test whether a syntactically valid API URL is actually healthy.
6. Server rejects Supabase transaction-pooler port 6543 because notification dispatcher uses session-scoped PostgreSQL advisory locks. Use the existing project's direct or session-pooler connection on port 5432 with verified TLS. No database target/credential was changed.
7. Environment examples and deployment docs now identify the existing Vercel/Supabase architecture and prohibit restoring a local dump over the existing production records.

Tests executed for these changes:

- `client`: `node tests/productionConfig.mjs` PASS: same-origin/cross-origin API, AI history/send, auth headers, socket/media URLs, invalid JSON response and actual Vercel config callback guard.
- `client`: `npm run build` PASS, final asset `/assets/index-C8tk1R1p.js`.
- `server`: `node tests/staticCheck.js` PASS: 92 application JS/JSX files; narrow parse/binding check, not full lint/type checking.
- `server`: `npm run test:config` PASS: URL and explicit-host transaction pooling rejected, session-pooler TLS verification retained despite URL overrides; no DB connections opened.
- `git -c core.safecrlf=false diff --check` PASS.

These fixes are local and have not changed the existing Vercel production deployment. No push or deployment performed.

## Recovery order: preserve existing projects and records

1. Export/back up **existing Supabase** schema/data and any existing backend uploaded media. Local backups represent a separate local database, not a copy of these 31 production users. Never restore a local dump over this project. Keep current Vercel deployment available for rollback.
2. Inspect the existing Railway account/service: check whether this domain was removed/renamed, service stopped or deployment failed. Restore the correct existing service/domain if available. Record the real healthy HTTPS backend URL; do not assume the old URL will become valid.
3. Review Supabase direct API/RLS security and migration preflight. Apply only reviewed schema additions/constraint/function changes to the existing project after backup. Do not seed fake records or reset tables. Audit current defaults/grants for newly created tables as well.
4. Configure hosted Express: production NODE_ENV, provider PORT, existing Supabase DATABASE_URL (direct/session mode), verified TLS, strong private JWT_SECRET, `CLIENT_URL=https://atyour-service.vercel.app`, correct TRUST_PROXY and persistent UPLOAD_DIR. Configure Gemini server-side; keep push disabled until EAS/FCM ready. Preserve JWT_SECRET if existing sessions must remain valid, provided it meets strength requirements.
5. Start the reviewed backend against the existing project. Verify `/api/health`, allowed-origin preflight, login/role/object protection, authenticated Socket.IO/WSS, durable uploads and AI. Use staging or existing documented demo accounts carefully; do not run fixture-cleaning/local integration scripts blindly against production.
6. On the **existing Vercel project**, retain Root Directory `client`, npm ci, npm run build and output `dist`. Set Production VITE_API_URL to the verified backend HTTPS origin (optional `/api`); set VITE_SOCKET_URL to its HTTPS socket origin or leave blank. Confirm Git integration/deployment branch/commit in the dashboard, then redeploy reviewed source. Vite variables are compiled at build time; changing them requires a new build.
7. Set Android EXPO_PUBLIC_API_URL to that same working HTTPS API. Build/test the existing Expo application; EAS/FCM/signing and physical delivery remain separate pending gates. No new app/site/database project required.

This repository's standalone Compose template creates its own PostgreSQL service and is an alternative template, **not the migration plan for your existing Supabase/Vercel deployment**. Preserve those existing services.

References: [Vite environment/build behavior](https://vite.dev/guide/env-and-mode), [Vercel Vite configuration](https://vercel.com/docs/frameworks/frontend/vite), [Supabase direct/session connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

Vercel currently documents WebSocket Functions support in beta; this site's static Vite deployment has no configured backend Function and does not automatically host the repository's Express server. Keeping the existing long-running Express/Socket.IO service is the smallest recovery path. [Current Vercel WebSocket documentation](https://vercel.com/docs/functions/websockets).

**Conclusion:** frontend hosting and existing Supabase database are live. Configured backend is unavailable; frontend and database schema are outdated; latest backend/mobile functionality still needs controlled deployment and production verification. Supabase direct-access security must be addressed before release.
