# Device Manager Core + Verified Package Inspector Report

Status: `DEVICE_MANAGER_INSPECTOR_COMPLETE`

## 1. Device Manager implementation

Added branded device/application domain types, managed-device health/capabilities, inventory snapshots, deterministic public errors, and read-only service methods. The public webOS CLI remains isolated behind an argv-based `shell:false` adapter with timeout and captured output.

## 2. Device inventory

`ares-install --listfull --device <alias>` was discovered and verified against installed tooling. Its blank-line records and `key : value` fields are parsed without assuming a fixed field set. Missing optional fields are safe; missing IDs are rejected.

## 3. Package Inspector architecture

The new `@zui-webos/package-inspector` package validates the outer file and Debian `ar` members, safely decompresses bounded `data.tar.gz`, locates every `appinfo.json`, and streams SHA-256 over the outer IPK. It does not execute or extract package content.

## 4. IPK security model

Limits cover outer bytes, archive entries, individual entries/members, and total uncompressed bytes. Traversal, absolute/drive paths, backslashes, invalid UTF-8 replacement characters, duplicate paths, symlinks, hardlinks, malformed/truncated archives, decompression failure, and incomplete Debian package structure are rejected.

## 5. Registry provenance

The product registry now records explicit production/staging identities and optional expected publisher metadata. Product, release, and artifact contracts are separate. App-ID and publisher-text matches never set `authenticityVerified` to true.

## 6. Package/install comparison

`PackageDeploymentComparison` reports device, package app ID, installed record, version values/relation, and registry match. Only strict semantic versions are ordered; all other version forms are `UNKNOWN`.

## 7. Installation Planner

`install plan` combines real package inspection and real inventory into a read-only result. It includes a review-only argument array, `requiresExplicitApproval: true`, and `executable: false`. No installation path exists in this milestone.

## 8. Safety policy

Central policy emits deterministic `INFO`, `WARNING`, or `BLOCK` risks for production overwrite, staging identity, unknown product/provenance, downgrade, same-version reinstall, app-ID collision, invalid metadata, and unreachable device. YouTube production/staging and IPTV production identities come from the registry rather than CLI strings.

## 9. Tests

Synthetic IPKs are generated during tests; no large binary fixture is committed. Coverage includes inventory parsing/malformed records, timeout/unknown device, valid and invalid IPKs, truncation, traversal, size limits, duplicate paths, links, malformed/missing/multiple manifests, deterministic SHA-256, registry classes, semantic-version relations, overwrite/downgrade/staging/collision/unreachable policy, and dry-run behavior.

## 10. Real-device read-only acceptance

Device `tv` was visible and reachable. The read-only inventory contained:

| App ID | Title | Installed version |
|---|---|---:|
| `com.zui.player` | ZUI | 1.0.1 |
| `com.zui.webos.youtube.staging` | ZUI YouTube STAGING | 0.8.4 |
| `youtube.leanback.v4` | YouTube AdFree | 0.8.3 |

No product app was launched, installed, removed, overwritten, or cleared.

## 11. Real package inspection

| Artifact | Bytes | Recalculated SHA-256 | Manifest result |
|---|---:|---|---|
| `com.zui.webos.youtube.staging_0.8.4_all.ipk` | 94,208 | `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4` | staging ID/title/version 0.8.4 confirmed |
| `youtube.leanback.v4_0.8.4_all.ipk` | 94,188 | `9702EC57B69CB145EF7919DB2F79BA7FD3714F3D000E6A04C5F638F9F7817F3E` | production ID/title/version 0.8.4 confirmed |

The staging plan found the installed same-version staging app and emitted `STAGING_APP` plus `SAME_VERSION_REINSTALL`. The production plan found installed production 0.8.3, classified the candidate as an upgrade, and emitted blocking `PRODUCTION_APP_OVERWRITE`.

## 12. CLI examples

```powershell
pnpm zui-webos -- devices inspect --device tv
pnpm zui-webos -- apps list --device tv --json
pnpm zui-webos -- apps inspect --device tv --app com.zui.player
pnpm zui-webos -- package verify C:\path\to\package.ipk --json
pnpm zui-webos -- install plan C:\path\to\package.ipk --device tv --json
pnpm zui-webos -- doctor
```

## 13. CI/security

Local acceptance requires frozen dependency installation, formatting, lint, strict type checks, all tests, build, and Git object verification. Existing least-privilege CI and CodeQL workflows were not weakened. Remote CI/CodeQL results are recorded after the normal push.

## 14. Git commits

Changes are grouped into Device Manager/client, package inspector, planner/policy and registry, tests, and documentation/report commits. Existing history is not rewritten and only a normal main-branch push is permitted.

## 15. Remaining risks

- No trusted signed release/artifact channel exists; provenance remains explicitly unknown.
- The parser supports the measured `data.tar.gz` IPK payload and rejects other compression formats.
- Public CLI output is an external compatibility boundary and may require parser maintenance if LG changes its record format.
- A proposed installation command is informational only; approval and safe execution are intentionally absent.

## 16. Exact next milestone

**Trusted Release Metadata + Approval-Gated Installer**: introduce a trusted artifact/release provenance channel, explicit human approval boundary, re-verification immediately before execution, and transactional install/post-install verification. It must remain rootless and must begin as a separate milestone; no installation capability was pre-enabled here.
