# HelpEarly setup, deployment, backup and rollback

Existing production frontend: `https://atyour-service.vercel.app/`. Existing Supabase project: `at-your-service`. The production architecture audit in `docs/PRODUCTION_AUDIT.md` found the frontend's configured Railway API unavailable and the Supabase schema older than local source. Local Express still uses local PostgreSQL. EAS/FCM and a working hosted API remain unverified.

For this existing deployment, preserve the current Vercel project and Supabase records. Follow the existing-stack recovery order in the audit. **Do not restore the local database dump over the existing Supabase database.** The standalone Compose instructions below are an optional alternative template, not instructions to replace this existing architecture.

## Local development

Use Node 22.13+ (tested locally with Node 24.14.1) and PostgreSQL 17. Copy `server/.env.example` to `server/.env` and fill your database password, a random JWT secret and optional Gemini key. Keep all real environment files private.

```powershell
cd H:\apps\HelpEarly\server
npm ci
npm run db:init
npm start
```

In a second terminal run `npm ci` and `npm run dev` from `client`. For Android, run `npm ci` and `npx expo start` from `mobile`. On a physical phone, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to `http://` followed by your computer's actual Wi-Fi LAN IP and `:5000/api`; keep both devices on the same Wi-Fi and allow port 5000 on the private network. The emulator fallback is `10.0.2.2`. Restart Metro when changing environment values.

Expo Go supports ordinary app flows and the authenticated in-app notification inbox. Remote Android push requires an installed native build. No tokens or FCM keys are needed just to work locally.

## Expo EAS and Android FCM

1. In `mobile`, run `npx eas-cli login`, then `npx eas-cli init`. Link/create the intended Expo project. Set its actual UUID as `EAS_PROJECT_ID` in local `.env` and in the Expo project's preview and production environments. Dynamic `app.config.js` uses it.
2. In Firebase Console create/select the intended Firebase project. Add an Android app whose package is exactly `com.atyourservice.app`. Download its `google-services.json` to `mobile/google-services.json` (ignored). For EAS upload it as a **file** variable `GOOGLE_SERVICES_JSON` in the matching preview/production environments. It is not the FCM service-account private key.
3. Enable Cloud Messaging API v1. Firebase Project settings → Service accounts → Generate new private key. Store this service-account JSON outside the repository. Upload it through `npx eas-cli credentials --platform android`: Android → production → Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Upload a new key. Use the same Firebase project as google-services.json. The key needs Firebase Cloud Messaging API Admin permission. Do not paste it into app code or EXPO_PUBLIC variables.
4. Set `EXPO_PUBLIC_API_URL` to the real API endpoint for each EAS environment. Preview may use your reachable LAN API while the phone is on Wi-Fi; production requires an actual HTTPS origin. Set project UUID and file variable for both build profiles.
5. Build installable preview: `npx eas-cli build --platform android --profile preview`. Build Play Store AAB: `npx eas-cli build --platform android --profile production`. These commands require your Expo account and signing credentials; they have not been run here. Review any paid-build limits before starting. APK/AAB signing and Play submission are separate from a successful JavaScript export.
6. Optionally enable enhanced push security in Expo project settings and put its access token in backend `EXPO_ACCESS_TOKEN`. Set backend `PUSH_ENABLED=true` only when real credentials are ready. Never expose the access token in mobile configuration.
7. Install the APK on a physical phone; log in; Profile → Notifications → Enable push; grant Android notification permission. Confirm a row is registered for that authenticated user. Trigger a real booking from a second account. Inspect **both** ticket and receipt: `SELECT id,status,ticket_id,last_error FROM push_deliveries ORDER BY id DESC LIMIT 20;` Do not query/log token values publicly. Receipt processing runs after 15 minutes; `delivered` means the provider accepted delivery, not that the person saw it.
8. Test foreground, background and normally closed app; tap each event and verify the authenticated destination. Test denied permission, token rotation, logout, another account on the same phone, and invalid-token deactivation. Android Settings → Force stop prevents delivery until reopening; OEM battery restrictions may also interfere. Record actual physical-device results.

