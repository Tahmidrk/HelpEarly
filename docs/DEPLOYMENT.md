# HelpEarly setup, deployment, backup and rollback

**Current strategy:** [FREE_STACK_STRATEGY.md](FREE_STACK_STRATEGY.md) governs the existing Vercel + Render Free + Supabase DB/Storage deployment. Old Compose assets are historical alternatives, not the selected architecture. Production/remote startup no longer applies migrations; reviewed migrations require owner approval and `npm run db:migrate -- --approved`.

October 11, 2026 checkpoint: existing frontend `https://atyour-service.vercel.app/`, Render Free API `https://helpearly-api.onrender.com`, existing Supabase project `at-your-service`, and private Supabase media storage are deployed and tested. The old Railway outage/schema mismatch in `PRODUCTION_AUDIT.md` is historical. Local Express intentionally still uses isolated local PostgreSQL. See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md), [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) and the current [Android/AI verification report](ANDROID_NEXT_PHASE.md) for actual remaining gates.

For this existing deployment, preserve the current Vercel project and Supabase records. Follow the existing-stack recovery order in the audit. **Do not restore the local database dump over the existing Supabase database.** The standalone Compose assets are historical alternatives, not instructions to replace this existing architecture.

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

1. Existing Android app is now linked to `@tahmid_041/at-your-service`, project `af6f6973-68c9-4e56-af9f-1e8896877b9d`. Keep this project and signing identity. `app.config.js` reads its linked `app.json` metadata; `EAS_PROJECT_ID` remains an optional explicit override. Do not initialize a replacement project.
2. In Firebase Console create/select the intended Firebase project. Add an Android app whose package is exactly `com.atyourservice.app`. Download its `google-services.json` to `mobile/google-services.json` (ignored). For EAS upload it as a **file** variable `GOOGLE_SERVICES_JSON` in the matching preview/production environments. It is not the FCM service-account private key.
3. Enable Cloud Messaging API v1. Firebase Project settings → Service accounts → Generate new private key. Store this service-account JSON outside the repository. Upload it through `npx eas-cli credentials --platform android`: Android → production → Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Upload a new key. Use the same Firebase project as google-services.json. The key needs Firebase Cloud Messaging API Admin permission. Do not paste it into app code or EXPO_PUBLIC variables.
4. Both EAS preview and production profiles now set `EXPO_PUBLIC_API_URL=https://helpearly-api.onrender.com`. Use this shared HTTPS backend for the university APK and website. Upload the Android Firebase file variable separately for each build environment before generating a push-capable APK/AAB.
5. Build installable preview: `npx eas-cli build --platform android --profile preview`. First preview build was submitted on October 11; its current evidence and notification limitations are in [ANDROID_NEXT_PHASE.md](ANDROID_NEXT_PHASE.md). Expo account is Free and an Android keystore was generated in EAS and backed up privately. Future Play Store AAB uses `--profile production`, after branding approval and final regression/device gates; do not submit or purchase a Play account now. APK/AAB signing and Play submission are separate from JavaScript export.
6. Optionally enable enhanced push security in Expo project settings and put its access token in backend `EXPO_ACCESS_TOKEN`. Set backend `PUSH_ENABLED=true` only when real credentials are ready. Never expose the access token in mobile configuration.
7. Install the APK on a physical phone; log in; Profile → Notifications → Enable push; grant Android notification permission. Confirm a row is registered for that authenticated user. Trigger a real booking from a second account. Inspect **both** ticket and receipt: `SELECT id,status,ticket_id,last_error FROM push_deliveries ORDER BY id DESC LIMIT 20;` Do not query/log token values publicly. Receipt processing runs after 15 minutes; `delivered` means the provider accepted delivery, not that the person saw it.
8. Test foreground, background and normally closed app; tap each event and verify the authenticated destination. Test denied permission, token rotation, logout, another account on the same phone, and invalid-token deactivation. Android Settings → Force stop prevents delivery until reopening; OEM battery restrictions may also interfere. Record actual physical-device results.

Reference: [Expo FCM v1 credential setup](https://docs.expo.dev/push-notifications/fcm-credentials/), [EAS configuration](https://docs.expo.dev/eas/json/), [Expo push tickets and receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

## Backend notification operations

Production/remote startup only checks the schema. Reviewed migrations run separately after owner approval (`npm run db:migrate -- --approved`). Local non-production startup can initialize local PostgreSQL. Committed marketplace changes create user-owned notification rows in the same transaction through triggers. A failed/rolled-back booking/proposal does not create successful-action notifications. Events cover booking status, proposals, saved messages, emergencies including expiry, complaint updates and verification changes.

Dispatcher runs every two seconds under a PostgreSQL advisory lock. Events update active Socket.IO sessions and remain retrievable from the inbox when disconnected. Each event/user and event/device pair has a uniqueness constraint. Pushes contain a generic title/body and record IDs only; details are fetched after login. Device registration/rotation/deactivation use the authenticated user, not a client-supplied user ID. Logout revokes opted-in device registration before clearing local auth. If revocation fails, reconnect and retry logout.

Definite rate-limit/server rejection retries at most five times. Unknown network outcomes remain `unknown` rather than being blindly resent and duplicating alerts. Monitor failed/unknown deliveries; a generic inbox notification remains available. Invalid devices are disabled on ticket or receipt errors. In-memory REST rate limits are suitable for a **single** API instance; a multi-instance deployment needs shared limits and a Socket.IO adapter. This template deliberately deploys one instance.

## Selected hosting: Render Free, existing Supabase and Vercel

Follow [FREE_STACK_STRATEGY.md](FREE_STACK_STRATEGY.md) for the exact approval, backup, schema/security, private Storage, Render and existing Vercel rollout sequence. `render.yaml` selects Free with no disk. Media uses Supabase Storage; the API remains portable. Existing Compose assets are not the supported deployment route for this project and must not replace the existing Supabase database or Vercel website.

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

HTTPS hosts/domain, external WSS/photo/database workflows, the real EAS link/signing setup, and real Gemini responses/history are verified. Native build, Firebase credentials and physical-device status must be read from the current [Android/AI verification report](ANDROID_NEXT_PHASE.md); physical Android walkthrough and real push receipts remain pending until executed. `npm audit` still flags SDK build-tool advisories and React Router/Vite advisories requiring incompatible major changes or vendor fixes. No automated protocol test replaces physical-device checks.
