# ZUI webOS Platform Foundation Report

Date: 2026-10-02  
Decision: **PLATFORM_FOUNDATION_COMPLETE**  
Local: `C:\My_OS\LG-TV\ZUI_WebOS_Platform`  
GitHub: `https://github.com/ZUI-WebOS/ZUI-WebOS-Platform`  
Repository ID: `1400799435`  
Validated implementation baseline: `e22c081fbcbc1a95add1ebbcd5f498a2c4708e7c`

## 1. Existing scaffold audit

The non-Git scaffold contained a coherent product boundary, architecture notes, migration evidence, GitHub security evidence, naming conventions, reserved component directories, and a large ignored `.migration-rehearsal` evidence area. The scaffold was upgraded in place. No migration/security evidence or rehearsal data was deleted.

Fifteen protected files under `docs/github`, `docs/migration`, and `docs/development/NAMING_CONVENTIONS.md` retained aggregate SHA-256 `AC9A2AFDBB7A4A6A589636CCA83057E50F73DB2E0D7C44572BC5FF6F9A419093` before and after implementation. Placeholder `.gitkeep` files were classified as small reproducible roadmap markers and retained.

## 2. Final monorepo structure

The pnpm workspace now contains:

- `apps/devmode-keeper`: implemented CLI/orchestration;
- `apps/zui-webos-manager`, `apps/web-portal`, `apps/tv-store`: reserved future products;
- `packages/webos-client`: safe webOS CLI adapter/process layer;
- `packages/shared-types`: domain contracts and structured errors;
- `packages/catalog-contracts`: registry metadata contract/validator;
- `services/*`: reserved catalog, repository, and release services;
- `repository/apps/products.json`: source-free product registry;
- `docs`, `scripts`, `tests`, `infra`, and `.github`: repository support layers.

IPTV and YouTube remain independent repositories and are not vendored or submoduled.

## 3. Technology baseline

- Windows-first development;
- Node.js `>=22`;
- pnpm `11.5.0` workspace with frozen lockfile;
- strict TypeScript `5.9.x`;
- ESLint typed rules and scoped Prettier checks;
- Vitest `4.1.11`, selected at the first patched version for the observed path-traversal advisory;
- MIT license for newly authored platform code;
- only `esbuild` is permitted to run an install script.

## 4. DevMode Keeper architecture

The CLI, domain service, webOS adapter, and process runner are separated. Application logic does not embed shell strings. The adapter resolves the Windows webOS CLI Node entry points and spawns them with `shell: false`, explicit argument arrays, timeouts, captured output, and sanitized reporting.

The public CLI's inability to expose a supported expiry timestamp is explicit: command acceptance/post-connectivity and expiry verification are separate fields.

## 5. DevMode Keeper implementation

Implemented commands:

- `zui-webos devices list`
- `zui-webos devmode status --device <alias>`
- `zui-webos devmode extend --device <alias>`
- `zui-webos devmode ensure --device <alias>`
- `zui-webos doctor`
- `--dry-run` and `--json`

Config precedence is CLI, environment, local user config, defaults. Device aliases are allow-list validated. Structured errors include all required device, CLI, extension, verification, timeout, and input failure categories with deterministic exit codes. No background service/task was installed.

## 6. Tests

Fourteen unit tests pass. Coverage includes alias injection rejection, argv construction, device parsing/not-found, missing CLI, unreachable device, process timeout, successful extension parsing, non-zero/marker failures, post-verification failure, dry-run, package-runner delimiter handling, and registry validation.

## 7. Real-device smoke test

Read-only preflight discovered `lgtv`, default `tv`, and `emulator` without printing connection addresses. `tv` was reachable; doctor and dry-run passed.

The only TV mutation was the authorized official command equivalent to:

`ares-launch com.palmdts.devmode --params extend=true --device tv`

Result: exit `0`, exact Developer Mode launch marker observed, no timeout, and separate post-command connectivity PASS. `verified=true`; `expiryVerified=false` because the public CLI did not provide an expiry value. A final read-only inventory retained `com.zui.player`, `youtube.leanback.v4`, and `com.zui.webos.youtube.staging`. No product install, uninstall, launch, storage clear, root, or firmware operation occurred.

## 8. Product registry

The internal registry contains factual source-free metadata for:

- ZUI IPTV Player → `ZUI-WebOS/ZUI-IPTV-Player`, app ID `com.zui.player`;
- ZUI YouTube for webOS → `ZUI-WebOS/ZUI-YouTube-WebOS`, production `youtube.leanback.v4`, staging `com.zui.webos.youtube.staging`.

