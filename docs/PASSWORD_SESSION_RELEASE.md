# Password-session security fix — October 11, 2026

**Local implementation/tests: PASS. Production deployment and live revocation checks: PASS after separate approval. Physical Android: NOT RUN.**

Live verification found that a password change did not invalidate previously issued JWTs. The existing admin password had also been publicly documented. Changing that password alone therefore did not remove existing session access. One unexplained account deactivation was found in the durable audit; the owner denied making it and approved restoration. Its exact origin is not established. Do not claim it was an attack or a confirmed application defect.

## Exact change

- `server/utils/passwordSession.js`: Node's built-in HMAC derives an opaque credential version. JWTs contain this version, never a password hash. Comparisons require valid hex and use constant-time comparison.
- `server/controllers/authController.js`: registration/login issue versioned JWTs; password changes use a conditional SQL update, reject concurrent credential changes, disconnect current personal sockets, and require 12+ characters for a new administrator password. Ordinary user UI and its existing minimum are preserved.
- `server/middleware/auth.js`: authenticated and optional-auth routes compare the current database password version. Legacy/revoked tokens return 401. Password hashes are excluded from request user data.
- `server/socket/chat.js`: handshake and packet authentication reject legacy/revoked tokens. Password changes disconnect active sessions on the existing single instance.
- `server/tests/passwordSessions.js`, `server/tests/adminFlows.js`, `server/tests/freeStack.js`: real isolated PostgreSQL/Express/Socket.IO coverage, including forged role claims with a valid session version.

No schema migration, dependency update, JWT signing-key rotation, Android code/UI change, Firebase/Gemini setting change, or new hosting project is required.

## Executed evidence

**PASS:** `npm run test:free` after the change: 14 MVP, 20 security/concurrency/outbox, 10 admin, 9 cross-platform protocol groups, plus actual credential-rotation checks. Old REST/optional-auth/admin access and WSS reconnect were denied; active socket disconnected; new login restored access. Profile edits preserved valid sessions. Legacy and malformed credential versions were rejected. An administrator's short replacement password was rejected without changing the account. See [password sessions](test-results/password-sessions.json) and [full stack](test-results/free-stack.json).

**PASS — Production:** owner separately approved commit `2b7bd6aa2e14644aa55bf62a6008492bcceaadcf`. Existing Render deployment `dep-db5nqrid0e5s7383qsv0` succeeded at 12:14 UTC without environment/schema changes. Old administrator JWTs return 401 on authenticated/admin/optional-auth routes; their WSS handshake is denied. Owner signed in again and the real dashboard loaded. Labeled household/worker fresh login and WSS passed. A real fixture password change disconnected its socket, denied old REST/reconnect, and fresh login preserved bookings/media/history. Real Gemini generation/history/isolation passed after this deployment. See [legacy revocation](test-results/password-sessions-live.json) and [live fixture regression](test-results/password-sessions-live-fixtures.json).

**IMPLEMENTED/UNVERIFIED — Physical phone:** no OS/session/push result is claimed. The owner confirmed private admin reconnection after being asked to choose a strong password; the agent did not enter or save that replacement.

## Proposed deployment / impact

The approved deployment changed only the existing Render backend code. All JWTs from the earlier implementation lack the version and are rejected, so existing Android/Web users must sign in again. This intentional one-time invalidation removes previously issued administrative access. The signed admin-free APK remains compatible; no additional EAS build is necessary.

Verify `/api/ready`, old-token denial, a fresh authenticated login and WSS connection, and the existing admin dashboard after rollout. The owner must use a strong private admin password and complete credential entry themselves. Never put that password in Git, logs or chat.

Rollback retains current code commit `7f485b78b9f01a91eb0eee42d45feda228614989` and its Render deployment, but restores the old revocation weakness. Prefer a forward correction. No SQL rollback or data restore is needed for this patch. Do not weaken authentication merely to avoid relogin.
