# HelpEarly: production database and media approval proposal

Prepared and applied 2026-10-11. **Owner-approved changes completed after verified production backup and isolated restore.** Target is the existing Supabase `at-your-service` project, ref `gjwkrqlzroujlueexcxc`. Original records were preserved; Render credential configuration/redeploy was separately approved and completed.

## Completed release evidence

Fresh production backup: `H:\apps\HelpEarly-backups\supabase-production-2026-10-10T20-01-10-313Z`. Scope is all 13 public application tables, data, sequences, routines, triggers and ACL; managed Supabase schemas are excluded because this migration does not modify them. Production Storage was empty and that inventory was verified separately. This is not a claim of a full managed Supabase project backup.

The custom-format dump was restored into a newly created local database. Every original row fingerprint/count matched; foreign keys restored; the exact reviewed migration passed against the restored real records. Only then was that migration applied live. All 13 original table counts and original record fingerprints still match, excluding the explicitly approved derived helper rating/count fields. Schema is now version 2 with 22 tables, all with RLS; direct PUBLIC/anon/authenticated table grants are zero. Anonymous Data API access to users returns 401. Private bucket `helpearly-media` has the reviewed 5 MB/MIME restrictions. Actual private upload/read/signed URL, public-access denial, MIME rejection and cleanup passed.

Evidence: [production migration](test-results/supabase-production-release-20261011.json), [live Storage](test-results/supabase-storage-live-20261011.json), [Data API denial](test-results/supabase-data-api-security-20261011.json), [external API/WSS/workflow tests](test-results/render-mvp-live-20261011.json). Disposable test accounts/media were removed and original records were rechecked. No live emergency broadcast was sent to existing workers.

Post-migration security advisor reports no RLS-disabled errors. Its 22 no-policy INFO findings reflect the intentional Express-only access model. Six mutable function-search-path WARN findings remain for a separately reviewed hardening change; this release did not silently expand the approved SQL scope. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

## Pre-migration read-only evidence (historical)

Project is `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.121. Live public schema has 13 tables, 109 columns and 49 constraints; 18 standalone indexes plus constraint indexes. Its catalog matches the previously tested `server/tests/fixtures/supabase-schema-20261010.json` exactly. No schema version marker exists. Current application expects **22 tables and schema version 2**, not the older 19-table estimate.

Observed counts remain: users 31, helpers 22, bookings 10, jobs 12, messages 27, reviews 5, complaints 2. Duplicate non-null review booking groups: zero. All 13 tables have RLS disabled and anon table grants; no public policies exist. Data API exposure configuration itself was not verified. Storage has zero buckets and zero objects. Queries read catalog metadata/counts only; no live records or permissions were changed.

## Exact proposed database change

Use the existing `server/db/migrate.js` runner and `server/db/ensureSchema.js` at application commit `834deb43a6a64710955110ead773036133d93388`. It runs baseline/additive SQL plus `production.sql`, `free-stack.sql` and `api-security.sql` under one transaction and advisory lock. Do not execute only the final schema marker, bypass startup, or run a destructive schema reset.

- Preserve existing records and IDs. Add missing fields, indexes, nine tables, notification/outbox/media/sync state and triggers required by current code.
- Allow the `both` user role. Remove default worker rating and recompute helper rating/count aggregates from existing real reviews. Those aggregate fields intentionally change; source reviews remain intact. Add missing service categories without replacing existing ones.
- Enforce one review per booking and one accepted application booking. Existing conflicts must abort/roll back; never silently delete duplicates or real records to make migration succeed.
- Enable RLS on the 22 application tables, revoke direct PUBLIC/anon/authenticated table access and application RPC execution, and restrict future default privileges for the migration owner. No permissive policies are added. Owners/service_role retain access; Express owns JWT authentication. This intentionally stops unsupported direct Data API access. Review any other consumers before approval.

Reviewed file SHA-256 values:

| File | SHA-256 |
|---|---|
| `server/db/ensureSchema.js` | `FED5CFEF142EB85BD4DE88EEE5344E684140D192606DD24A20F67B9DC7A38924` |
| `server/db/schema.sql` | `728D3782EB1D2E63B7B095DA17F6AC374553C64AC35611ED8759449B54F872A2` |
| `server/db/migrations/production.sql` | `D63D16E91C133733E0C41BF73DB7D465BCD0758599591ABA26B9C885202C2FF9` |
| `server/db/migrations/free-stack.sql` | `4BE742D6DA2619C1EEC1A9E7150B657292D96688422071E9BDF2DF108FAC3C07` |
| `server/db/migrations/api-security.sql` | `8F9A0F010616E9B81C60CF5E5916D80D109D86CFC7FB3874046D955057B519CC` |

## Proposed persistent media setup

Create one dedicated **private** bucket `helpearly-media` in the same project, with 5 MB limit and JPEG/PNG/WebP/GIF allowlist. Do not create anon/authenticated Storage policies, make the bucket public, overwrite objects or delete existing media. Server-only service-role credentials belong in private Render environment settings. Authorized API responses provide short-lived signed URLs through the existing storage abstraction.

## Executed validation and mandatory prerequisites

The earlier isolated suite passed migration preservation/repeatability, complete rollback on duplicate legacy reviews, read-only production startup rejection, non-owner RLS/table/RPC denial, 14 database-backed MVP groups, 20 security/concurrency/outbox groups, API restart persistence and paired Web/Android API recovery. Evidence: [test-results/free-stack.json](test-results/free-stack.json), executed 2026-10-10 19:09 UTC (2026-10-11 Bangladesh time). Fresh catalog equality confirmed that its fixture matched the live pre-migration schema. Live Storage tests have now passed separately; physical Android and FCM delivery remain pending.

Before any future live migration: obtain the actual direct/session-pooler connection on port 5432 with verified TLS privately, take a fresh **production** dump, and verify an isolated restore including record counts/relationships. This release satisfied that gate using the verified backup above. Provider backup availability was not relied on. Available connector tools do not expose PostgreSQL connection passwords. Do not infer backup existence from project health or buy backup features.

For private connection setup, use the existing project's **Connect → Session pooler** connection string, not transaction mode/6543. Save it privately as `AUDIT_DATABASE_URL` in ignored `server/.env.audit`, keeping `server/.env` unchanged, or configure private provider settings. Never paste it into chat. Use the actual password and provider CA where required; do not reset passwords or disable TLS verification automatically.

After backup/restore validation and explicit approval, execute only the reviewed migration, compare preserved records/counts, confirm schema version 2 and authorization/RLS behavior, then verify private storage. A migration error rolls back the transaction. For later app rollback, prefer reverting code/config while retaining additive schema; restoring an older dump over new live activity needs separate approval.

## Approval boundaries

The owner approved the reviewed database migration **including RLS/grant remediation** and private bucket creation with the explicit condition: "Approve after verified backup and restore." That condition was satisfied before applying these exact changes. The owner separately approved sending the existing PostgreSQL URL, Storage service-role key and official CA to the existing Render service and redeploying it. These approvals do not authorize replacement of Vercel's live deployment, destructive operations, billing, password resets or branding. Production startup remains read-only; no automatic remote migration was introduced.

The owner subsequently approved deploying the tested React build to the **existing** Vercel project (`atyour-service.vercel.app`). That separate deployment approval is recorded; access to the Vercel account owning atyour-service.vercel.app is still required. It does not approve further database/security changes, a new website, billing or branding.

Owner requirement: the deployment request's Phase 3 says, “If production database migration is necessary, prepare and validate it first, then request my explicit approval.” This proposal makes that approval concrete; lack of credentials is a separate access requirement.
