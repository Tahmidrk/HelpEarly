# HelpEarly preview installation and real Android test

**Status: physical tests NOT RUN.** First preview APK has no verified native FCM configuration. Use it for functional testing now; use a rebuilt FCM-configured preview for push tests. Both use the existing backend and Supabase records. Preserve existing user records; use explicitly labeled test accounts and ordinary supervised actions.

## Install

1. Copy `H:/apps/HelpEarly-artifacts/HelpEarly-preview-20261011.apk` to the phone, or open the [existing EAS build](https://expo.dev/accounts/tahmid_041/projects/at-your-service/builds/1d3a2f1e-35fa-4ae6-a126-4924211fabc1) and select Install.
2. Open the APK in Android Files and allow installation from that source when prompted. Turn that permission off afterward. Keep Play Protect enabled. Do not bypass a malware warning.
3. Launch the app named **At Your Service**, its existing approved name. If Android reports a signature/install conflict, stop and record the error; do not uninstall an existing application automatically. App data must not be deleted to conceal a failure.
4. Before presentation open https://helpearly-api.onrender.com/api/ready once. Render Free may need 50 seconds or more after sleep. Wait for readiness, then log in on phone and https://atyour-service.vercel.app/.

## Ordered functional checklist

1. Use a household account on phone and worker account on web. Verify worker trade, own services, no invented reviews/rating, and dual-role self-exclusion.
2. Update each account's profile from one client; confirm it from the other after switching to that same account. Do not edit unrelated users.
3. Phone household: browse Electrical worker → book → type custom service and offered fee → upload photo. Web worker: confirm booking. Confirm identical booking ID, fee, photo and status on both clients.
4. Web household: post a job with photo. Phone worker: submit proposal. Web household: accept. Phone worker: confirm the resulting booking appears once.
5. Send chat messages in both directions. Complete a supervised test booking; household submits a real test review. Verify review/rating on both clients and ensure unrelated users cannot read private chat/history.
6. Submit a labeled complaint from phone; existing authorized admin resolves it on web. Confirm status/inbox on phone. Verify a test helper through admin and check discovery from phone.
7. Test emergency request/acceptance only with consenting participants in a supervised demo. Production broadcasts can notify existing workers; coordinate first. Confirm household/worker status and booking agree across both clients.
8. Ask AI for Electrical workers and booking fee instructions. Ask a follow-up. Log out/in; confirm saved history remains on phone/web. Sign into a different account and confirm previous account's private history is absent. Dual roles of one account intentionally share that account's AI history.
9. Turn phone network off. Change a test booking/chat from web. Restore network and return app to foreground. Confirm missed updates recover without duplicate records. Repeat with app in background for 1–2 minutes and after ordinary close/reopen.
10. Log out/in on both clients. Verify all saved jobs, bookings, chats, photos, complaints and AI history persist. Record any failed action/error verbatim; do not mark a row PASS merely because its API test passed.

## FCM checklist after configured rebuild

1. Install the new preview signed with the same keystore. Profile → Notifications → Enable push; grant Android notification permission. Confirm authenticated device registration privately; never publish its push token.
2. From another test account, create/update a booking or send a message. Test foreground, background and normal closed-app delivery; tap notification and verify the correct authenticated screen and current record.
3. Confirm ticket and receipt status in the private backend/database. Receipt polling begins after 15 minutes; an accepted receipt and a visible phone notification are separate evidence.
4. Deny notification permission, reopen, then grant through Android Settings. Verify clear status and functioning in-app inbox.
5. Log out and switch accounts on the same phone; verify previous account no longer receives private alerts. Test repeated foreground/network reconnects for duplicates.
6. Android **Force stop** blocks delivery until reopening; do not treat that OS behavior as ordinary background delivery. Record OEM battery restrictions and test another ordinary background transition.

## Evidence to record

Use one row per workflow: date/time (Dhaka), phone model/Android version, APK build ID/hash, test roles, record ID, action on Web/Android, expected result, actual result, PASS/FAIL/NOT RUN, and a redacted screenshot. Never include passwords, tokens, NID numbers, precise addresses or unrelated user messages in shared evidence. Add evidence only after execution; currently every physical-device row is NOT RUN.

## Safest 3–5 minute demo

Warm Render first. Show household phone booking with custom fee/photo → worker web acceptance → shared booking status → two-way chat → one already completed test booking's review → real AI answer and persisted history. Use existing consenting demo roles. Job/proposal and admin screens can be shown as prepared records if time permits; do not fake a successful action or trigger an uncoordinated emergency. Keep existing website ready as fallback while diagnosing a phone issue. Temporary local/tunnel fallback remains a supervised alternative described in `FREE_STACK_STRATEGY.md`, not permanent hosting.
