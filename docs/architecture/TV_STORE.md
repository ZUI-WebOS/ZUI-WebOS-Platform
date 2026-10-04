# TV Store MVP

## Product boundary

ZUI Store is a normal, rootless LG webOS Developer Mode application. The accepted staging identity is `com.zui.webos.store.staging`, version `0.1.0`, title `ZUI Store STAGING`. It browses normalized catalog information and stops at product inspection and update awareness. It has no install, update, uninstall, launch, signing, Developer Mode extension, storage-clear, command, or production-override path.

## Data flow

```text
Product registry + release records + optional TV inventory
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

The deterministic mock uses the same services to generate IPTV, Store, and YouTube production/staging projections. It covers installed, not installed, current, update available, no-compatible-release, signed, repository-pinned, production, and staging states without a TV, LAN, GitHub, or release mutation.

## TV-facing API v1

The API is separate from the privileged loopback Web Manager. It exposes only:

- `GET|HEAD /api/tv-store/v1/health`
- `GET|HEAD /api/tv-store/v1/catalog`
- `GET|HEAD /api/tv-store/v1/products/:logical-id`
- `OPTIONS` for those resources

All other methods return `405 READ_ONLY_API`. Query parameters are rejected. Product identifiers use a small logical-ID grammar and a 96-character ceiling. Responses are projected DTOs; they exclude filesystem/cache/private-key paths, commands, arbitrary URLs, approval digests, installer controls, private signing material, raw inventory, and stack traces.

Mock startup is loopback-only:

```powershell
pnpm tv-store:api:mock
```

Future live LAN startup must set `ZUI_TV_STORE_API_HOST` to one explicit IPv4 interface. An absent host or `0.0.0.0`/`::` fails closed. `ZUI_TV_STORE_API_PORT` defaults to `4274`, validates `1..65535`, and an occupied port fails with an actionable error. The live provider is deliberately not enabled in this MVP, so the current distributable uses the deterministic normalized catalog. Web Manager remains unchanged at `127.0.0.1:4273`.

## Remote and focus model

`TvFocusProvider` owns one registry of focus targets with logical row/column positions. Arrow keys choose the nearest deterministic target, Enter activates the focused native button, and Escape/Backspace/webOS key code `461` invokes Back. Focus is always drawn with a thick cyan ring and does not depend on color alone. Opening detail records the source card; Back restores it. Home grids, header controls, detail action, and retry use the same primitives.

## UI behavior

- Cards are data-driven; no IPTV/YouTube-specific rendering branch exists.
- Detail shows App ID, installed/available version, channel, exact trust semantics, update state, and rootless compatibility.
- Friendly EN/TR labels cover every `UpdateStatus` and `CatalogTrustState`; exact trust enum remains visible as secondary detail.
- Staging identity is a persistent amber label and a separate App ID.
- Loading, offline, invalid-response, and retry surfaces do not display stacks or private details.
- React text rendering is used for catalog strings. Remote HTML/SVG and arbitrary icon URLs are not accepted; package assets are bundled locally.
- There is no telemetry, analytics, advertising, tracking, or third-party request.

## Build and packaging

```powershell
pnpm tv-store:dev
pnpm tv-store:package
```

Vite emits an already-minified relative-path web bundle. `ares-package -n` avoids an incompatible second pass by the legacy CLI minifier. The packaging stage copies only the client bundle, `appinfo.json`, and local icons into `dist/webos`; server/API code is not shipped inside the TV IPK.

## Future installation boundary

A later milestone may design a user-approved installation flow. It must not be created by widening this API. It requires a new acceptance review for device targeting, approval UX, exact artifact trust, staging/production policy, and an explicit mutation endpoint boundary.
