# ZUI webOS Platform

ZUI webOS Platform is a rootless management layer and developer-tooling monorepo for ZUI applications on LG webOS TVs. It uses LG Developer Mode and the public webOS CLI; it does not root televisions, patch firmware, modify protected system files, or install privileged daemons.

> This community project is not affiliated with or endorsed by LG Electronics or YouTube.

## Current scope

Production-quality local modules now include **ZUI DevMode Keeper**, the read-only **Device Manager Core**, the **Verified Package Inspector**, the approval-gated installer service, signed artifact distribution, normalized catalog/update intelligence, and the local **ZUI Web Manager**. The Web Manager can inspect, download and verify trusted catalog artifacts, and generate read-only plans, but intentionally cannot execute an installation or extend Developer Mode.

The platform is also the management layer for future device, catalog, installer, release-registry, web-manager, and TV-store components. Product source remains in independent repositories:

| Product               | Application ID                  | Repository                                                                    |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| ZUI IPTV Player       | `com.zui.player`                | [ZUI-WebOS/ZUI-IPTV-Player](https://github.com/ZUI-WebOS/ZUI-IPTV-Player)     |
| ZUI YouTube for webOS | `youtube.leanback.v4`           | [ZUI-WebOS/ZUI-YouTube-WebOS](https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS) |
| ZUI YouTube staging   | `com.zui.webos.youtube.staging` | same external product repository                                              |

No product source is copied into this monorepo.

## Architecture

```text
ZUI webOS Platform
|-- Devices and shared webOS tooling
|-- DevMode Keeper
|-- Catalog and release registry
|-- Installer / local Manager
|-- Web management portal
|-- TV Store / launcher
`-- External product repositories
    |-- ZUI IPTV Player
    `-- ZUI YouTube for webOS
```

The device control plane stays local. Cloud-facing services may publish signed metadata and artifacts later, but they do not receive TV private keys or obtain a hidden command path into the local network.

## Requirements

- Windows 10/11 development host
- Node.js 22 or newer
- pnpm 11.5.0 (declared by the repository)
- LG webOS CLI with a device registered through `ares-setup-device`
- LG Developer Mode on the target TV

Do not place passwords, tokens, private keys, or device connection details in this repository. DevMode Keeper reuses the webOS CLI device registry and accepts a device alias such as `tv`; IP addresses are never hard-coded.

## Development

```powershell
pnpm install --frozen-lockfile
pnpm verify
```

Individual gates are available as `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`, and `pnpm format:check`.

Start the real local Web Manager or its deterministic no-TV fixture mode:

```powershell
pnpm web
pnpm web:mock
```

Both commands bind only to `http://127.0.0.1:4273` by default. Set `ZUI_WEB_MANAGER_PORT` to a whole number from `1` through `65535` to use another local port; the host remains fixed to `127.0.0.1`. If the requested port is occupied, startup stops with an actionable error instead of selecting another port. The browser talks to a narrow local API that reuses the platform services; it has no generic command or filesystem endpoint. Uploaded IPKs are inspected but never executed from the UI.

The catalog correlates current installed inventory with exact registered App IDs, deployment classes, and stable/staging channels. It shows version, trust, remote, and verified-cache states independently. **Download & Verify** resolves only trusted logical catalog IDs and reuses the signed distribution pipeline; **Generate Installation Plan** reuses the existing planner and still stops before execution. The platform is local-first and includes no telemetry, analytics, or third-party tracking.

Documentation localization convention: `README.md` is the canonical English document. A future `README_TR.md` will be the maintained Turkish user-facing counterpart after its translation-quality gate is defined; no placeholder translation is kept.

## DevMode Keeper

Build once, then invoke the CLI through the workspace script:

```powershell
pnpm build
pnpm zui-webos devices list
pnpm zui-webos devices inspect --device tv
pnpm zui-webos apps list --device tv
pnpm zui-webos apps inspect --device tv --app com.zui.player
pnpm zui-webos package verify C:\path\to\application.ipk
pnpm zui-webos install plan C:\path\to\application.ipk --device tv
pnpm zui-webos devmode status --device tv
pnpm zui-webos devmode extend --device tv --dry-run
pnpm zui-webos devmode extend --device tv
pnpm zui-webos devmode ensure --device tv
pnpm zui-webos doctor --device tv
```

Add `--json` for machine-readable results. Configuration precedence is CLI arguments, environment variables, local user config, then defaults. The local config defaults to `%LOCALAPPDATA%\ZUI WebOS Platform\config.json` and must not contain secrets.

The public webOS CLI does not expose the resulting Developer Mode expiry timestamp. Keeper therefore reports command acceptance and post-command connectivity separately from `expiryVerified`; it never invents an expiry or claims that unknown state is measured.

Package inspection never executes an IPK. Installation Plan V2 is canonical, expiring, and approval-bound. Only a repository-pinned staging artifact can become executable, and execution requires its exact digest:

```powershell
pnpm zui-webos -- install plan C:\path\to\staging.ipk --device tv --save C:\path\to\plan.json
pnpm zui-webos -- install execute C:\path\to\plan.json --approve <exact-plan-digest>
```

Production app IDs are hard-blocked with no override. No scheduler or background service is installed by default.

## Safety model

- Official Developer Mode workflow only.
- Child processes use an executable plus an argument array with `shell: false`.
- Device aliases are validated before use.
- Commands have timeouts and deterministic structured errors.
- Logs redact connection addresses and credential-like values.
- Package installation, uninstallation, storage reset, rooting, privilege escalation, and firmware mutation are outside DevMode Keeper.

See [Threat Model](docs/security/THREAT_MODEL.md), [Catalog Service](docs/architecture/CATALOG_SERVICE.md), [Update Evaluation](docs/architecture/UPDATE_EVALUATION.md), [Package Security](docs/security/PACKAGE_SECURITY.md), [Release Metadata](docs/architecture/RELEASE_METADATA.md), [Artifact Distribution](docs/architecture/ARTIFACT_DISTRIBUTION.md), [Approval-Gated Installer](docs/architecture/APPROVAL_GATED_INSTALLER.md), [Device Manager](docs/architecture/DEVICE_MANAGER.md), [Package Inspector](docs/architecture/PACKAGE_INSPECTOR.md), and [Installation Planner](docs/architecture/INSTALLATION_PLANNER.md).

## Roadmap

1. DevMode Keeper CLI and rootless device core.
2. Local Device Manager and verified installer.
3. Signed catalog, release/package registry, and update intelligence.
4. Local Web Manager (read-only inspection, verified fetch, and planning).
5. TV Store / launcher.
6. Optional user-controlled scheduling after a separate acceptance milestone.

## Contributions

The repository begins with a strict, clean TypeScript baseline. Changes should preserve rootless boundaries, add tests for process behavior, and keep external product repositories independent. Persistent staging-key operations and CI release publication remain future work; production signing/deployment is not authorized.

## License

Original platform code is licensed under the [MIT License](LICENSE). External products retain their own licenses; this repository does not relicense or incorporate their source.
