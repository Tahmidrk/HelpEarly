# Source and recovery checkpoint

Local checkpoint date: 10 October 2026. No commits pushed; history was not rewritten.

- API/MVP/database/security/notification tests: `35417d3`.
- Web/mobile workflow and native push integration: `9ddbb87`.
- Deployment, documentation, backup/admin tools and final whitespace cleanup: the commit containing this document. Resolve it with `git log -1 --format=%H -- docs/RELEASE_CHECKPOINT.md`.

These commits include the pre-existing uncommitted MVP application work, preserved alongside this production-readiness pass. Unrelated legacy debug/cleanup scripts and mobile CLAUDE instructions remain outside these commits, untouched. Do not run old cleanup scripts against live data.

Private local backup locations:

- Original source tree: `H:\apps\HelpEarly-backups\source-tree-before-production-20261010-180705.zip`.
- Final DB/media pair, restoration tested: `H:\apps\HelpEarly-backups\helpearly-2026-10-10T16-25-34-935Z`.
- Reviewed Git history: `H:\apps\HelpEarly-backups\helpearly-release-20261010.bundle` (created and verified after the final commit).
- Final working source tree, including preserved untracked source: `H:\apps\HelpEarly-backups\source-tree-final-20261010.zip` (created after the final commit; excludes dependencies, outputs, secrets, uploads and Git internals).

Do not publish DB/media backups. Protect and back up actual environment files and signing keys separately. They are intentionally absent from source archives and commits. Keep an encrypted offsite copy; local disk alone does not protect against hardware failure.

To recover reviewed source into a separate folder, use `git clone H:\apps\HelpEarly-backups\helpearly-release-20261010.bundle HelpEarly-recovery`. Install dependencies with `npm ci` in server, client and mobile; restore private environment values; then follow `docs/DEPLOYMENT.md` for database/media restoration. Never restore an old dump over new user activity without a reviewed recovery decision.

For exact test scope, outstanding advisories, EAS/FCM setup and real-device gates, use `docs/COMPLETION_REPORT.md`, `docs/DEPLOYMENT.md` and `docs/ANDROID_CHECKLIST.md`.
