# Repository Model

## Boundaries

`ZUI_WebOS_Platform` is one monorepo for platform-owned tooling and services. ZUI IPTV Player and ZUI YouTube for webOS remain independent sibling repositories with independent history, releases, licenses, and application identities.

```text
C:\My_OS\LG-TV
|-- ZUI_WebOS_Platform   # this repository
|-- ZUI_IPTV_Player      # external product repository
`-- ZUI_YouTube_WebOS    # external product repository
```

The platform registry stores product metadata and repository URLs; it does not vendor, submodule, or duplicate product source.

## Workspace areas

| Area | Purpose | Current state |
|---|---|---|
| `apps/devmode-keeper` | CLI entry point and orchestration | implemented |
| `apps/zui-webos-manager` | future local Device Manager/installer | reserved |
| `apps/web-portal` | future management portal | reserved |
| `apps/tv-store` | future TV-side catalog/launcher | reserved |
| `packages/webos-client` | safe public webOS CLI adapter | implemented |
| `packages/shared-types` | device and command domain contracts | implemented |
| `packages/catalog-contracts` | internal product registry contract | implemented |
| `packages/design-system` | future shared UI tokens | reserved |
| `packages/shared-config` | future reusable configuration | reserved |
| `services/*` | future catalog/repository/release services | reserved |
| `repository/apps` | source-free internal product metadata | implemented |
| `docs/github`, `docs/migration` | preserved evidence | immutable historical material |

Generated output (`dist`, coverage, IPK files, captures, diagnostics, and `.migration-rehearsal`) is ignored. `.migration-rehearsal` remains locally retained evidence but is not platform source and is excluded from Git.

## Versioning

Workspace packages begin at `0.1.0` and remain private until a publication decision is made. The repository follows SemVer tags for coherent platform milestones. External product versions do not determine the platform version.
