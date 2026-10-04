# TV Store live catalog

## Product boundary

ZUI Store is a normal, rootless LG webOS Developer Mode application. The live-catalog staging identity is `com.zui.webos.store.staging`, version `0.2.0`, title `ZUI Store STAGING`. It browses normalized catalog and real device inventory information and stops at product inspection and update awareness. It has no install, update, uninstall, product launch, signing, Developer Mode extension, storage-clear, command, or production-override path.

## Data flow

```text
Product registry + release records + real `tv` inventory
                         |
                  CatalogService
                         |
        versioned public-safe TV projection
                         |
             GET /api/tv-store/v1/*
                         |
                  ZUI Store IPK
```

`CatalogService` and `UpdateEvaluationService` remain authoritative for App ID correlation, compatible stable/staging channels, semantic-version comparison, trust state, and update state. The TV client does not recompute those decisions.

The deterministic demo uses the same services to generate IPTV, Store, and YouTube production/staging projections. It covers installed, not installed, current, update available, no-compatible-release, signed, repository-pinned, production, and staging states without a TV, LAN, GitHub, or release mutation. LIVE never falls back to DEMO.

## TV-facing API v1

The API is separate from the privileged loopback Web Manager. It exposes only:

- `GET|HEAD /api/tv-store/v1/health`
- `GET|HEAD /api/tv-store/v1/catalog`
- `GET|HEAD /api/tv-store/v1/products/:logical-id`
- `OPTIONS` for those resources

All other methods return `405 READ_ONLY_API`. Query parameters are rejected. Product identifiers use a small logical-ID grammar and a 96-character ceiling. Responses are projected DTOs; they exclude filesystem/cache/private-key paths, commands, arbitrary URLs, approval digests, installer controls, private signing material, raw inventory, and stack traces.

DEMO API startup is loopback-only:

```powershell
pnpm tv-store:api:mock
```

LIVE startup is explicit:

```powershell
$env:ZUI_TV_STORE_API_HOST = '<PC LAN IPv4>'
$env:ZUI_TV_STORE_API_PORT = '4274'
$env:ZUI_TV_STORE_DEVICE_ALIAS = 'tv'
pnpm tv-store:api:live
```

The host must be one exact, assigned RFC1918 private IPv4 interface. An absent/unassigned/public host, `127.0.0.1`, `0.0.0.0`, `::`, hostname, or malformed address fails closed. No interface discovery result is selected automatically. The port defaults to `4274`, validates `1..65535`, and an occupied port fails instead of selecting another port. Web Manager remains private at `127.0.0.1:4273` and is not reused by the TV.

LIVE startup reads and validates repository registry/release records, verifies safe signed-cache evidence, and obtains current installed applications through `WebOSCliAdapter`. Cache verification and LG CLI inventory are deliberately serialized because LG Developer Mode can reset concurrent CLI sessions. Inventory has a five-minute in-memory freshness window, contains only actual device evidence, and is prewarmed before the service listens. This bounded window also lets the TV reconnect through Web Inspector without opening a competing CLI inventory session; the visible client still requests a refresh every 60 seconds. Startup fails with an actionable sanitized error if real inventory cannot be obtained.

## TV endpoint configuration

The TV IPK receives one build-time endpoint; no LAN address is committed to source:

```powershell
$env:ZUI_TV_STORE_API_HOST = '<same explicit PC LAN IPv4>'
$env:ZUI_TV_STORE_API_PORT = '4274'
pnpm tv-store:package:live
```

The build accepts only `http://<IPv4>:<port>` generated from these validated fields. The catalog cannot supply or redirect the client to another URL. DEMO packaging remains `pnpm tv-store:package`. A LIVE network failure, timeout, malformed response, non-LIVE response, or unavailable inventory displays the offline/Retry UI; it never substitutes demo data. Requests time out after six seconds. Initial load, explicit Retry, and return-to-visible after 60 seconds provide refresh without background polling.

The webOS packaged application runs from a `file://` origin, which browsers serialize as `Origin: null`. The API therefore permits exactly `Origin: null` and the read-only methods; it does not emit wildcard CORS. Requests without an Origin remain available for operator health checks. Any other Origin is rejected with `403`.

## Remote and focus model

`TvFocusProvider` owns one registry of focus targets with logical row/column positions. Arrow keys choose the nearest deterministic target, Enter activates the focused native button, and Escape/Backspace/webOS key code `461` invokes Back. Focus is always drawn with a thick cyan ring and does not depend on color alone. Opening detail records the source card; Back restores it. Home grids, header controls, detail action, and retry use the same primitives.

## UI behavior

- Cards are data-driven; no IPTV/YouTube-specific rendering branch exists.
- Detail shows App ID, installed/available version, channel, exact trust semantics, update state, and rootless compatibility.
- Friendly EN/TR labels cover every `UpdateStatus` and `CatalogTrustState`; exact trust enum remains visible as secondary detail.
- Staging identity is a persistent amber label and a separate App ID.
- DEMO shows `DEMO CATALOG`; LIVE removes it and shows a restrained `LIVE` indicator.
- Loading, offline, invalid-response, and retry surfaces do not display stacks or private details.
- React text rendering is used for catalog strings. Remote HTML/SVG and arbitrary icon URLs are not accepted; package assets are bundled locally.
- There is no telemetry, analytics, advertising, tracking, or third-party request.

## Build and packaging

```powershell
pnpm tv-store:dev
pnpm tv-store:package
pnpm tv-store:package:live
```

Vite emits an already-minified relative-path web bundle. `ares-package -n` avoids an incompatible second pass by the legacy CLI minifier. The packaging stage copies only the client bundle, `appinfo.json`, and local icons into `dist/webos`; server/API code is not shipped inside the TV IPK.

## Future installation boundary

The next milestone is the staging-only installation flow plus user approval UX. It must not be created by widening this read-only API. It requires a separate acceptance review for device targeting, approval UX, exact artifact trust, staging/production policy, and an explicit mutation endpoint boundary.
