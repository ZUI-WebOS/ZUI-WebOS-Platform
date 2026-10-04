# TV Store MVP Report — 2026-10-04

## Status

`TV_STORE_MVP_COMPLETE`

The user-facing TV Store MVP is implemented, packaged, locally accepted, and accepted on the real `tv` hardware target. Only the authorized Store staging package was installed; no IPTV or YouTube package was changed, no catalog product operation was started, and Developer Mode was not extended.

## Delivered product

- Rootless standard webOS application: `com.zui.webos.store.staging`
- Version: `0.1.0`
- Display title: `ZUI Store STAGING`
- 10-foot dark interface with large text, generous spacing, persistent staging identity, and non-color-only status labels
- Generic catalog cards and product details for normalized IPTV, Store, and YouTube identities
- Production/staging, installed/not-installed, current/update/no-compatible-release, and signed/repository-pinned/unverified examples
- English and Turkish navigation, status, trust, product description, error, and detail text
- Local-only assets; no remote HTML/SVG/media, telemetry, analytics, ads, or tracking
- No install, update, uninstall, launch, signing, command, Developer Mode, cache, or storage mutation control

## Architecture and API

The mock catalog is generated through the existing `CatalogService` and `UpdateEvaluationService`; the TV client does not recreate version, compatibility, trust, or update logic. A separate v1 TV projection contract prevents coupling to Web Manager DTOs.

Read-only API surface:

- `GET|HEAD /api/tv-store/v1/health`
- `GET|HEAD /api/tv-store/v1/catalog`
- `GET|HEAD /api/tv-store/v1/products/:logical-id`
- `OPTIONS`

Every mutation method returns `405`. Queries, paths, URLs, commands, oversized/malformed logical IDs, and private operational data are rejected or absent. Web Manager remains `127.0.0.1:4273`. TV API mock defaults to `127.0.0.1:4274`; a future live provider requires one explicit LAN IPv4 and refuses wildcard binding. Live LAN data was intentionally not enabled in this read-only MVP.

## Remote navigation and focus

One reusable focus registry covers header controls, grid cards, detail Back, and retry. Arrow navigation is row/column deterministic; Enter activates; Escape, Backspace, and webOS key code `461` go Back. The originating product card is restored after detail.

Browser acceptance confirmed:

- initial focus is visible;
- Right moved IPTV → Store;
- Enter opened Store detail;
- Back restored focus to Store;
- EN → TR switched with remote-focusable control;
- no console warning/error was observed.

Real-TV acceptance confirmed the same interaction contract on the physical TV's webOS renderer. Inspector-dispatched native key events covered all four Arrow keys, Enter, and Escape/Back; detail → Back restored the originating IPTV card focus.

## Update and trust behavior

All canonical `UpdateStatus` values have friendly EN/TR labels. All `CatalogTrustState` values have friendly labels without collapsing exact semantics. Detail retains the raw trust enum, for example `Repository verified · REPOSITORY_PINNED_HASH` and `Verified · SIGNED`. Staging is always labelled and uses separate App IDs.

## Tests and local acceptance

- Focused TV Store tests: `10/10 PASS`
- Full repository tests: `121/121 PASS`
- Frozen install: PASS
- Format: PASS
- Lint: PASS
- Type-check: PASS
- Build: PASS
- webOS package metadata inspection: PASS
- Read-only API methods/schema/private-data tests: PASS
- invalid path/URL/command/oversized-ID tests: PASS
- UI catalog/detail/update/trust/staging/EN-TR/focus/Back/offline/XSS tests: PASS

## GitHub verification

- Pre-hardware acceptance source commit: `483e0249c7698839b1c5c46049b8340a3bc6b5fb`
- CI: PASS — run `37201903228`
- CodeQL: PASS — run `37201903196`
- CI also passed the public staging release-operations verification step.
- The final hardware evidence commit and its workflow results are reported in the acceptance handoff, avoiding a self-referential commit hash in this file.

## Package

- File: `com.zui.webos.store.staging_0.1.0_all.ipk`
- SHA-256: `0533158F909607ABDA143A1C8DC8635B3DEDEC1E0778DAEADA60DD2573A76845`
- Package ID/version/title verified with `ares-package -I`
- Package contains the client bundle and bundled assets, not the API/server source

