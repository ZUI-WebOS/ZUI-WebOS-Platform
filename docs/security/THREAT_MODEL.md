# Threat Model

## Security boundary

The platform is rootless and Developer Mode only. It does not patch firmware, modify system partitions, inject privileged daemons, exploit private Luna services, or elevate SSH privileges.

## Protected assets

- webOS device registry credentials and private keys;
- local network addresses and device aliases;
- future release-signing keys and unpublished artifacts;
- package hashes, catalog provenance, and rollback records;
- local operational logs.

## Threats and controls

| Threat | Control |
|---|---|
| Malicious device alias/input | strict allow-list validation; argv spawn; `shell: false` |
| Command injection | executable and arguments remain separate; no shell concatenation |
| Credential exposure | reuse webOS registry; redact addresses/credential-shaped values; no raw registry output in structured device results |
| Compromised package artifact | future install requires catalog provenance and SHA-256 verification |
| Rogue repository entry | typed/schema-validated registry; organization URL policy; review gate |
| Supply-chain dependency | pnpm lockfile, frozen CI install, narrow dependency build-script allow-list, Dependabot without auto-merge |
| Local privilege abuse | run as normal user; no administrator/root requirement; bounded child processes |
| Unsafe TV operation | Keeper command surface excludes install, uninstall, storage reset, root and product launch operations |
| False renewal claim | extension acceptance and expiry verification are separate fields; unknown expiry remains unknown |
| Runaway process | per-command timeout and deterministic timeout error |

## Approval-gated installation extension

| Threat | Control |
|---|---|
| Malicious plan modification or path/device substitution | Deterministic canonical JSON digest plus exact approval equality. |
| Approval replay | Expiry and existing-receipt digest check. |
| Stale plan/device state | Target and protected-production inventory re-read before mutation. |
| Artifact replacement after approval | Full streaming SHA-256 and manifest reparse immediately before install. |
| Malicious local path/package | Canonical normal-file path and bounded hostile-archive parser. |
| Package/dependency spoofing | Repository-pinned hash/size/identity required for staging execution. |
| Compromised registry metadata | Pinned metadata is not signing; protected main and review reduce but cannot eliminate this risk. |
| Incorrect device targeting | Alias is part of the digest and returned inventory must match it. |
| Production overwrite | InstallerService independently permits staging only and hard-blocks both production IDs. |
| Secret exposure in logs/receipts | Sanitized output and a minimal receipt contract without credentials. |

## Trust assumptions

The locally installed LG webOS CLI and the device registry are trusted user-managed dependencies. A registered alias does not prove reachability. A successful extension launch marker plus a separate post-command connectivity check proves command-level acceptance, not the exact resulting expiry.

## Out of scope

- compromised TV firmware or host operating system;
- bypassing LG Developer Mode limits;
- permanent installation through rooting;
- cloud-to-TV remote control;
- automatic installation of product packages.
