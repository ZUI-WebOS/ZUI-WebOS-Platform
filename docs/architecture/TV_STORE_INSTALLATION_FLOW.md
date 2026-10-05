# TV Store staging installation flow

## Boundary

The TV Store is an untrusted remote-first client. Its catalog API stays read-only on port `4274`; a separate, explicitly armed PC service exposes `/api/tv-store-install/v1` on port `4275`. Web Manager remains loopback-only on `4273`. Ports and assigned private IPv4 hosts are validated centrally; occupied ports fail rather than silently changing. The TV client receives validated endpoints at build time, not from catalog metadata.

This service supports signed staging INSTALL/UPDATE plans only. `com.zui.player`, `youtube.leanback.v4`, production releases, Store self-update, same-version reinstall, downgrade, and unknown-version plans are blocked. There is no uninstall, storage clear, DevMode extension, arbitrary path, command, URL, repository, or production override endpoint. Genuine staging UPDATE has not yet received hardware acceptance.

## Operator activation

Build first, then start the service only when an authorized staging operation is intended:

```powershell
pnpm build
$env:ZUI_TV_STORE_INSTALL_HOST = '<PC LAN IPv4>'
$env:ZUI_TV_STORE_INSTALL_PORT = '4275'
node apps/tv-store/dist/install-server.js --device tv
```

The target alias must be explicit. One assigned RFC1918 interface is required; no wildcard or automatically selected interface is accepted. Startup prints a short-lived pairing code locally. Do not publish that code or capture it in evidence. Pairing expires after three minutes, permits at most five failed attempts, and the arming window lasts ten minutes. Stop the process after the operation; expiry is not process shutdown. Restarting it requires a new operator decision, not an automatic retry.

## Approval and execution

1. The user selects a logical product/release/artifact in LIVE Store and pairs with the PC. The session token remains in client memory, not local storage.
2. The coordinator resolves registry metadata itself, verifies current signed cache evidence, obtains fresh device inventory, and invokes the shared installation planner. Only `SIGNED_TRUSTED` and an executable staging plan can produce an intent. The digest and artifact path stay backend-owned.
3. The TV shows product, App ID, installed/target version, target alias, staging channel and trust. **Cancel has initial focus**. A deliberate selection of Install now/Update now is required; opening the view, pairing, or refreshing never executes a plan.
4. Approval atomically consumes the intent before starting the existing `InstallerService`. Client approval accepts an empty object, not a replacement plan/path/digest. Duplicate/replayed approval cannot start another execution.
5. `InstallerService` rechecks artifact bytes/signature and fresh target/protected inventory immediately before mutation. It runs the LG CLI through an executable plus argv, never a shell command string. The install command is invoked once, without an automatic install retry.
6. Progress reports actual phases: `VERIFYING_PACKAGE`, `CHECKING_TV`, `INSTALLING`, `VERIFYING_INSTALLATION`, `COMPLETE`. There is no estimated percentage. Success requires command exit zero **and** matching post-install App ID/version.
7. The existing receipt store writes a sanitized receipt with `origin: TV_STORE`. A local invalidation signal makes the separate LIVE display service refresh inventory; the UI then renders current installed/update state. Session mutation authority is consumed before the one attempted execution; verified success also explicitly disarms the coordinator. Failure cannot authorize another attempt through that session.

## Inventory reliability

`ResilientDeviceInventory` wraps the real adapter and is shared by the coordinator and its InstallerService. It coalesces in-flight reads by device within that instance, but retains no completed inventory cache. Each later safety gate therefore reads current inventory again.

Only `COMMAND_TIMEOUT`, `DEVICE_UNREACHABLE`, and `DEVICE_INVENTORY_FAILED` receive bounded read retries: at most three total attempts, with 500 ms and 1,000 ms backoff. Malformed responses, policy/trust/integrity errors and installs are not retried. Logs contain request ID, alias, attempt, sanitized error code, duration and available process exit code, not raw credential-bearing stderr.

LIVE catalog has a separate five-minute display cache. That cache is never a mutation preflight input. Coalescing does not cross process boundaries and does not guarantee a global LG CLI lock. Concurrent transport sessions remain a limitation; their involvement in the original failure was not proven.

The previous blocked attempt bypassed LIVE's resilient inventory path during mutation preflight. The fix puts the bounded fresh-read wrapper on that path. Original transport exit/stderr evidence was unavailable, so the precise underlying LG session failure is not retrospectively established. Fresh acceptance succeeded on first inventory attempts; retry behavior is proven by regression tests, not by intentionally disrupting the TV.

## Security and failure semantics

Requests use logical IDs, strict JSON shapes, bounded bodies, bearer sessions, expiry, single-use intents and exact `Origin: null` handling for the webOS `file://` client. These controls are not TLS or strong LAN authentication: the current staging service assumes a trusted private LAN and trusted PC/TV. Do not expose it to the Internet or an untrusted/shared network. No-Origin operator requests exist; CORS is not an authentication boundary.

Failure stops the flow and requires a new review/operator decision. No silent alternate device, unsigned fallback, LIVE-to-DEMO fallback, automatic rollback or automatic second install is offered. An expected replay/policy HTTP error is not a fatal application runtime error. Receipts contain safe identity/hash/result evidence; tokens, pairing codes, private keys, passphrases and artifact paths do not belong in reports.

See [hardware acceptance](../development/TV_STORE_STAGING_INSTALL_REPORT_2026-10-05.md), [approval-gated installer](APPROVAL_GATED_INSTALLER.md), and [threat model](../security/THREAT_MODEL.md).
