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

## Operational staging release extension

| Threat                          | Control                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private-key theft               | Encrypted PKCS#8 outside Git, no overwrite, restrictive OS ACL/mode, independent encrypted backup, and no CI/release upload.                                          |
| Passphrase exposure             | Hidden TTY prompt by default; no argv/config/log/receipt value; process buffer zeroing; environment-input limitations documented.                                     |
| Wrong repository release        | Product-registry allow-list and exact manifest/repository agreement before any GitHub mutation.                                                                       |
| Artifact substitution           | Pinned metadata plus package inspector, SHA-256, size, App ID, version, deployment class, and signed manifest checks before and after upload.                         |
| Source-commit spoofing          | Clean source checkout, exact HEAD, registered origin, explicit full SHA, expected-ref reachability, manifest binding, and GitHub target read-back.                    |
| Partial GitHub upload           | Failure stops; release remains draft evidence, is never published/deleted automatically, and cannot enter catalog until exact read-back passes.                       |
| Stale, retired, or revoked key  | Preparation requires ACTIVE lifecycle, valid time window, known public/private key ID, and `STAGING_RELEASE` scope.                                                   |
| Staging key used for production | Pipeline rejects non-staging channel/deployment; signer scope verification and existing production install hard blocks remain independent.                            |
| Malicious operator input        | Safe identifier grammar, registry resolution, exact approval ID, argv process execution with no shell, and non-overwriting filesystem writes.                         |
| Release-name collision          | Local exclusive bundle creation and remote duplicate-tag refusal; existing releases are never selected as mutation targets.                                           |
| CI/log leakage                  | CI uses public verification data/test keys only; the operational private key/passphrase is absent from GitHub Secrets, artifacts, argv, output, and repository files. |

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

## Catalog and update intelligence extension

Catalog metadata and browser selections are untrusted inputs. The backend, not the frontend, remains authoritative for identity, compatibility, trust, availability, cache verification, and policy.

| Threat                                       | Control                                                                                                                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious catalog ID or path traversal       | Logical IDs are syntax-validated and resolved only within schema-validated registry/release data; unknown and path-shaped IDs fail closed.                                                                      |
| Malicious release metadata                   | Product/release schemas, repository identity agreement, App ID/version/deployment checks, signed-manifest verification, and existing planner policy remain independent gates.                                   |
| Arbitrary download URL/repository injection  | Fetch requests accept only product, release, and artifact IDs. URLs, destinations, paths, repositories, and commands are rejected. The backend resolves the allow-listed source.                                |
| Cache poisoning or stale trust               | Every catalog cache projection and catalog-to-plan request reuses `ArtifactDistributionService.verifyCached`, including current signing-key lifecycle/scope, signature, hash, size, App ID, and version checks. |
| Untrusted remote release elevated to trusted | GitHub provider evidence supplies availability/draft state only. Provider failure is unknown; remote presence never creates signature trust.                                                                    |
| XSS through product/release metadata         | Browser DTOs contain data rather than HTML; React escapes text; CSP remains restrictive; arbitrary remote HTML/SVG icons are not rendered.                                                                      |
| Frontend-generated trust or policy           | The browser sends selections only. Catalog Service and existing backend planner compute trust, comparisons, and policy.                                                                                         |
| Production/staging confusion                 | Candidate selection requires exact product, App ID, deployment class, and compatible channel. Staging is never compared as a stable production update.                                                          |
| Local activity used as telemetry             | No analytics, tracking, or telemetry endpoint exists; current catalog state and actions remain local to the host.                                                                                               |

## Trust assumptions

The locally installed LG webOS CLI and the device registry are trusted user-managed dependencies. A registered alias does not prove reachability. A successful extension launch marker plus a separate post-command connectivity check proves command-level acceptance, not the exact resulting expiry.

## Out of scope

- compromised TV firmware or host operating system;
- bypassing LG Developer Mode limits;
- permanent installation through rooting;
- cloud-to-TV remote control;
- automatic installation of product packages.
