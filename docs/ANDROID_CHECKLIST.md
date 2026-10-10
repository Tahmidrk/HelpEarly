# Physical Android verification (pending)

Use two accounts/devices, or household web plus worker phone. Use preview APK for push; Expo Go alone is insufficient. Record device model, Android version, app version, commit, API endpoint and result for each step.

1. Install preview APK. Deny notification permission initially; ordinary app and inbox must still work. Enable later from Profile → Notifications; confirm registration.
2. Register a household and an Electrical worker with unique identifiers. Worker has Electrical category, no Cleaner services and no invented rating/reviews. Set worker location, phone, services, positive rate and availability. Edit and reopen profile.
3. Log out/in; close/reopen app; records persist. Dual-role account switches household/worker, sees correct tabs, never discovers/books/messages itself. Slow/offline errors must not show success.
4. Household searches/filter workers, opens profile, enters custom work, fee, valid date/time/address, attaches a real photo, submits once. Repeated submission produces no duplicate; overlap gets a conflict. Photo opens after server restart.
5. Worker sees booking update without reopening app; confirms, starts, completes. Household sees status; only then posts one review. Duplicate or pre-completion review fails. Cancellation/reschedule conflict checks remain correct.
6. Household posts job with photo; eligible worker proposes price. Household views and accepts. Confirmed booking appears for both; competing proposals close. Complete the booking and confirm job becomes completed.
7. Send messages in both directions while chat open, while another conversation open, and after returning to Inbox. No mixed-conversation messages. Logout/in retains history.
8. Household triggers Electrical emergency. Available matching worker sees alert/list details; wrong-category/unavailable worker cannot accept. Accept from two workers simultaneously: one confirmed booking only. Test decline (other worker still eligible), household cancellation, and 30-minute expiry.
9. Household and worker submit a complaint only about a real booking counterpart. Admin reviews/resolves it; complainant sees status and admin notes in My complaints. Verify/unverify worker; status and notification update. Banned account loses REST/socket access.
10. AI asks worker names, offered-fee instructions and follow-up questions; authentic records and own history persist; it must never claim to create bookings or expose another user's private records.
11. For each of booking/proposal/chat/emergency/complaint/verification events, test foreground, background and normally closed app push with real FCM credentials. Tap opens correct authorized screen. Check Expo ticket **and receipt** plus visible phone delivery. Test denied permission, invalid token and registration refresh.
12. Disable push; no further remote updates. Log out, log in as another user on the same phone: previous user's updates must not route to the new account. Restore app/server; DB and photo data remain.

Android Force stop/OEM battery controls may suppress remote delivery until reopening. These conditions are not evidence that background delivery passed. Do not mark this checklist PASS until executed on a physical phone.
