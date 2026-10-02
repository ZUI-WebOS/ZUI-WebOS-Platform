# Trusted Release Metadata + Approval-Gated Installer Report

Status: `TRUSTED_RELEASE_INSTALLER_COMPLETE`

## 1. Trust model

Trust levels are `UNVERIFIED`, `REGISTRY_MATCH`, `REPOSITORY_PINNED_HASH`, and reserved `SIGNED`. No signature verifier exists, so `SIGNED` is never emitted. A pinned hash is repository-controlled provenance, not publisher signing or authorship proof.

## 2. Product/release/artifact contracts

Product identity remains in `products.json`. Version/channel/source belongs to `ProductRelease`; filename, app identity, deployment class, size, SHA-256, and source descriptor belong to `ReleaseArtifact`.

## 3. Release metadata registry

`repository/releases/zui-youtube-webos/0.8.4.json` contains the two locally reverified 0.8.4 artifacts. Validation enforces product/app/deployment relationships, versions, sizes, hashes, sources, unique releases/artifact IDs, and non-conflicting hashes.

## 4. Package verification integration

`package verify` now reports expected/observed hash, size, app ID, version, deployment class, artifact record, result status, and trust level. Matching staging bytes produce `VERIFIED_PINNED_ARTIFACT` and `REPOSITORY_PINNED_HASH`.

## 5. Installation Plan V2

Plan V2 records timestamps, device alias, canonical artifact path/hash/identity/trust, target and protected-production state, comparison, risks, policy, proposed argv, approval requirement, executable state, and digest.

## 6. Plan digest/canonicalization

Object keys are recursively sorted and compact JSON is hashed with SHA-256; `planDigest` is excluded from its own input. Reordered keys preserve the digest, while semantic edits invalidate it.

## 7. Approval mechanism

Execution requires `--approve` to equal the exact plan digest. There is no generic confirmation, force switch, or production override. Used plans are rejected when a receipt already contains their digest.

## 8. TOCTOU protections

Immediately before mutation the service reopens, fully rehashes, reparses, and reclassifies the artifact, then refreshes target and protected-production inventory. Path, mtime, and size alone are insufficient.

## 9. InstallerService

The dedicated service validates plan/digest/approval/expiry/policy, performs preflight, invokes the public adapter, verifies postconditions, and writes a receipt. CLI contains orchestration only.

## 10. Policy engine

Only known staging plus matching pinned metadata, reachable device, and no blocking risks produces `ALLOW_WITH_APPROVAL`. Unknown product/provenance, mismatch, production, downgrade, unreachable device, or invalid package produces `BLOCK`.

## 11. Production hard blocks

Both `com.zui.player` and `youtube.leanback.v4` are independently rejected by InstallerService even if a digest is supplied. Production plans are non-executable and there is no override.

## 12. Post-install verification

Success requires public install exit code 0, expected staging app/version in refreshed inventory, and unchanged protected-production versions. The implementation claims transactional orchestration, not ACID rollback.

## 13. Audit receipts

Receipts are JSON under `%LOCALAPPDATA%\ZUI-WebOS\receipts\`, outside Git. They include plan/artifact identity, risks, approval, command exit, post-install result, and rollback availability, but no credentials.

## 14. Tests

The 44-test suite covers metadata validation/mismatch, canonical digest, semantic tampering, wrong approval, expiry, replay, changed device/state, same-size artifact replacement, unpinned staging, production hard blocks, safe argv construction, receipt generation, and successful staging flow.

## 15. Real staging install acceptance

One authorized reinstall ran through `install execute` and InstallerService using `com.zui.webos.youtube.staging` 0.8.4, SHA-256 `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4`, plan digest `863F30E6DFCE001B424BE1BC0F1584399FBEE2BB5A42510A22953B6B313426C2`. Command exit was 0 and post-install verification passed.

## 16. Production isolation proof

After acceptance, inventory still contained `com.zui.player` 1.0.1 and `youtube.leanback.v4` 0.8.3 unchanged. No production launch, install, uninstall, replacement, or storage clear occurred.

## 17. CI/CodeQL

Required local gates are frozen install, format, lint, strict type-check, tests, build, and `git fsck --full`. Existing least-privilege CI and CodeQL workflows remain unchanged; remote results are verified after push.

## 18. Git commits

Changes are grouped into release metadata, approval-bound planning, installer/policy/tests, and acceptance/docs commits without history rewriting.

## 19. Remaining risks

- Repository-pinned hashes are not cryptographic publisher signatures.
- Repository compromise can alter code and metadata subject to branch/security controls.
- LG CLI does not provide atomic rollback.
- Receipt replay protection is local to the receipt store and assumes serialized local execution.
- Only measured `data.tar.gz` IPKs are supported.

## 20. Exact next milestone

**Signed Release Manifest + Trusted Artifact Distribution**: add offline-verifiable signed release manifests, key rotation/revocation, trusted download with digest/signature verification, and rollback artifact availability. Production deployment must remain a separately authorized future milestone.
