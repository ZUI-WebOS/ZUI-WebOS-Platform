# ZUI Web Manager MVP Report — 2026-10-02

Status: `WEB_MANAGER_MVP_COMPLETE`

The local, read-heavy Web Manager is implemented on the existing `apps/web-portal` scaffold. It reuses the platform domain/services and deliberately exposes no installation execution or Developer Mode extension capability.

## 1. Architecture

React 19, TypeScript, and Vite provide the browser application. A small Node HTTP process serves the built assets and a typed loopback API. Browser-safe DTOs are shared through `apps/web-portal/src/contracts.ts`; Node-only packages stay behind the API. The existing package inspector, catalog contracts, webOS client, planner, and receipt store remain authoritative.

## 2. Local API

`pnpm web` builds and serves real mode at `http://127.0.0.1:4173`; `pnpm web:mock` serves deterministic fixture mode. Narrow endpoints cover health, dashboard, one validated device, catalog, cache, receipts, raw-IPK inspection, read-only plan creation, and the process-memory latest plan. There is no generic command, arbitrary filesystem, or installer endpoint.

## 3. Security

The server binds a fixed loopback address, validates Host and Origin, requires a custom request header for POST, limits request/package bytes, applies CSP/frame/no-sniff/no-store headers, sanitizes filenames, and stores uploads under opaque UUID names in app-local data. React escapes displayed metadata. DTO projection excludes device addresses, credentials, raw command output, and receipt extras. Structured errors contain no stack traces. The threat model records localhost, CSRF, path traversal, hostile IPK, XSS, injection, mutation, secret-disclosure, and shared-host residual risks.

## 4. UI shell/design

`packages/design-system` supplies reusable panel, badge, metric, button, and empty-state primitives plus a dark, desktop-first responsive visual system. Status is expressed by text and color, keyboard focus is visible, labels and semantic tables are used, and the identity does not claim LG/webOS affiliation.

## 5. Dashboard

The dashboard reports only measured platform values: configured/reachable devices, installed and staging app counts, products/releases, verified-cache count, Developer Mode observation, and recent receipt/cache counts. MOCK mode is explicitly labeled.

## 6. Devices

Device cards show alias, reachability, and default selection without addresses or key material. Device detail performs a scoped refresh and shows connectivity, Developer Mode observation, and installed application inventory.

## 7. Applications

The inventory displays title, App ID, version, and registry-derived Production/Staging/Unknown classification. No fixed assumption limits the list to current ZUI applications.

## 8. Catalog/releases

Registry products show repository, known production/staging identities, deployment class, and rootless compatibility. Release artifacts show version, filename, digest prefix, deployment class, and signed-cache trust where available. A matching verified cache entry is presented as `Signed / SIGNED_TRUSTED`; an uncached registry artifact remains `Pinned hash` rather than being called safe.

## 9. Package inspector

The user chooses a local IPK and sends its bytes to the bounded upload endpoint. The UI shows filename, App ID, version, SHA-256, registry match, and trust result. Inspection uses the hardened existing parser and cannot execute the artifact.

## 10. Installation plans

The UI can generate and display an Installation Plan V2 for the selected device, including candidate identity/version, trust, policy decision, and all risk flags. The interface explicitly states that execution is deferred and contains no approval or execute control. Deterministic fixtures and policy tests cover both `ALLOW_WITH_APPROVAL` staging and hard-blocked production.

## 11. Verified cache

The read-only cache view shows product/release identity, artifact, shortened digest with the full value in accessible title text, trust decision, key identifier, and verification time. No delete action exists. The API reads only validated metadata projections.

## 12. Receipts

Existing per-user receipts are mapped onto timestamp, device alias, app, version, trust, result, and post-install verification. Unknown fields, tokens, raw commands, and credentials cannot enter the browser DTO.

## 13. DevMode view

Dashboard/device detail display device reachability, observed time, and the status available through the public CLI. Unknown expiry remains unknown. No extend/ensure mutation is exposed.

## 14. EN/TR i18n

Core navigation, statuses, actions, settings, risks, and page labels use translation keys for English and Turkish. English is default; the selected locale persists in local storage and updates the document language. `README.md` is documented as English canonical; a quality-controlled future `README_TR.md` is tracked without a placeholder.

## 15. Tests

API tests cover deterministic online/offline fixtures, production/staging classifications, signed release metadata, explicit allowed-staging and blocked-production plan fixtures, receipt sanitization, and structured recovery guidance. UI tests cover dashboard/MOCK rendering, offline state, classifications, signed trust, EN/TR switching/persistence, and stack-free structured errors. Existing planner/installer tests independently prove staging approval and production hard block.

## 16. Real local acceptance

Real mode was exercised against current platform services with device alias `tv`, read-only only. The dashboard loaded three configured devices (`tv` reachable; `lgtv` and `emulator` unreachable), and inventory exposed `com.zui.player` 1.0.1, `youtube.leanback.v4` 0.8.3, and `com.zui.webos.youtube.staging` 0.8.4 with correct classifications. Two products, one staging release, one signed verified-cache entry, and one sanitized receipt were visible. Developer Mode reachability was reported while availability/expiry remained limited by the public CLI.

The known staging IPK was uploaded through the local API and inspected as 94,208 bytes with SHA-256 `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4`. A read-only same-version staging plan returned `REPOSITORY_PINNED_HASH`, `ALLOW_WITH_APPROVAL`, `STAGING_APP`, and `SAME_VERSION_REINSTALL`. It was not executed. No install, uninstall, launch, storage clear, or Developer Mode extension occurred.

## 17. Screenshots

Sanitized 1440×1000 evidence is stored in `docs/screenshots/web-manager/`:

- `dashboard.png`
- `device-detail.png`
- `catalog-release.png`
- `install-plan.png`

The captures contain aliases and public application/release metadata, but no IP address, credential, private key, passphrase, or private filesystem path.

## 18. CI/CodeQL

Local acceptance passed frozen install, format, lint, type-check, **68/68 tests**, build, `git diff --check`, targeted secret-pattern review, and `git fsck --full`. Final GitHub CI and CodeQL run URLs and results are recorded below after the normal push.

- CI: pending final push
- CodeQL: pending final push

## 19. Git commits

Implementation is split into normal reviewable commits for the local API, UI/design system, tests, and documentation/evidence. Pushes are normal non-force updates.

1. `0aa6376` — loopback Web Manager API, contracts, mock fixtures, and workspace tooling
2. `3897024` — React manager interface and shared ZUI design system
3. `31f0652` — API/UI contract, locale, trust, error, receipt, and plan-fixture tests
4. documentation, threat model, and screenshot evidence (this report commit)

## 20. Remaining risks

- Loopback is a network boundary, not per-OS-user authentication. Do not expose this server beyond loopback.
- Inspected upload copies persist under per-user app-local data; retention and user-controlled cleanup need a later design.
- Latest-plan display is process-memory only and intentionally not durable history.
- CSP currently permits inline Vite-built styles; future nonce/hash hardening can narrow it.
- The public webOS CLI does not provide a verified Developer Mode expiry timestamp.
- UI mutation remains intentionally absent; enabling it requires a separate threat review and explicit approval design.

## 21. Exact next milestone

Implement **Web Manager Approval-Gated Staging Install UX** only after a fresh security acceptance: per-user request authentication, upload retention/cleanup controls, durable inspection/plan records, stale-plan refresh, exact digest approval, post-install verification/receipt presentation, and real-TV staging acceptance. Production remains hard-blocked; uninstall, storage clear, signing-key management, Developer Mode extension, and network exposure remain out of scope.
