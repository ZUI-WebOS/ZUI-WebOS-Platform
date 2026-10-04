# TV Store Live Catalog Report — 2026-10-04

## Status

`TV_STORE_LIVE_CATALOG_COMPLETE`

The read-only LIVE catalog and real device-state milestone is implemented, packaged, and accepted on the physical `tv` target. Live home, exact installed-state correlation, product detail, focus restoration, English/Turkish UI, fail-closed offline behavior, and service-restart → focused Retry → LIVE recovery passed. No mock fallback or product mutation occurred.

## Delivered architecture

- `/api/tv-store/v1` remains the only TV catalog API.
- `GET|HEAD /health`, `GET|HEAD /catalog`, `GET|HEAD /products/:logical-id`, and `OPTIONS` are the only accepted methods/resources.
- `CatalogService` and `UpdateEvaluationService` remain authoritative for identity correlation, version compatibility, trust, and update state.
- LIVE reads the canonical registry and release records, verifies safe signed-cache evidence, then reads actual installed applications through `WebOSCliAdapter`.
- LIVE startup prewarms real inventory and fails closed if the device cannot be read. Inventory/cache reads are serialized because concurrent LG CLI sessions can reset Developer Mode connections.
- A bounded five-minute real-data cache starts when collection completes. It permits a TV/Inspector reconnection without opening a competing inventory session; it never contains or substitutes demo data. The visible client still requests data after 60 seconds, while the service refreshes actual inventory no later than the cache boundary.
- DEMO remains deterministic for CI/offline development. LIVE never falls back to DEMO.

## Binding and endpoint configuration

Web Manager remains loopback-only at `127.0.0.1:4273`.

The TV API requires one explicit, locally assigned RFC1918 private IPv4 address in `ZUI_TV_STORE_API_HOST`; it rejects absent, public, unassigned, loopback, wildcard, hostname, malformed, and IPv6 hosts. `ZUI_TV_STORE_API_PORT` defaults to `4274`, validates `1..65535`, and uses strict port behavior. `ZUI_TV_STORE_DEVICE_ALIAS` selects the inventory target and defaulted to `tv` for acceptance.

The LIVE IPK receives the exact `http://<private-ipv4>:<port>` endpoint at build time. No LAN address, credential, discovery mechanism, or arbitrary catalog URL is committed or accepted. The client validates the embedded numeric private endpoint again at runtime.

The webOS `file://` renderer sends `Origin: null`; CORS therefore permits only exact `null`. Foreign origins receive `403`, wildcard CORS is absent, and all mutation methods receive `405`.

## Package and authorized TV mutation

- App ID: `com.zui.webos.store.staging`
- Version: `0.2.0`
- Title: `ZUI Store STAGING`
- File: `com.zui.webos.store.staging_0.2.0_all.ipk`
- Size: `1,529,470` bytes
- SHA-256: `66611CF1A8C44151A543486D11C8C3324B6FBF05CDBFB64EA08CE98A2437AA67`
- Package identity/metadata inspection: PASS
- Local package record: `repository/releases/zui-store/0.2.0-staging.json`
- Authorized Store install/update count: `1`
- Catalog product install/update count: `0`
- Developer Mode extend count: `0`

The exact package above was installed once and was the package used for hardware evidence. Subsequent source verification builds did not repackage or reinstall the TV application.

## Actual device inventory and LIVE projection

The real device inventory produced these distinct identities:

| App ID                          | Actual installed | Installed | Available | Update state            | Trust state              |
| ------------------------------- | ---------------- | --------- | --------- | ----------------------- | ------------------------ |
| `com.zui.player`                | yes              | `1.0.1`   | —         | `NO_COMPATIBLE_RELEASE` | `UNVERIFIED`             |
| `com.zui.webos.store.staging`   | yes              | `0.2.0`   | `0.2.0`   | `UP_TO_DATE`            | `REPOSITORY_PINNED_HASH` |
| `youtube.leanback.v4`           | yes              | `0.8.3`   | `0.8.4`   | `UPDATE_AVAILABLE`      | `REPOSITORY_PINNED_HASH` |
| `com.zui.webos.youtube.staging` | no               | —         | `0.8.4`   | `NOT_INSTALLED`         | `SIGNED`                 |

