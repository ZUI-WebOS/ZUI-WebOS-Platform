# Signed Release Distribution Report — 2026-10-02

Status: `DONE_WITH_CONCERNS`

The signed distribution and verified-cache chain is accepted for staging. It is not declared complete because acceptance used an ephemeral in-memory staging key rather than an operational encrypted persistent signing key.

## 1–5. Signature, canonicalization, trust, lifecycle, private key

- Detached Ed25519 signatures cover deterministic canonical manifest bytes; artifact digests remain SHA-256.
- The internal serializer has ordering, whitespace, number, Unicode, and rejection fixtures. It is described as JCS-compatible for this manifest contract, not as full RFC 8785 conformance.
- Key ID is the full uppercase SHA-256 of SPKI DER. The public trust store supports `ACTIVE`, `RETIRED`, and `REVOKED`, plus independent staging/production scopes.
- Revocation fails current cache revalidation. RETIRED remains cryptographically inspectable but is not currently trusted for new use because trusted timestamps are out of scope.
- Acceptance key `9A88FF6A23831F48EA0DB2D87313DEFC718A5DAE76BE97A7E8A41BBC9F439648` is staging-only. Its private key existed only in process memory and was never persisted. Only the public key entered Git.

## 6–10. Manifest, provider, download, cache, installer

- Manifest binds `zui-youtube-webos` 0.8.4 to source commit `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2` and the staging IPK identity.
- `GitHubReleaseProvider` uses authenticated `gh api`; `ArtifactDistributionService` owns manifest/signature retrieval, verification, bounded streaming, SHA-256, size and IPK identity checks.
- Downloads use randomized `.part.ipk` files and atomic promotion. Failure deletes only the exact partial file.
- Cache location is `%LOCALAPPDATA%\ZUI-WebOS\artifacts\sha256\816ECF...66F4\`; cache reuse rechecks signature, current key status, hash, size, app ID, and version.
- Planning requires both the existing repository pin and valid signed-cache evidence to emit `trustLevel: SIGNED`. Production and all earlier installer gates remain independent and cannot be overridden by signature trust.

## 11–12. Tests

- Crypto coverage includes valid/altered manifests and artifact hashes, unknown/wrong keys, lifecycle, revocation, scope, malformed base64, wrong algorithm, key-ID mismatch, canonical ordering/whitespace, numbers, and Unicode.
- Distribution coverage includes duplicate/missing assets, signature/release-state failure, oversize/truncation/tampering, app/version mismatch, partial cleanup, idempotent promotion, corrupted cache, and revoked cached signatures through a mockable network boundary.
- Policy tests prove signed staging planning, signed production blocking, and preserved unsigned-pinned staging behavior.
- Local gate result: format, lint, type-check, build, frozen install, `git fsck --full`, and **60/60 tests PASS**.

## 13–16. Real acceptance and integrity

- GitHub draft pre-release: `ZUI YouTube STAGING 0.8.4 — Distribution Acceptance`
- Tag identity: `zui-staging-0.8.4-acceptance`
- URL: https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS/releases/tag/untagged-85281fe33662d129a32d
- State verified: `DRAFT=true`, `PRE-RELEASE=true`.
- Exact assets: staging IPK, `release-manifest.json`, and `release-manifest.sig`; no production IPK.
- Historical staging artifact was recalculated as 94,208 bytes and `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4`.
- Actual platform provider/download/cache path returned `SIGNED_TRUSTED`; no manual download was used for acceptance.
- Generated plan: app `com.zui.webos.youtube.staging`, version 0.8.4, `SIGNED`, `ALLOW_WITH_APPROVAL`, same-version warning, digest `ED548439747B40C5C7491634F9A70A1209DFF7BF4707893F1CBE9A8D712672BA`. It was not executed.
- TV access was read-only inventory/health inspection. No install, uninstall, launch, storage clear, or Developer Mode extension occurred.
- YouTube `main` was verified before release creation at the required source SHA and must be rechecked after GitHub acceptance closeout.

## 17–18. CI, CodeQL, commits

Local gates pass. Final GitHub CI/CodeQL run URLs and commit SHAs are recorded in the final task response after the normal push; no force push or history rewrite is used.

## 19. Remaining risks

- The acceptance public key has no recoverable private counterpart and therefore cannot support another release. This is intentional and is the reason for `DONE_WITH_CONCERNS`.
- Full RFC 8785 conformance and trusted release timestamps are not claimed.
- `gh` is the initial authenticated GitHub transport dependency; general HTTP redirect policy is avoided rather than implemented.
- Repository plus authorized signing-key compromise remains a combined trust failure.

## 20. Exact next milestone

Implement **Operational Staging Signing and CI Release Automation**: provision an encrypted, externally stored staging PKCS#8 key; add hidden/environment secret input without argv/log exposure; define approval and rotation custody; add complete RFC 8785 conformance or a narrowly audited library; and create a CI workflow that produces only DRAFT staging pre-releases with provenance evidence. Production key creation and production deployment remain separately unauthorized.