The application icon was generated with the built-in image generator and stored at `apps/tv-store/public/assets/store-mark.png`; 80 px and 130 px package icons are deterministic local derivatives. Prompt: “Create a polished square application icon for ZUI Store, a rootless LG webOS TV app store. Dark midnight-navy rounded-square tile, centered abstract luminous Z-shaped ribbon made from cyan and aqua light, subtle depth and restrained glow, premium modern TV interface aesthetic, crisp geometry, high contrast, no words, no letters other than the abstract Z form, no LG logo, no third-party trademarks, no app-store bag metaphor, no watermark, safe margins for 80x80 and 130x130 downscaling.”

## Screenshot evidence

| Evidence                | File                                        |
| ----------------------- | ------------------------------------------- |
| Home                    | `evidence/tv-store/01-home.png`             |
| Visible focused card    | `evidence/tv-store/02-focused-card.png`     |
| Product detail          | `evidence/tv-store/03-product-detail.png`   |
| Update available        | `evidence/tv-store/04-update-available.png` |
| Staging product         | `evidence/tv-store/05-staging-product.png`  |
| Turkish UI              | `evidence/tv-store/06-turkish-ui.png`       |
| Offline/error and retry | `evidence/tv-store/07-offline-error.png`    |
| Real-TV home            | `evidence/tv-store/08-real-tv-home.png`      |
| Real-TV product detail  | `evidence/tv-store/09-real-tv-detail.png`    |
| Real-TV Turkish UI      | `evidence/tv-store/10-real-tv-turkish.png`   |
| Real-TV offline/retry   | `evidence/tv-store/11-real-tv-offline.png`   |

Screenshots `01`–`07` are 1920×1080 local/mock captures. Screenshots `08`–`11` were captured from the real TV renderer through its authorized application Inspector. They contain no IP address, token, private path, or key material.

## Real-TV acceptance

Read-only preflight confirmed that alias `tv` was reachable. The exact authorized package was then installed and launched:

- File: `apps/tv-store/dist/ipk/com.zui.webos.store.staging_0.1.0_all.ipk`
- SHA-256: `0533158F909607ABDA143A1C8DC8635B3DEDEC1E0778DAEADA60DD2573A76845`
- Installed App ID: `com.zui.webos.store.staging`
- Installed version: `0.1.0`
- Installed title: `ZUI Store STAGING`
- Installed vendor: `ZUI-WebOS`
- Launch: PASS
- Home render and four product cards: PASS
- Visible initial focus: PASS
- Arrow Right/Down/Left/Up: PASS on the real TV renderer
- OK/Enter opens detail: PASS
- Back returns home: PASS
- Detail → Back focus restore: PASS
- EN → TR switch: PASS
- Update, trust, production, and staging labels/details: PASS
- Offline view and focused retry action: PASS; retry was activated while the deterministic offline evidence state remained active
- Fatal runtime exceptions, console errors, and error-level log entries: `0`

Post-acceptance inventory confirmed protected identities were unchanged from preflight:

- `com.zui.player`: still installed, version `1.0.1`
- `youtube.leanback.v4`: still installed, version `0.8.3`
- `com.zui.webos.youtube.staging`: still not installed

Authorized Store package install/update count: `1`. Catalog product install/update count: `0`. Developer Mode extend count: `0`. No other TV package mutation was performed. Launch and Inspector activity were limited to `com.zui.webos.store.staging`.

The platform registry currently classifies the Store identity as `UNKNOWN_PRODUCT` because the Store has not yet been added to the canonical product registry. This does not alter the directly verified installed App ID, title, version, vendor, or package hash, and it did not permit or trigger any catalog product action.

## Remaining concerns

1. The distributable intentionally uses deterministic normalized mock data. The documented live LAN provider remains a future integration after its inventory source and user-controlled LAN startup are accepted.
2. The Store identity is not yet present in the platform product registry, so generic inspection reports `UNKNOWN_PRODUCT` even though installed package metadata is exact.
3. Developer Mode expiry may later remove the Store like any Developer Mode application; this MVP did not extend Developer Mode.

## Recommended next milestone

After hardware acceptance, proceed to **TV Store installation-flow design and staging-only user approval UX**. Keep catalog product installation disabled until that product milestone is separately reviewed and accepted.