Store self-state came from generic exact App ID correlation; it was not hard-coded. Production and staging YouTube identities remained separate. Friendly labels do not collapse `REPOSITORY_PINNED_HASH` into `SIGNED`.

## Real-TV acceptance

- LIVE home rendered four actual catalog cards: PASS
- `DEMO CATALOG` absent and subtle `LIVE` indicator present: PASS
- Store self-state installed `0.2.0` and up to date: PASS
- IPTV/YouTube production/YouTube staging actual states: PASS
- Visible focus and Arrow navigation: PASS
- Enter opened Store detail: PASS
- Detail showed exact installed/available/trust/staging values: PASS
- Back restored Store-card focus: PASS
- EN/TR switch: PASS
- PC service stopped → offline/error screen with focused Retry and no mock data: PASS
- Fatal runtime exceptions: `0`
- Error-level application console/log entries: `0`
- Service restart → focused Retry → four-card LIVE recovery: PASS
- Recovery snapshot fatal runtime exceptions and error-level application logs: `0`

The first recovery observation was interrupted by an Inspector `ECONNRESET`. After applying the bounded five-minute cache and completion-based expiry, a fresh hardware run dispatched focused Retry and a separate Inspector observation confirmed the real four-card LIVE screen. The transient tunnel failure was not counted as application success and did not require another install.

## Protected application result

No protected package mutation was performed. Post-update inventory retained:

- `com.zui.player` at `1.0.1`
- `youtube.leanback.v4` at `0.8.3`
- `com.zui.webos.youtube.staging` not installed

Only `com.zui.webos.store.staging` changed, from `0.1.0` to the authorized LIVE `0.2.0` staging package.

## Screenshot evidence

| Evidence                    | File                                                 | SHA-256                                                            |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Real-TV LIVE home           | `evidence/tv-store/12-real-tv-live-home.png`         | `F9B55FF9C22AC203B42859EB71CE697DA8B6348841B69E56837635069BD4979A` |
| Installed Store detail      | `evidence/tv-store/13-real-tv-live-store-detail.png` | `697CF88D93162A4EE53316B859EBE583632FA11EC5B20EFDB74AB41C8FFA1B69` |
| Real-TV Turkish LIVE UI     | `evidence/tv-store/14-real-tv-live-turkish.png`      | `BB10D585433EC355657701AD8A99BF1FBA6AE249A7958C320672080163E6E1A0` |
| Real-TV fail-closed offline | `evidence/tv-store/15-real-tv-live-offline.png`      | `42AD24FE56A3ADEF77297A15AE189AA6BE748CBF452B9AD24B2B5EEF722EF3F0` |
| Real-TV Retry recovery      | `evidence/tv-store/16-real-tv-live-recovered.png`    | `6CC2FF7D1992EE0DE09D1118B699979D7D146C4D7FDC161A0FE40A419FF44C95` |

The 1920×1080 captures came from the authorized Store application Inspector and expose no LAN IP, credential, token, key, or private path.

## Test and security result

- Frozen install: PASS
- Focused LIVE/API/UI tests: PASS
- Full repository tests: `126/126 PASS`
- Format: PASS after formatting the lockfile
- Lint: PASS
- Type-check: PASS
- Build: PASS
- Read-only method, query, path, URL, command, URI-bound, and private-data tests: PASS
- Explicit private IPv4/assigned-interface/wildcard/public-host/strict-port tests: PASS
- Malformed, timeout, non-LIVE, no-fallback, Retry, EN/TR, focus, self-correlation, and production/staging separation tests: PASS

The API exposes no filesystem/cache/private-key path, private key, passphrase, arbitrary URL, shell/installer command, approval digest, mutation token, raw inventory, or stack trace.

## Remaining risk

LG Developer Mode intermittently accepted TCP/9922 while resetting or timing out CLI/Inspector sessions. The LIVE service therefore serializes cache verification and inventory, prewarms before listening, deduplicates concurrent refreshes, retries bounded transient inventory failures, and keeps the last real result for at most five minutes. This does not fall back to DEMO and does not conceal startup failure; a process with no real prewarm evidence still fails closed.

## Next milestone

Proceed directly to **TV STORE STAGING-ONLY INSTALLATION FLOW + USER APPROVAL UX**. Installation remains absent and disabled in this milestone.
