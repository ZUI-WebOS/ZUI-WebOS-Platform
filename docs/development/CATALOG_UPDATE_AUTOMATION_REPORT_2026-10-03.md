# Catalog + Release Automation + Update Intelligence Report — 2026-10-03

Status: `CATALOG_UPDATE_AUTOMATION_COMPLETE`

The milestone adds a normalized, trust-aware application catalog and update-management workflow to the local Web Manager. It ends at a read-only installation plan. No installation, uninstall, launch, storage clear, Developer Mode extension, product-repository mutation, or acceptance-release mutation occurred.

## 1. Catalog architecture

`packages/catalog-service` is the backend normalization boundary. It composes validated product/release records, installed inventory, provider evidence, and revalidated cache evidence into browser-safe catalog contracts. The frontend never reconstructs trust, compatibility, or policy.

## 2. Product normalization

Registry entries become scalable `CatalogProduct` objects with stable product ID/name/repository, all production/staging App IDs, deployment classes, rootless compatibility, releases, and installed/update comparisons. No IPTV/YouTube-specific UI branch was added.

## 3. Release normalization

Normalized releases expose logical ID, version, stable/staging/beta channel, repository, optional source commit, provider-observed draft/prerelease/published state, trust, signing key, and artifacts. Production 0.8.4 and the staging acceptance release are separate records.

## 4. Artifact normalization

Artifacts expose filename, App ID, version, deployment class, byte size, SHA-256, trust, signing key, remote availability, cache availability, and last verification. Trust, remote evidence, and cache integrity are independent fields.

## 5. UpdateEvaluationService

The pure evaluator implements `UP_TO_DATE`, `UPDATE_AVAILABLE`, `AHEAD_OF_CATALOG`, `NOT_INSTALLED`, `VERSION_UNKNOWN`, and `NO_COMPATIBLE_RELEASE`. SemVer ordering is used only when both values are valid; the highest compatible release is selected with prerelease semantics.

## 6. Channel/deployment safety

Candidates require exact product, App ID, deployment class, and compatible channel. Production maps only to stable and staging only to staging. The staging 0.8.4 release cannot be presented as an update to production 0.8.3.

## 7. Trust-aware update state

Version, trust, and policy remain separate. A newer catalog version can still be blocked. `PLAN_AVAILABLE` requires a compatible staging artifact in `CACHED_VERIFIED` state with signed or pinned trust; actual plan generation revalidates the cache and existing policy again. Production remains blocked.

## 8. Artifact availability/cache

`REMOTE_AVAILABLE`, `REMOTE_UNAVAILABLE`, and `REMOTE_UNKNOWN` do not imply trust. Provider failure is unknown rather than falsely absent. `CACHED_VERIFIED`, `NOT_CACHED`, and `CACHE_INVALID` come from the existing content-addressed cache semantics; no second cache was created.

## 9. Catalog API

The loopback API provides catalog summary, product detail, release detail, trusted artifact fetch, and catalog-to-plan routes. Requests carry only product/release/artifact logical IDs. Arbitrary URL, repository, destination, filesystem path, and command fields are rejected. Structured catalog errors map to stable messages/actions without stack traces.

## 10. Web Manager Dashboard

Dashboard metrics are calculated from current services: reachable devices, managed products, available updates, and verified artifacts. Real acceptance reported three configured devices with only `tv` reachable, two managed products, one available update, and one verified artifact.

## 11. Applications update UX

Managed rows show name, App ID, installed version, deployment class, channel, compatible version, update status, and trust. Status text accompanies color. Real inventory produced:

- `com.zui.player` 1.0.1 — `NO_COMPATIBLE_RELEASE`;
- `youtube.leanback.v4` 0.8.3 — `UPDATE_AVAILABLE` against the separate stable 0.8.4 repository-pinned candidate;
- `com.zui.webos.youtube.staging` 0.8.4 — `UP_TO_DATE` against signed staging 0.8.4.

The stable candidate is version intelligence, not an installation recommendation: it is not signed/cached and production policy remains blocked.

## 12. Catalog UX

The catalog is data-driven and includes product-name/App-ID search plus installed, updates, production, and staging filters. Cards show repository, identity, installed/available version, update status, and trust without arbitrary remote icon rendering.

## 13. Product/release detail

Hash routes support product and release detail. Product detail shows identities, rootless compatibility, installed/update state, and release history. Release detail shows channel, repository, commit/state/trust/key evidence, and full artifact identity, digest, availability, and cache state.

## 14. Download & Verify workflow

The UI/API path resolved the immutable authorized YouTube staging draft through validated metadata and reused `GitHubReleaseProvider` plus `ArtifactDistributionService`. Existing cache bytes were revalidated as `SIGNED`, `SIGNED_TRUSTED`, and `CACHED_VERIFIED`: SHA-256 `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4`. The draft release was read only and unchanged.

