# Approval-Gated Installer

The installer uses transactional orchestration, not an ACID transaction:

1. Create a canonical, expiring plan from a freshly inspected artifact and device inventory.
2. Bind approval to the plan's SHA-256 digest.
3. Reopen, rehash, and reparse the artifact immediately before execution.
4. Re-read target and protected-production installed state.
5. Perform one public `ares-install` mutation with `shell:false` and an argv array.
6. Re-read inventory and verify the expected staging version plus unchanged production applications.
7. Write an audit receipt outside Git.

Only known staging artifacts matching repository-pinned metadata can receive `ALLOW_WITH_APPROVAL`. A cache artifact whose current manifest/key revalidation passes is shown as `SIGNED`; unsigned pinned staging retains the previous `REPOSITORY_PINNED_HASH` behavior. Production, revoked/invalid signed cache state, metadata disagreement, unknown provenance/product, downgrade, unreachable device, invalid package, stale plan, altered artifact, or changed installed state are blocked without an override.

Signature trust and deployment policy are separate. Even a valid `SIGNED` artifact for `com.zui.player` or `youtube.leanback.v4` remains non-executable.

Plan approval is the exact uppercase SHA-256 digest of deterministic canonical JSON. Plans default to ten minutes and are bounded to 1–30 minutes. A receipt makes a used plan non-replayable.

LG's CLI does not guarantee atomic rollback. Automatic uninstall is forbidden. Rollback is reported as available only when a prior trusted artifact is known and resolvable; this milestone reports unavailable or not required.

Receipts are stored under `%USERPROFILE%\.zui-webos\receipts\` by default (or the absolute `ZUI_WEBOS_DATA_DIR` root) and contain no raw credentials.
