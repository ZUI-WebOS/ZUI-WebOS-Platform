# TV Store MVP Report — 2026-10-04

## Status

`DONE_WITH_CONCERNS`

The user-facing TV Store MVP is implemented, packaged, and locally accepted. Real-TV installation and hardware acceptance remain open because both registered physical-TV aliases were unreachable on 2026-10-04. No TV mutation was attempted.

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

- Verified source commit: `6ad880ce53fb82acb1f9215a2a8da72e623f37b9`
- CI: PASS — run `37201707770`
- CodeQL: PASS — run `37201707771`
- CI also passed the public staging release-operations verification step.

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

Screenshots are 1920×1080 local/mock captures and contain no IP address, token, private path, or key material.

## Real-TV acceptance

Registered aliases `tv` and `lgtv` both returned `DEVICE_UNREACHABLE` during read-only preflight; a final retry after GitHub verification produced the same result. Therefore:

- Store staging install/update: NOT ATTEMPTED
- Application launch: NOT TESTED ON HARDWARE
- Physical remote navigation/Back: NOT TESTED ON HARDWARE
- TV runtime console: NOT INSPECTED
- Existing IPTV/YouTube products changed: NO
- TV mutation count: `0`

When the TV is online, the only permitted continuation is install/update and inspect `com.zui.webos.store.staging`; catalog product installation remains forbidden.

## Remaining concerns

1. Hardware acceptance is still required before declaring `TV_STORE_MVP_COMPLETE`.
2. The distributable intentionally uses deterministic normalized mock data. The documented live LAN provider remains a future integration after its inventory source and user-controlled LAN startup are accepted.
3. Developer Mode expiry may later remove the Store like any Developer Mode application; this MVP does not extend Developer Mode.

## Recommended next milestone

After hardware acceptance, proceed to **TV Store installation-flow design and staging-only user approval UX**. Keep catalog product installation disabled until that product milestone is separately reviewed and accepted.
