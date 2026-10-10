# Android / website parity audit

Baseline: `bdff65c`, captured before implementation on 2026-10-11. Scope: existing source, not the outdated live Vercel bundle. Every mobile screen is listed below; map and navigation components were also inspected. Hashes for all tracked mobile files are in `test-results/android-parity-baseline.json`.

| Feature | Android | Website at baseline | Action required |
|---|---|---|---|
| Login / registration | LoginScreen, RegisterScreen: persisted JWT, household/helper/both, category | Login/Register: same API and roles | Keep |
| Household home / helper search | HomeScreen, ExploreScreen: search, category, exclude self | Home/BrowseHelpers: search/filter; refresh incomplete | Fix refresh |
| Worker dashboard / availability | WorkerDashboardScreen: lifecycle, earnings, availability | HelperDashboard: equivalent lifecycle/earnings/settings | Keep; refresh owned profile |
| Helper profile / reviews | HelperDetailScreen: bio/services/reviews/map/booking/chat | HelperProfile: same API and records | Keep; refresh mobile internal data |
| Personal profile | ProfileScreen: name/phone/location, map | Profile: equivalent; stale after external changes | Fix sync without overwriting edits |
| Worker category / itemized service settings | ProfileScreen: category, service names/prices, rates/bio/experience | HelperDashboard: add/delete services and profile; no category or existing-service edit | Implement through existing settings endpoint |
| Booking description / household offered fee | HelperDetailScreen | Booking: supported | Keep |
| Booking / job photo attachment | HelperDetailScreen, JobsScreen | Booking/PostJob: uploads supported | Keep |
| Booking photos / description display | ExploreScreen, WorkerDashboardScreen: detail/photo | UserDashboard/HelperDashboard: photo/custom description absent | Implement |
| Reschedule / cancel | ExploreScreen: pending/confirmed reschedule and cancel | UserDashboard: pending cancel only | Implement reschedule and eligible cancellation |
| Job post / proposals / acceptance | JobsScreen: own posts, offers, accepted booking | PostJob/JobListings/JobDetail: equivalent; JobDetail lacks photo display | Keep workflow; implement photo display |
| Chat / history | ChatScreen: own conversations/messages | Chat: authenticated Socket.IO, same API | Keep; errors must surface |
| Emergency creation | HomeScreen: category/location/contact override | EmergencyModal: category/location, phone only from profile | Implement contact input |
| Emergency list / accept / decline / cancel | EmergencyScreen: persisted lists and status | Socket-only incoming modal/creation; no recoverable list | Implement authenticated page with sync |
| Notification inbox / read / destination | NotificationsScreen, openNotification: own durable inbox and role-aware navigation | Missing | Implement; native push remains Android-specific |
| AI / authorized persisted history | AiAssistantScreen: same API/history, initial-only load | AIChatbot: initial-only history, leaks local history across account changes | Fix account isolation and two-way refresh |
| Reviews | ExploreScreen / HelperDetailScreen: actual completed-booking reviews | UserDashboard/HelperProfile: same API | Keep |
| Complaints / admin response | ComplaintsScreen + booking complaint modals: status and notes | ComplaintPanel: create/list/status; no admin notes | Implement notes, preserve records on read errors |
| Dual roles | Profile/Home/WorkerDashboard: activeRole + server permissions | Navbar/ProtectedRoute/JobListings/JobDetail check stored role instead; both blocked | Fix active-role use and self-action hiding |
| Admin verification / account access | AdminDashboardScreen: helper profiles incl. both | AdminDashboard: verification only role=helper | Fix both-role helper verification |
| Admin investigation notes | AdminDashboardScreen: notes/status | AdminDashboard: status only | Implement existing API field |
| Map viewing | MapViewModal | AddressMap | Keep platform-specific presentation |
| Push | NotificationsScreen: opt-in Expo → FCM, credentials pending | In-app socket only | Keep native feature Android-specific; add web inbox |

Implementation priority: role correctness; persistent inbox/emergencies; booking/job media and reschedule; settings/admin notes; profile and AI sync. No mobile layout, JSX, styles, assets, navigation, app configuration or dependency changes are authorized. Internal hook/context updates only if required.

## Verification plan

- Compare mobile JSX and StyleSheet AST with captured baseline commit; hash all mobile files and report exact internal changes.
- Run web production build, Android Hermes export, Expo doctor, static checks, config checks and isolated database-backed MVP/security/sync tests.
- Add runnable component checks for new web paths and account/role isolation. Browser/native screenshot comparisons are pending: no connected Android device/emulator; browser automation was previously rejected by automatic security review and must not be bypassed.
- Preserve existing Render/Supabase/Vercel plan. No live migration, permission, bucket or deployment changes without owner approval. Existing deployment gaps remain documented in FREE_STACK_STRATEGY.md and PRODUCTION_AUDIT.md.

## Final results

Local parity implementation complete. No new Android UI or dependencies. The existing live Vercel site and Supabase database were not changed.

### Delivered

