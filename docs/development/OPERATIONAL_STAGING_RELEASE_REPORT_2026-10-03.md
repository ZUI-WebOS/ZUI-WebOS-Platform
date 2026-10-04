# Operational Staging Release Report — 2026-10-03

> The requested report filename is retained. Real operational acceptance began
> on 2026-10-03 and completed on 2026-10-04 (Europe/Istanbul) after the hidden
> passphrase interaction and clean Windows CI verification.

## 1. Operational signing architecture

The existing Ed25519, canonical manifest serialization, key-ID derivation,
public trust store, signature verifier, artifact distribution service, and
GitHub provider remain the single signing architecture. The new
`release-operations` package adds staging key storage, source binding, bundle
preparation, publishing, recovery, and read-back verification without adding a
production path.

## 2. Encrypted key storage

One operational Ed25519 private key exists outside Git as an encrypted PKCS#8
PEM under `%LOCALAPPDATA%\ZUI-WebOS\keys\`. The file is 302 bytes, begins with
the encrypted-private-key PEM header, and was never printed or copied into this
repository. Windows ACL evidence showed the private file grants full access
only to the current user; the containing directory also retains SYSTEM and
Administrators access.

## 3. Passphrase handling

Interactive generation and signing use a hidden terminal prompt. The
passphrase is not an argv value, config value, log field, receipt, bundle
member, or GitHub asset. A process-local environment option is documented with
its exposure limitations; the CLI deletes its environment entry after reading
and zeroes the temporary buffer where practical.

## 4. Public trust registration

Operational public key ID:

`D0A3CB0CEA165FC29E5EBAD3AE50108C2EBB2E3147ACF7478309AB8EBA5C6237`

The trust entry is Ed25519, `ACTIVE`, and scoped only to `STAGING_RELEASE`.
Only public SPKI material is stored in Git. The prior ephemeral acceptance key
`9A88FF6A...9648` is retained as `RETIRED` for historical evidence and is not
reused for new signatures.

## 5. Key lifecycle

List and inspect are read-only. Lifecycle tooling writes a non-overwriting
proposal for explicit review; it does not silently modify the active store.
`ACTIVE`, `RETIRED`, and `REVOKED` enforcement is covered with fixtures. The
real operational key was not rotated during testing.

## 6. Release preparation pipeline

The reusable pipeline requires a repository-pinned staging artifact, a clean
registered source repository, an explicit 40-character source SHA equal to
HEAD, and reachability from the expected ref. It inspects App ID/version,
recalculates size and SHA-256, unlocks the operational key, signs the canonical
manifest, verifies `SIGNED_TRUSTED`, and creates a non-overwriting local bundle.

Windows Store/AppContainer `%LOCALAPPDATA%` virtualization was discovered
during real acceptance. Runtime cache, release inputs, bundles, receipts, and
Web Manager uploads now derive from one process-neutral
`%USERPROFILE%\.zui-webos` root, configurable through the absolute
`ZUI_WEBOS_DATA_DIR`. Signing keys retain their separately protected
`%LOCALAPPDATA%` location.

## 7. GitHubReleasePublisher

The publisher accepts only the repository registered for the product, permits
staging manifests only, blocks duplicate release identities, creates
`draft=true` / `prerelease=true`, uploads exactly the IPK, manifest, and
detached signature, and verifies repository/tag/commit/state/name/size on
read-back.

The first real upload exposed an incorrect asset-upload host and stopped after
creating draft ID `402810510`, before any asset upload. The adapter now uses
the official `gh release upload` mechanism. A separate recovery command
requires the exact numeric release ID and signed release ID, validates the
existing draft and any existing asset subset, uploads only missing whitelist
assets without clobbering, and repeats full read-back verification.

## 8. CI verification

CI has no private key. It builds and verifies public release operations with
fixture keys. On final implementation/test commit
`5a805f0ad013debb1f9eb9dea30e1be8b256ade3`, CI run `37175442684`
passed, including the explicit public staging-release test step. CodeQL run
`37175442682` also passed.

Clean Windows CI found and drove two additional fixes: canonical comparison of
8.3 versus long paths, and a committed bin launcher so `pnpm exec zui-webos`
exists after a truly clean install before `dist` exists.

The process-level PowerShell regression test was also given an explicit
20-second timeout after a hosted runner exceeded Vitest's generic five-second
unit-test default. Assertions and coverage were unchanged.

## 9. Secret-safety verification

`git ls-files '*.pem'` returned no tracked PEM files. A tracked-file scan found
no encrypted or plaintext private-key PEM block. The bundle and GitHub release
contain no key, passphrase, token, credential, receipt, log, catalog record, or
verification report. The published asset whitelist contains exactly three
files.

## 10. Failure-path tests

Tests cover weak/wrong passphrases, missing/corrupt keys, overwrite refusal,
key identity/scope/lifecycle failures, dirty or mismatched source state, commit
reachability, artifact hash/identity mismatch, duplicate release identity,
unexpected repository/assets/state/commit, partial upload, recovery identity,
read-back mismatch, Windows argument preservation, spaces, normal backslashes,
LOCALAPPDATA paths, clean-install bin availability, and process-neutral data
roots.

## 11. Real staging release acceptance

- Product: `zui-youtube-webos`
- App ID: `com.zui.webos.youtube.staging`
- Version: `0.8.4`
- Source commit: `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`
- IPK size: `94208`
- SHA-256: `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4`
- Release: `zui-staging-zui-youtube-webos-0.8.4-20261003-ab05d0d`
- GitHub release ID: `402810510`
- State: `draft=true`, `prerelease=true`, `published_at=null`
- Assets: IPK `94208`, manifest `1048`, signature `215` bytes

The release remains an unpublished draft prerelease. No production asset or
source archive was uploaded.

## 12. Distribution re-verification

The normal authenticated provider re-read the release instead of trusting the
upload response. Manifest schema, operational signature, active staging scope,
artifact size/hash, App ID, and version passed. The artifact was independently
downloaded into the process-neutral content-addressed cache and a second cache
verification returned `SIGNED_TRUSTED` with the operational key ID.

## 13. Catalog integration

The staging release record now points to the operational draft identity.
Measured catalog output was `DRAFT`, `STAGING`, `SIGNED`,
`REMOTE_AVAILABLE`, and `CACHED_VERIFIED`, with `published=false` and the
operational signing-key ID. It cannot be selected as a production/stable
update.

## 14. Read-only plan result

A deterministic no-device fixture generated a plan from the real cached IPK
and current registry metadata. Result: staging App ID `0.8.4`, trust level
`SIGNED`, policy `ALLOW_WITH_APPROVAL`, `requiresExplicitApproval=true`, and
only the informational `STAGING_APP` risk. The proposed command was not run and
no TV was contacted or mutated.

## 15. GitHub/source integrity

The YouTube source checkout remained clean with
`HEAD == origin/main == ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`.
No branch, tag, source file, Dependabot PR, repository setting, existing
acceptance draft, or organization setting was modified. Historical acceptance
release ID `402119835` remains draft/prerelease with its original three assets
and recorded update time `2026-10-02T20:05:08Z`.

## 16. Tests

Local final gates passed:

- `pnpm install --frozen-lockfile`
- format check
- lint
- type-check
- 14 test files / 111 tests
- build
- `git diff --check`
- `git fsck --full`

## 17. CI / CodeQL

- CI: PASS — run `37175442684`
- CodeQL: PASS — run `37175442682`

Earlier failed CI attempts are retained as evidence. They resulted in the two
Windows clean-run fixes described above; they were not ignored or rerun without
code changes.

## 18. Git commits

- `52bb442` — operational staging key/pipeline/publisher/tests
- `576d4c6` — operations/security documentation and catalog registration
- `2261c77` — canonical Windows runtime-path test
- `6f56643` — clean-install CLI bin launcher
- `9f17de7` — operational acceptance report
- `5a805f0` — hosted Windows process-startup test allowance

All pushes were normal non-force pushes to `main`.

## 19. Remaining risks

- Loss of the encrypted key or its separately stored passphrase prevents future
  signatures with this key; independent manual backup remains an operator duty.
- Environment-variable passphrase input is less private than the hidden prompt.
- A sufficiently privileged local administrator can access user files despite
  restrictive ACLs.
- Partial network/API failures can leave a draft; recovery is intentionally
  explicit, identity-bound, non-clobbering, and staging-only.
- The draft is intentionally not public/stable. Publication remains a separate
  human-controlled future decision.

## 20. Exact next milestone

The next major product milestone is **TV STORE MVP**. No additional backend or
security-foundation milestone is proposed.

## Final status

**OPERATIONAL_STAGING_RELEASE_COMPLETE**