Reference: [Expo FCM v1 credential setup](https://docs.expo.dev/push-notifications/fcm-credentials/), [EAS configuration](https://docs.expo.dev/eas/json/), [Expo push tickets and receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

## Backend notification operations

Additive SQL migrations run before API listen. Committed marketplace changes create user-owned notification rows in the same transaction through triggers. A failed/rolled-back booking/proposal does not create successful-action notifications. Events cover booking status, proposals, saved messages, emergencies including expiry, complaint updates and verification changes.

Dispatcher runs every two seconds under a PostgreSQL advisory lock. Events update active Socket.IO sessions and remain retrievable from the inbox when disconnected. Each event/user and event/device pair has a uniqueness constraint. Pushes contain a generic title/body and record IDs only; details are fetched after login. Device registration/rotation/deactivation use the authenticated user, not a client-supplied user ID. Logout revokes opted-in device registration before clearing local auth. If revocation fails, reconnect and retry logout.

Definite rate-limit/server rejection retries at most five times. Unknown network outcomes remain `unknown` rather than being blindly resent and duplicating alerts. Monitor failed/unknown deliveries; a generic inbox notification remains available. Invalid devices are disabled on ticket or receipt errors. In-memory REST rate limits are suitable for a **single** API instance; a multi-instance deployment needs shared limits and a Socket.IO adapter. This template deliberately deploys one instance.

## Hosting option: one host, persistent volumes

`compose.yaml` provides PostgreSQL 17, the Express API and React web behind Caddy. The backend/DB ports are private; only 80/443 are published. Caddy routes `/api`, `/uploads`, and `/socket.io` to Express and serves the built React app at the same origin. HTTPS and WebSocket upgrades are handled by Caddy. PostgreSQL and photos use separate named volumes. This avoids losing uploads on ephemeral hosting.

No host was provisioned and no money spent. Docker Compose syntax was checked; container build/run awaits a running Docker daemon and a real host. The existing Render blueprint now explicitly requires a disk-capable plan and manual deployment, because the former free ephemeral filesystem could not preserve photos. Do not create a paid Render service without approval.

1. Arrange an approved Linux host with enough RAM/storage, Docker Engine and Compose. Point your actual domain's DNS to it. Permit inbound ports 80/443; restrict SSH; do not publish PostgreSQL or port 5000.
2. Transfer the reviewed Git commit. Copy root `.env.example` to root `.env`; set the real `APP_DOMAIN` hostname (no scheme), strong `DB_PASSWORD`, random `JWT_SECRET` (32+ characters), and server-only Gemini key. Push remains disabled initially. Protect `.env` with `chmod 600 .env`.
3. Back up the existing local database and uploads before migration. To preserve accounts/records, restore the custom dump into the **new empty target database**, and copy the old uploads into the target uploads volume before opening the site. Do not initialize demo users or reset the original database. Run `docker compose up -d db`, transfer a backup dump, then `docker compose exec -T db pg_restore -U helpearly -d at_your_service --no-owner --no-acl /tmp/database.dump`. Any restore error must be resolved before continuing. Startup adds only the necessary migration tables/columns; never run old cleanup/debug scripts.
4. Populate uploads using `docker compose create api`, identify its exact upload volume with `docker inspect`, and copy files into that volume using a temporary container. Preserve filenames so existing `/uploads/...` references keep working. Set ownership to the API's node user (UID 1000). Do not point the volume at a different folder with an empty directory.
5. Run `docker compose up -d --build`. Check API and DB health, container logs, and your real `https://DOMAIN/api/health`. `database: connected` must be returned. Log in through web; check discovery, uploaded-photo URLs, bookings and real-time chat through WSS. Test from outside your LAN. This external verification has not occurred.
6. Set the mobile production endpoint to the same real HTTPS domain. Run the database-backed tests against staging, **not a busy production system**: tests insert and remove only their own unique fixture accounts, but AI live tests compare global booking counts and need a quiet staging database.
7. Create a unique admin using `node db/createAdmin.js` with privately provided `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters). It never overwrites existing accounts. Disable/rotate intentionally documented local demo credentials before making a migrated database public. Gemini keys stay on the API host.

For a separately hosted PostgreSQL database, use `DATABASE_URL` in server settings, verify its TLS certificate by default, and set `DB_SSL_CA` to the provider CA when required. `DB_SSL_ALLOW_SELF_SIGNED=true` is an explicit exception; avoid it in production. The API removes URL SSL options so they cannot silently replace certificate verification; configure TLS through the documented server variables. [node-postgres documents this replacement behavior](https://node-postgres.com/features/ssl). Cross-origin web hosting needs explicit HTTPS `CLIENT_URL` entries plus matching `VITE_API_URL` and `VITE_SOCKET_URL` at build time. CORS is not a substitute for authentication.

Reference: [Docker persistent volumes](https://docs.docker.com/engine/storage/volumes/), [Caddy SPA and reverse-proxy patterns](https://caddyserver.com/docs/caddyfile/patterns).

## Backup and restore

Keep source, database, and uploads backups separate from secrets. Encrypt private backups and keep an offsite copy. A volume is persistent storage, not a backup. Stop writes for a consistent database/media checkpoint.

Local Windows backup (with PostgreSQL 17 tools installed):

```powershell
cd H:\apps\HelpEarly\server
node scripts/backup.js H:\apps\HelpEarly-backups
```

The script uses server environment settings without putting passwords in command arguments. It creates a timestamped custom-format `database.dump`, an uploads folder, and a restore note. Set `PG_DUMP_BIN` if your tool is elsewhere. Do not commit these files. `pg_dump` must be compatible with the database server version.

Restore drill into a **new, separate database**: set PostgreSQL authentication privately, run `createdb helpearly_restore_check`, then `pg_restore --no-owner --no-acl -d helpearly_restore_check ABSOLUTE_BACKUP/database.dump`. Verify schema, row counts and foreign keys; point a temporary API at it, run health/login/photo checks with a copy of the uploads directory. Never overwrite the working database to test recovery.

On the Docker host, stop only API/web writes (`docker compose stop api web`), generate the DB dump inside the db container with `pg_dump -U helpearly -d at_your_service -Fc -f /tmp/database.dump`, and `docker compose cp db:/tmp/database.dump` to a private backup directory. Archive the actual uploads volume (discover its exact name via `docker inspect`; do not guess). Copy backups offsite, then `docker compose start api web`. Schedule this through your host's backup system after hosting is configured.

## Rollback

Record the Git commit/image tag before each deployment and keep the last known good images, database dump, uploads archive, signing keystore and protected environment configuration. Restore application code/images to the previous reviewed version first; additive tables can remain. Do not reverse/drop migrations or restore an old database over new user activity without a reviewed recovery decision. If full restore is needed, restore DB/media together into a separate environment, verify them, then switch traffic. Never use `docker compose down -v` or database reset scripts on live data. Android rollback requires a newly signed build with a higher versionCode, using the same keystore.

## Remaining release gates

Real EAS UUID, FCM credentials, signing build, HTTPS host/domain, external WSS/health/photo checks, physical Android walkthrough and real push receipts remain pending. `npm audit` still flags SDK build-tool advisories and React Router/Vite advisories that would require incompatible major changes or vendor fixes; evaluate them before public production exposure. No automated claim replaces these checks.
