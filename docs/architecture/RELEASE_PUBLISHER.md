# Staging Release Publisher

`packages/release-operations` adds an operator layer over the existing signing and distribution architecture. It does not introduce new cryptography, trust semantics, artifact inspection, cache, or catalog policy.

## Pipeline

```text
Pinned staging artifact + clean registered source commit
  -> Package Inspector
  -> canonical SignedReleaseManifest
  -> encrypted PKCS#8 staging key unlock
  -> Ed25519 detached signature
  -> local non-overwriting bundle
  -> local public verification
  -> registry-bound GitHub draft prerelease
  -> exact three-asset upload
  -> GitHub read-back verification
  -> existing ArtifactDistributionService
  -> verified cache -> CatalogService -> read-only plan
```

`StagingKeyStore` generates one encrypted Ed25519 PKCS#8 key outside Git, derives its public key ID from SPKI DER, refuses overwrite, and applies the best available OS permissions. Passphrases enter through a hidden TTY prompt or an explicitly documented environment variable and never enter argv/output.

`GitSourceRepositoryVerifier` requires a clean checkout, exact HEAD SHA, registered `origin`, and reachability from the expected ref. `StagingReleasePipeline` permits only pinned staging metadata, validates IPK bytes/identity, requires an ACTIVE `STAGING_RELEASE` public key, and writes a non-overwriting local bundle.

`GitHubReleasePublisher` accepts a validated prepared bundle and product registry. The GitHub transport is mockable; the real adapter invokes `gh` with argument arrays and no shell. It refuses duplicate tags or unregistered repositories, creates only a draft prerelease, uploads only the staging IPK/manifest/signature, and fails closed on state, target-commit, asset-name, or asset-size disagreement. Partial failure does not publish or silently delete evidence.

No API supports stable/production publication, private-key upload, source mutation, or TV installation.
