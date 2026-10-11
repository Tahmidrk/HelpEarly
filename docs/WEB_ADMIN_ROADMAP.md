# HelpEarly centralized web-only administration roadmap

Added October 11, 2026 from the owner's supplied requirements. **Status: implemented and tested locally; production rollout and physical verification pending.** See [actual completion report](WEB_ADMIN_COMPLETION.md), which supersedes the historical gap assessment below. Current Android source/export removes administration; the existing signed preview APK predates this change. Branding remains unapproved.

## Original foundation and gap assessment (historical)

Reuse `client/src/pages/AdminDashboard.jsx`, the existing Express admin/complaint routes, authenticated Socket.IO revision recovery and the existing Supabase PostgreSQL database. The current website already has account search/filtering, activation controls, helper verification, complaint notes/status and database-backed overview statistics. Existing admin routes apply authentication and server-side administrator authorization. Account updates already guard self-deactivation/demotion and disconnect inactive accounts' sockets.

The Android app currently imports and exposes `AdminDashboardScreen`. Category routes currently expose reads; category visibility/management and durable administrative audit logging are not complete. Deletion endpoints need explicit self-delete/last-administrator protection and preservation rules before expanded use. These observations are source review, not proof that all requested workflows have passed.

## Implementation scope

1. **Web-only administration:** remove or disable Android admin dashboard navigation, screens and privileged controls while retaining server-side administration and the existing React dashboard. Define a clear unsupported-admin-session response on mobile without changing ordinary users' navigation. Do not use User-Agent, platform headers or hidden navigation as authorization. Every privileged request still requires a server-authorized administrator.
2. **Accounts and workers:** search/filter accounts, show roles and real statistics, activate/deactivate accounts, inspect worker profiles/services/categories/availability, verify/unverify workers and moderate inappropriate information. Reject protected REST and socket operations from suspended accounts even with an existing token. Prevent self-promotion, self-lockout and loss of the last active administrator.
3. **Categories and services:** add validated category management/visibility only where supported by the existing model. Review any required additive migration in isolation; do not repurpose historical category relationships. Hidden categories must disappear from applicable discovery on both platforms without deleting existing bookings or service history.
4. **Marketplace monitoring:** show bookings/statuses, jobs/proposals, reported activity and emergency requests/statuses with authorized administrative actions only. Preserve emergency eligibility and atomic acceptance. Never silently change financial amounts, completed bookings or historical records.
5. **Complaints and moderation:** show complaint details, investigation notes and status, moderate supported reported content and notify affected users of relevant decisions through the existing database-backed inbox/outbox. Limit private record access and avoid exposing unrelated messages or sensitive identity information.
6. **Real analytics:** query accurate users, workers, bookings, jobs, completed services, complaints, reviews and relevant marketplace activity. Use no fabricated totals; reconcile filtered/paginated counts with their filters.
7. **Security and audit:** validate every administrative input and enforce server-side role authorization on every privileged API/socket action. Do not trust client-supplied roles. Record actor, action, target, timestamp and authorized outcome in a durable audit log; exclude credentials and unnecessary personal content. Define access/retention and failed-attempt logging. Sensitive mutations and their successful audit records should be transactionally consistent. Confirm sensitive actions; prefer reversible moderation and prevent accidental destructive deletion.
8. **Shared synchronization:** persist administrative writes in the existing PostgreSQL database through Express. Use authenticated Socket.IO hints plus authoritative refresh/revisions. Recover missed changes on reconnect/resume. Verify worker verification, account suspension, complaint decisions, category visibility and moderated content from both clients. Account suspension must enforce authorization independently of cache refresh.
9. **Website usability:** reuse current React dashboard with appropriate management tables, search/filters, verification controls, complaint details, status indicators, confirmations and loading/error/empty states. Keep existing branding. No separate admin backend, duplicate database or extra hosting project.

## Acceptance and release gates

Run against an isolated database first and record actual results, then obtain approval for production changes. Required checks:

- Web admin login succeeds; non-admin household/worker/dual accounts cannot reach privileged routes, REST APIs or socket operations. Roles cannot be promoted through ordinary profile/register requests.
- Android has no reachable admin dashboard, management navigation or privileged controls. Ordinary household/worker/dual UI source and rendered behavior remain unchanged.
- Web verification/unverification updates discovery/profile on both platforms, including reconnect and app resume.
- Account deactivation revokes existing protected REST/socket access; self-lockout and last-active-admin removal are rejected.
- Complaint notes/decisions, notifications and category/content changes persist and synchronize without exposing private records.
- Dashboard totals/filters reflect real database rows. Audit actor/action/target/time/outcome are correct and inaccessible to ordinary accounts; rejected operations do not fabricate success records.
- Regression coverage includes booking/lifecycle/photos, chat, job posting/photos, proposal acceptance, emergency concurrency, reviews, complaints, notifications, AI history, authentication and logout/login persistence. Compare existing record counts/relationships and media before/after approved rollout.
- Run paired physical Android/Web tests on the exact resulting preview APK. Build/API protocol checks alone do not count as physical verification.

Preserve the existing Vercel project/domain, Render Free Express service, Supabase records/private media, Android package/signing identity and zero-cost architecture. Any live migration, permission change or deployment needs the owner's required approval; migrations additionally need a fresh verified backup and isolated restore/validation. Keep code, database/media and configuration rollback evidence.

After these functional and device gates pass, request explicit approval to begin the separate branding audit/proposal. Obtain design approval before implementation, then full regression/physical testing before the final signed APK. This document does not authorize branding, production changes or an extra EAS build.