## 15. Catalog-to-plan workflow

The selected staging artifact was resolved from the verified cache, revalidated, and passed to the existing planner. The read-only plan reported App ID `com.zui.webos.youtube.staging`, version 0.8.4, `SIGNED`, `ALLOW_WITH_APPROVAL`, `SAME_VERSION`, `STAGING_APP`, and `SAME_VERSION_REINSTALL`. The browser DTO contains neither absolute artifact path nor proposed command. It was not executed, and no execute/approval control exists.

## 16. EN/TR i18n

New catalog, update, trust, availability, filters, actions, details, errors, and plan text are covered by the existing English/Turkish architecture. Turkish includes “Güncelleme mevcut”, “Güncel”, “Katalog sürümünden ileride”, “Yüklü değil”, “Doğrulanmış paket”, “İndir ve doğrula”, “Sürüm kanalı”, “Kararlı”, and “Test / Staging”. `README.md` remains English canonical; a quality-gated `README_TR.md` remains deferred.

## 17. Security

The threat model now covers malicious IDs/metadata, URL injection, cache poisoning, untrusted-release elevation, XSS, unsafe remote icons, frontend policy forgery, and production/staging confusion. Host/Origin/custom-header/CSP controls remain. The platform remains local-first with no telemetry, analytics, or tracking.

## 18. Tests

Full local verification passed: formatting, ESLint, type checks, production builds, and **89/89 tests** across 11 files. New tests cover update selection/statuses, channel separation, normalization, trust/cache/remote independence, API fetch/plan/security, live loopback HTTP behavior, UI filters/details/actions/failures, blocked production display, and EN/TR terminology. Deterministic MOCK mode requires no TV/network.

## 19. Real device acceptance

Real services read current `tv` inventory: IPTV 1.0.1, YouTube production 0.8.3, and YouTube staging 0.8.4. TV interaction was read-only. No package/device/application/Developer Mode mutation was performed.

## 20. Real catalog acceptance

Two products and separate stable/staging 0.8.4 releases loaded. Installed identities correlated exactly. The staging release rendered `SIGNED`, `REMOTE_AVAILABLE`, and `CACHED_VERIFIED`; the stable integration record rendered `REPOSITORY_PINNED_HASH`, `REMOTE_UNAVAILABLE`, and `NOT_CACHED`. Production and staging comparisons remained isolated.

## 21. Real distribution acceptance

The Web Manager/API path—not a manual download shortcut—read the existing authorized draft, revalidated its signature/key/hash/size/App ID/version, and returned the verified cache result. No release asset/state was modified.

## 22. Screenshot evidence

Sanitized evidence is stored in `docs/screenshots/catalog-update/`: `dashboard.png`, `applications.png`, `catalog.png`, `product-detail.png`, `release-detail.png`, `verified-artifact.png`, and `install-plan.png`. The captures contain no device IP, credentials, tokens, private keys, or private filesystem paths.

## 23. Port regression verification

Default binding remains `127.0.0.1:4273`; `ZUI_WEB_MANAGER_PORT` remains validated to integer range 1–65535; Vite `strictPort` remains enabled; occupied-port startup fails with actionable guidance; no active-code 4173 reference or silent fallback exists. Acceptance servers were stopped, leaving neither 4173 nor 4273 listening.

## 24. CI/CodeQL

`pnpm install --frozen-lockfile`, `pnpm verify`, `git diff --check`, `git fsck --full`, and the secret-pattern scan pass locally. Remote CI and CodeQL evidence will be recorded in the report-only closeout after the implementation push.

## 25. Git commits

Implementation commits:

1. `e03bc28` — catalog/update contracts, service, metadata, and unit tests;
2. `6e4508f` — trusted catalog API, artifact fetch/cache/plan integration, and API security tests;
3. `34f454b` — catalog/update Web Manager UX, EN/TR additions, and UI tests.

All publication uses normal non-force pushes to `main`; no history rewrite is used.

## 26. Remaining risks

- The accepted staging public key still has no persistent recoverable private counterpart. Operational encrypted staging-key custody is intentionally deferred.
- Stable production 0.8.4 is repository-pinned local evidence, not a signed remotely available production release; policy remains blocked.
- Trusted timestamps, general anti-rollback policy, cache retention/history, and local activity persistence remain future work.
- Loopback isolation is not OS-user authentication and must not be treated as a multi-user boundary.
- A combined compromise of trusted repository metadata and an authorized signing private key remains outside the current trust model.

## 27. Exact next milestone

Implement **Operational Staging Release Automation**: externally store an encrypted persistent staging Ed25519/PKCS#8 key; define non-argv secret input, custody, approval, rotation, and revocation; produce draft-only staging releases in CI with provenance/SBOM evidence; and add trusted timestamps/rollback policy. Production key creation, production publication/deployment, UI installation execution, and broader TV mutation remain separately unauthorized.
