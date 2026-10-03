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

| Threat                       | Control                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Malicious device alias/input | strict allow-list validation; argv spawn; `shell: false`                                                             |
| Command injection            | executable and arguments remain separate; no shell concatenation                                                     |
| Credential exposure          | reuse webOS registry; redact addresses/credential-shaped values; no raw registry output in structured device results |
| Compromised package artifact | future install requires catalog provenance and SHA-256 verification                                                  |
| Rogue repository entry       | typed/schema-validated registry; organization URL policy; review gate                                                |
| Supply-chain dependency      | pnpm lockfile, frozen CI install, narrow dependency build-script allow-list, Dependabot without auto-merge           |
| Local privilege abuse        | run as normal user; no administrator/root requirement; bounded child processes                                       |
| Unsafe TV operation          | Keeper command surface excludes install, uninstall, storage reset, root and product launch operations                |
| False renewal claim          | extension acceptance and expiry verification are separate fields; unknown expiry remains unknown                     |
| Runaway process              | per-command timeout and deterministic timeout error                                                                  |

## Approval-gated installation extension

| Threat                                                  | Control                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Malicious plan modification or path/device substitution | Deterministic canonical JSON digest plus exact approval equality.                                |
| Approval replay                                         | Expiry and existing-receipt digest check.                                                        |
| Stale plan/device state                                 | Target and protected-production inventory re-read before mutation.                               |
| Artifact replacement after approval                     | Full streaming SHA-256 and manifest reparse immediately before install.                          |
| Malicious local path/package                            | Canonical normal-file path and bounded hostile-archive parser.                                   |
| Package/dependency spoofing                             | Repository-pinned hash/size/identity required for staging execution.                             |
| Compromised registry metadata                           | Pinned metadata is not signing; protected main and review reduce but cannot eliminate this risk. |
| Incorrect device targeting                              | Alias is part of the digest and returned inventory must match it.                                |
| Production overwrite                                    | InstallerService independently permits staging only and hard-blocks both production IDs.         |
| Secret exposure in logs/receipts                        | Sanitized output and a minimal receipt contract without credentials.                             |

## Signed distribution extension

| Threat                                               | Control                                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compromised artifact host or artifact replacement    | Ed25519 manifest verification precedes metadata trust; streaming bytes must match signed SHA-256 and size.                                                                                              |
| Manifest tampering or signature substitution         | Deterministic canonical payload and detached-signature verification against a key ID derived from SPKI.                                                                                                 |
| Unknown key injection or stale/revoked key           | Validated public trust store, explicit lifecycle decisions, time bounds, and revalidation on every high-trust cache use.                                                                                |
| Private-key leakage                                  | Private material is external-only; acceptance key is generated in memory and never persisted.                                                                                                           |
| Malicious provider result or repository substitution | Registry allow-list, exact provider repository equality, HTTPS GitHub API URL validation, and exact draft/pre-release state.                                                                            |
| Partial/oversized download                           | Bounded streaming to randomized `.part.ipk`, measured byte ceiling, exact size, cleanup on failure, atomic promotion only after inspection.                                                             |
| Cache poisoning                                      | Content-addressed directory plus repeat signature, hash, size, app ID, and version validation.                                                                                                          |
| Staging key used for production                      | Artifact deployment class selects required key scope; production policy remains independently hard-blocked.                                                                                             |
| Replayed old signed release                          | Repository pin agreement, release identity/source commit binding, key lifecycle/time window, and explicit approval-plan expiry. Trusted timestamps and general anti-rollback policy remain future work. |
| Repository compromise                                | Signed key trust is separate from repository metadata; disagreement blocks. A compromise of both repository and authorized private key remains out of scope.                                            |

## Local Web Manager extension

The Web Manager is a loopback-only control-plane view. Browser content is untrusted even when it runs on the same host. The API therefore exposes typed platform operations rather than shell, arbitrary-path, or generic command primitives.

| Threat                                                        | Control                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hostile website attacks a localhost service                   | Fixed `127.0.0.1` binding; strict `Host` allow-list; non-simple state-changing requests require an application header and an exact loopback `Origin`; responses deny framing and use a restrictive CSP.                                          |
| CSRF or form submission to a state-changing route             | POST routes require `X-ZUI-Request: web-manager`; foreign origins are rejected; JSON or raw IPK content types are endpoint-specific.                                                                                                             |
| Arbitrary local file access or path traversal                 | The API accepts uploaded bytes, not a client-supplied filesystem path; filenames are reduced to a basename and allow-listed characters; opaque UUID storage is rooted under the app-local data directory. There is no browse/read-file endpoint. |
| Malicious, oversized, or malformed IPK                        | Request and package size limits, `.ipk` extension gate, exclusive file creation, and the existing bounded hostile-archive inspector. Inspection never executes package content.                                                                  |
| XSS through device, application, receipt, or catalog metadata | React text rendering escapes untrusted values; no raw HTML insertion; restrictive script/style/connect CSP; external links use `rel=noreferrer`.                                                                                                 |
| Command injection through API fields                          | Device aliases pass existing validation; platform process calls use argv with `shell: false`; no `/run-command`, executable selector, raw arguments, or generic process endpoint exists.                                                         |
| Unsafe mutation exposure                                      | Web routes expose inventory, status, inspection, cache/receipt reads, and plan generation only. There is no install execution, uninstall, storage clear, launch, signing, cache deletion, or Developer Mode extension route/button.              |
| Secret or stack disclosure                                    | Device addresses and registry credentials are excluded from DTOs; receipts are projected onto an explicit allow-list; errors return stable code/message/action without a stack.                                                                  |
| Cross-user access on a shared host                            | Loopback limits network reach but is not an OS-user authentication boundary. Per-user binding/authentication is deferred and must precede broader or multi-user exposure.                                                                        |

## Trust assumptions

The locally installed LG webOS CLI and the device registry are trusted user-managed dependencies. A registered alias does not prove reachability. A successful extension launch marker plus a separate post-command connectivity check proves command-level acceptance, not the exact resulting expiry.

## Out of scope

- compromised TV firmware or host operating system;
- bypassing LG Developer Mode limits;
- permanent installation through rooting;
- cloud-to-TV remote control;
- automatic installation of product packages.