Both are marked rootless-compatible external product repositories using Developer Mode IPK deployment. Their source and licenses were not copied or changed.

## 9. Security model

Threat model and baseline cover malicious aliases, command injection, credential/log exposure, compromised artifacts, rogue registry entries, supply-chain dependencies, local privilege abuse, unsafe TV operations, false renewal claims, and process timeouts. Rooting, privilege escalation, private-service exploitation, firmware mutation, and protected-system-file mutation are explicitly out of scope.

## 10. Documentation

Created/updated architecture, repository model, DevMode Keeper, app lifecycle, threat model, security baseline, release process, license decision, scaffold audit, technical-debt registry, production README, and this report. Historical migration and GitHub evidence was preserved byte-for-byte locally.

## 11. Git initialization

The platform root was initialized as an independent Git repository on `main`. No workspace parent repo was created. With no global identity configured, the existing ZUI local identity was applied only to this repository; global Git config was not changed. `origin/main` tracking is active and `git fsck --full` passes.

## 12. GitHub repository creation

Created public `ZUI-WebOS/ZUI-WebOS-Platform` with description:

> Rootless management platform and developer tooling for ZUI applications on LG webOS TVs.

Repository ID is `1400799435`. Local history was pushed normally; no force push, remote-side README initialization, tag, release, or product-repository mutation occurred.

## 13. CI

Windows CI uses Node 22, frozen pnpm install, and `pnpm verify` for format, build-backed typed lint, type-check, 14 tests, and build. Actions are pinned to immutable current-runtime SHAs. The first clean-run exposed and led to repair of a build-before-lint ordering issue. The validated implementation run for `e22c081...` passed.

## 14. Dependabot / CodeQL

Dependabot is weekly, capped at five open PRs, groups low-risk development updates, and has no auto-merge. Four major-version PRs were opened and left unmerged. A Vitest advisory was fixed directly with the first patched `4.1.11`; open Dependabot security alerts returned to zero.

CodeQL v4 analyzes JavaScript/TypeScript on pushes, PRs, and a weekly schedule with only `contents: read` and `security-events: write`. The validated implementation run passed.

## 15. GitHub security

- secret scanning: enabled;
- push protection: enabled;
- vulnerability alerts: enabled;
- Dependabot security updates / automated fixes: enabled and not paused;
- `main` admin enforcement: enabled;
- force push: blocked;
- branch deletion: blocked;
- required PR reviews/status checks: not yet imposed, preventing sole-owner lockout during foundation.

No organization-wide security setting was changed.

## 16. Quality gates

Local final implementation gates:

- frozen install: PASS;
- format check: PASS;
- lint: PASS;
- strict type-check: PASS;
- tests: 14/14 PASS;
- build: PASS;
- `git fsck --full`: PASS;
- open GitHub security alerts: 0;
- GitHub CI: PASS;
- CodeQL v4: PASS.

## 17. Files/commits created

Foundation history through the validated implementation baseline:

- `83e0640` — architecture and preserved migration evidence;
- `9b74e75` — rootless DevMode Keeper foundation;
- `bd6cbc4` — pinned CI and security automation;
- `330c7cf` — portable line-ending policy;
- `f3d1990` — reproducible clean-checkout lint ordering;
- `d97b9de` — current GitHub Actions runtime baselines;
- `dfbf6ae` — Vitest advisory update;
- `e22c081` — normalized patched lockfile and accepted quality baseline.

This report is committed separately after recording those verified results.

## 18. Remaining risks

- Public webOS CLI provides no supported expiry timestamp, so threshold-based renewal cannot yet be evidence-driven; explicit `ensure` conservatively uses the official extension path.
- Four unmerged major-version Dependabot PRs require independent compatibility review; PR failure does not affect accepted `main`.
- No GUI, scheduler, cloud registry, installer, signing, or TV Store exists yet.
- GitHub action/runtime pin maintenance remains periodic supply-chain work.
- Developer Mode availability remains dependent on LG tooling, network reachability, and the TV's Developer Mode policy.

## 19. Exact next platform milestone

Build **Device Manager Core + Verified Package Inspector**: reuse `webos-client` for read-only device/app inventory, parse local IPK metadata, verify SHA-256 and registry provenance, and produce an explicit installation plan. Keep actual install/uninstall/storage operations behind a separate real-device acceptance gate; do not yet create a background scheduler or cloud service.

## Final decision

**PLATFORM_FOUNDATION_COMPLETE**