- Web `/notifications`: authenticated inbox, read state, verified conversation destinations, account-scoped role switching and retry/error/empty states.
- Web `/emergency`: persisted own/incoming requests, eligibility/status, accept/decline/cancel, accepted-booking link, initial/reconnect/periodic refresh. Existing creation modal now accepts contact phone and links to request history.
- Web household rescheduling and cancellation for backend-supported statuses; booking and job photos visible. Upload preview cleanup now happens on removal/unmount, preserving previous previews when another photo is selected.
- Worker primary category, existing-service name/price editing and service list changes through the existing transactional `/helpers/settings` API. Drafts survive background profile refresh.
- Complaint admin responses displayed; administrators can save investigation notes and verify dual-role worker profiles.
- Dual-role navigation, protected routes, job board and proposal controls use active role; no self booking/proposals. Account/role changes remount private route state. AI history is reset on account changes, loaded from the database and refreshed across platforms; the old local-only reset button now refreshes saved history.
- `/api/sync` now includes account-scoped AI revision and untouched-resource defaults. Both platforms refresh own profile after profile/helper invalidation. Android updates only internal hooks/context for home helpers, helper detail/reviews, availability and AI history. No schema migration required for this addition.
- Web chat now displays request errors, retains failed-send text and prevents late message responses entering another selected conversation. Existing persisted chat/socket behavior retained.

### Checks actually executed

| Check | Result | Scope |
|---|---|---|
| `server: npm run test:free` | PASS | Disposable local replica of live Supabase schema; synthetic records only; 14 MVP + 20 security/concurrency/outbox groups, migrations/rollback, startup, restart, media persistence and sync recovery |
| Actual Web + Android API module integration | PASS | Same isolated Express/PostgreSQL; profile/service changes, private AI history/revisions and inbox read state shared; unrelated account excluded |
| `node client/tests/featureParity.cjs` | PASS | 11 React 18 component/state groups with mocked APIs; notification routing/failure, emergencies, worker settings, photos/reschedule conflicts, AI/account isolation, dual roles, admin notes/verification and upload preview lifetime |
| `node server/tests/androidVisualBaseline.js` | PASS | 15 screen/component JSX and StyleSheet ASTs unchanged; navigation/config/assets/dependencies byte-identical; six files changed only for internal refresh |
| Web `npm run build` | PASS | Existing Vite production build, no deployment |
| Android `npx expo export --platform android --output-dir dist-android` | PASS | Hermes export; not APK installation or physical-device test |
| Expo web export | PASS | Existing Android UI as Expo web build; separate React website remains primary website |
| `npx expo-doctor` | PASS | 21/21 checks |
| Client/server `npm run test:config` | PASS | API/socket/media URL and auth configuration; PostgreSQL session pooling/TLS guards |
| Static source checks / `git diff --check` | PASS | Parser/undeclared-reference check and normal repository whitespace check |
| Phone/screenshot/browser viewport verification | NOT RUN | No connected Android device/emulator. Earlier browser security review rejected opening localhost:8081; no bypass attempted |
| Hosted Render/Supabase media/FCM delivery | NOT RUN | External setup/approval pending; Supabase storage contract uses a mock in local tests |
| Live AI provider answer | NOT RUN this pass | History/privacy/revision checks passed; no claim that Gemini service availability/quota was verified |

One attempted `npm run test:config` in the mobile package failed because that package has no such script. The actual API module integration, native export and Expo doctor checks listed above were run instead. Running `git diff --check` with `core.autocrlf=false` incorrectly treated existing CRLF lines as whitespace; the ordinary repository-configured check is authoritative.

### Reproduce component checks

Application dependencies were not changed. Isolated React 18 test tools live outside the repository:

```powershell
npm install --prefix H:/apps/HelpEarly-test-tools --no-audit --no-fund react@18.3.1 react-test-renderer@18.3.1
# Or set HELP_EARLY_TEST_TOOLS to another private test-tools directory.
node client/tests/featureParity.cjs
node server/tests/androidVisualBaseline.js
```

### Remaining manual verification and deployment

1. Use one household and one worker on React web and a real Android phone against the same API. Compare every Android screen with the approved baseline screenshots; this pass verified source, not rendered pixels.
2. Book with a photo, reschedule, accept/start/complete, review; post photo job, propose/accept, exchange messages; check both devices update and retain records after logout/relogin/reconnect.
3. Create/cancel an emergency, then create/accept another; verify accepted booking on both sides. Open/read notifications and verify role/destination, then save admin complaint notes and confirm complainant response.
4. Save worker service/category/availability and household profile from alternating platforms. Ask the AI from each, check shared history; switch accounts and confirm no previous private records remain.
5. Follow FREE_STACK_STRATEGY.md for approved backups/migrations/RLS remediation, private Supabase bucket, Render Free and existing Vercel environment/deployment. Both clients must use the same configured HTTPS API. Existing live deployment/RLS blockers remain unresolved; no remote changes were authorized here.
6. Configure existing EAS project/FCM credentials and validate a native build on the phone. Expo Go supports the in-app inbox, not live remote Android push. Free-host sleep/background emergency delivery limitations remain explicit.

Native notification permissions and push setup remain platform-specific. Web receives the durable inbox and foreground/reconnect updates. Browser responsive CSS reuses flexible existing layouts, but actual viewport screenshots remain unverified. Previously documented dependency advisories remain a commercial-release gate; no dependency upgrades were made.
