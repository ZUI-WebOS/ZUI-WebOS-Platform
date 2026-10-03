# Technical Debt Registry

## External products — record only

### ZUI YouTube for webOS

- six open Dependabot PRs at migration close;
- dependency advisories, including critical findings recorded in the migration report;
- repository-wide lint and Prettier debt;
- retained `LEGACY_RECOVERY_SOURCE` cleanup decision.

The platform milestone does not change the YouTube repository or merge its PRs.

### ZUI IPTV Player

- review existing untracked release/security documentation;
- future product cleanup and release normalization.

The platform milestone does not change the IPTV repository.

## Platform

- Web Manager upload-retention policy and user-controlled cleanup for opaque local inspection copies;
- persistent read-only plan history (the MVP latest-plan view is process-memory only);
- Turkish `README_TR.md` after a translation-quality and synchronization workflow is defined (`README.md` remains canonical);
- opt-in Windows Task Scheduler/service wrapper for Keeper;
- supported official expiry/status provider if LG exposes one;
- cloud catalog and release registry;
- local verified TV App Installer;
- Web Manager mutation milestone with a new threat review and explicit approval UX; install execution and Developer Mode extension remain deliberately absent;
- TV Store / launcher;
- artifact signing, SBOM, revocation, and rollback automation.
