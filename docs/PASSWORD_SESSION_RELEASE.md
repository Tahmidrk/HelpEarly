# Password-session security fix — October 11, 2026

**Local implementation/tests: PASS. Production deployment: BLOCKED pending separate approval.**

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

**NOT RUN:** production revocation and phone behavior using this patch. The first administration deployment remains live and its independent workflow tests passed; this new security change is local until approved.

## Proposed deployment / impact

After explicit approval, deploy only this tested backend change to existing Render `helpearly-api`, preserving all environment settings and database/media records. All JWTs from the earlier implementation lack the version and will be rejected, so existing Android/Web users must sign in again. This intentional one-time session invalidation also removes previously issued administrative access. The admin-free APK already being built remains compatible; no additional EAS build is necessary.

Verify `/api/ready`, old-token denial, a fresh authenticated login and WSS connection, and the existing admin dashboard after rollout. The owner must use a strong private admin password and complete credential entry themselves. Never put that password in Git, logs or chat.

Rollback retains current code commit `7f485b78b9f01a91eb0eee42d45feda228614989` and its Render deployment, but restores the old revocation weakness. Prefer a forward correction. No SQL rollback or data restore is needed for this patch. Do not weaken authentication merely to avoid relogin.
