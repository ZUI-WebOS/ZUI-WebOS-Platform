# ZUI YouTube 0.8.4 Integration Report

Date: 2026-10-01  
Milestone: consolidation and transfer preparation  
Production-TV operations: none

## 1. Upstream refresh

- Source checkout: `C:\My_OS\Youtube-webos\YTTR-webOS\upstream\nicholasbly`.
- The repository was safely unshallowed and tags were fetched from `NicholasBly/youtube-webos`.
- Current upstream `main`: `78a374a32774b92a2094e1cda8db4da0d83540d4`.
- This exactly matches the previously audited 0.8.4 tip; delta from the audited tip is zero commits.
- Recovery branch remained `cd9964db1d560da85350773db89b78768414d4d9`; contribution branch remained `954919a8b562ba3944084edbcdaeb12707d24cfe`.

## 2. Integration branch

- Branch: `integration/zui-youtube-webos`.
- Base: current `origin/main` at `78a374a32774b92a2094e1cda8db4da0d83540d4`.
- Final integration SHA: `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`.
- Integration commits, oldest first:
  1. `a4ad299c1009e8f12d37213e62fd13e62a75c0e0` — translated-caption target helper and tests;
  2. `bd57a982006c49eb541f2ac87b45a04aea7ec0cd` — Turkish AUTO_TR controller and POC;
  3. `b6ec4b8f908c2612e6afef4aeeeabc6ba066e266` — AUTO_TR integration wiring;
  4. `45f0501396e6014df446635aaa02fe7b0a229549` — isolated staging build and reproducible integration tests;
  5. `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2` — restored native TypeScript validation.

## 3. Contribution integration

Commit `954919a8b562ba3944084edbcdaeb12707d24cfe` cherry-picked cleanly as `a4ad299...`. Both `src/translated-caption-target.js` and `bench/translated-caption-target-test.mjs` were retained. The contribution source and recovery source remain on their original branches unchanged.

## 4. Recovery integration

- `f9e346254994e0c4d0bc195b61b70819aece6f9c` cherry-picked cleanly as `bd57a98...`.
- `cd9964db1d560da85350773db89b78768414d4d9` was integrated as `b6ec4b8...` after one explicit conflict resolution.
- The committed Git blobs for `src/auto-tr-controller.js` and `src/turkish-captions-poc.js` exactly match the recovery branch: `a245f0d...` and `58f4e65...` respectively.
- Recovery history and the off-device recovery branch were not rebased, rewritten, deleted, or force-updated.

## 5. Conflict resolutions

Only `src/userScript.js` conflicted. `webpack.config.js` merged automatically.

The final `userScript.js` keeps the complete upstream 0.8.4 import/lifecycle structure, including `comments-fix`, launch handling, Extended UI and SponsorBlock. It adds the YTTR module immediately after the base/polyfill hooks and before Extended's optional caption-related hooks. No whole-file `ours`/`theirs` selection was used.

## 6. Staging app-ID isolation

- The source production manifest remains `youtube.leanback.v4`, title `YouTube AdFree`.
- `npm run build:zui:production` builds the YTTR-enabled production candidate.
- `npm run build:zui:staging` applies a build-time-only manifest transformation.
- Staging app ID: `com.zui.webos.youtube.staging`.
- Staging title: `ZUI YouTube STAGING`.
- The default production `assets/appinfo.json` is not replaced or edited by staging builds.

This makes a staging package technically unable to overwrite the production app ID.

## 7. Tests and static checks

- `npm ci --ignore-scripts`: PASS using the existing lockfile; no dependency upgrade or audit fix was performed.
- `npm run test:zui`: PASS, 19/19 tests.
  - 3 translated-caption target tests;
  - 16 AUTO_TR/lifecycle/persistent-OFF tests.
- Changed/integration JavaScript scoped ESLint: PASS with zero errors.
- `npm run type-check`: PASS after restoring the two historical tsconfig files that were accidentally omitted by the upstream 0.8.3 resync and adding type-only annotations/casts.
- Production webpack build: PASS.
- Staging webpack build: PASS.
- High-confidence token/private-key scan across the integration diff: no matches.

The repository-wide `npm run lint` remains red with 831 pre-existing upstream errors outside the integration scope. Repository-wide Prettier check also reports 100 pre-existing files. These were not bulk-fixed because doing so would create a large unrelated rewrite. `npm ci` reports 47 dependency advisories (8 low, 8 moderate, 27 high, 4 critical); no broad upgrade was authorized.

## 8. Build and package results

Both final builds use version `0.8.4` and contain the expected YTTR, `AUTO_TR`, `USER_DISABLED`, `yttr.caption.preference`, Extended `ytaf-configuration`, and SponsorBlock markers. No package was installed.

| Kind | App ID | IPK bytes | IPK SHA-256 | Bundle bytes | Bundle SHA-256 |
|---|---|---:|---|---:|---|
| Production candidate | `youtube.leanback.v4` | 94,188 | `9702EC57B69CB145EF7919DB2F79BA7FD3714F3D000E6A04C5F638F9F7817F3E` | 207,058 | `81069D4BA54875AD2819A3B6D811A34F90A69A9481222A92FFAC8D044A834628` |
| Staging | `com.zui.webos.youtube.staging` | 94,208 | `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4` | 207,058 | `81069D4BA54875AD2819A3B6D811A34F90A69A9481222A92FFAC8D044A834628` |

Output roots:

- `artifacts\integration-0.8.4\production`
- `artifacts\integration-0.8.4\staging`

These rehearsal outputs are separated from and do not overwrite the accepted historical production IPK.

## 9. Production regression comparison

The accepted 0.8.3 production package (`B6728859...`) and runtime bundle (`9096727E...`) are not expected to be byte-identical to the integrated 0.8.4 candidate. Structural comparison confirms:

- YTTR runtime and Turkish target path are present;
- `AUTO_TR`, explicit `OFF`, `USER_DISABLED`, version-2 persistence and target language `tr` remain present;
- Extended configuration and SponsorBlock remain in the final bundle;
- upstream 0.8.4 launch/runtime imports, including `comments-fix`, were retained;
- no duplicate `turkish-captions-poc.js` import or duplicate registration was introduced.

This is build/static/deterministic-test evidence, not a new real-TV acceptance.

## 10. Integration branch push

The branch was pushed once, normally and non-force, using the exact mapping:

`refs/heads/integration/zui-youtube-webos:refs/heads/integration/zui-youtube-webos`

Remote SHA: `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`. No PR, tag, release, force push, `main` push, recovery update, or contribution update was performed.

## 11. Canonical local clone

Clean candidate: `C:\My_OS\LG-TV\ZUI_YouTube_WebOS`.

- Branch/HEAD: `integration/zui-youtube-webos` / `ab05d0d...`.
- Full history: yes (`is-shallow-repository=false`), 499 reachable commits, 46 tags.
- Git structure: ordinary standalone `.git` directory; no linked-worktree pointer.
- Status: clean and tracking `origin/integration/zui-youtube-webos`.
- Remotes:
  - `origin`: `https://github.com/Simulate-X/youtube-webos.git`
  - `upstream`: `https://github.com/NicholasBly/youtube-webos.git`
  - `webosbrew`: `https://github.com/webosbrew/youtube-webos.git`
  - `source`: `https://github.com/FriedChickenButt/youtube-webos.git`

## 12. GitHub transfer readiness

- Source repository remains `Simulate-X/youtube-webos`, ID `1359362456`, public, non-archived, and a fork.
- Parent remains `NicholasBly/youtube-webos`; source remains `FriedChickenButt/youtube-webos`.
- Authenticated viewer `Simulate-X` can administer `ZUI-WebOS` and create repositories there.
- `ZUI-WebOS/youtube-webos` and `ZUI-WebOS/ZUI-YouTube-WebOS` both return 404; the organization contains no fork from this network.
- GitHub documentation states that a transferred fork remains associated with its upstream repository and requires create-repository permission in the target organization.
- Transfer/rename was not executed. Repository settings, security controls and IPTV were not mutated.

## 13. Remaining risks

- Full-repository ESLint/Prettier debt and 47 dependency advisories remain upstream/inherited maintenance work.
- The integrated 0.8.4 package has not been installed or validated on a TV; this was explicitly outside scope.
- Transfer still requires an explicit, separately authorized GitHub ownership operation and post-transfer settings verification.
- The rehearsal worktree contains untracked build/artifact outputs by design; the canonical clone is clean.
- The old recovery workspace remains the recovery authority until transfer and retention acceptance are complete.

## 14. Exact next action

After reviewing this report, explicitly authorize a dedicated GitHub transfer-and-rename task: transfer repository ID `1359362456` from `Simulate-X` to `ZUI-WebOS`, rename it to `ZUI-YouTube-WebOS`, update the canonical clone's `origin`, and perform a read-only post-transfer identity/fork/security verification. Do not delete the old recovery workspace or install either package during that task.

Milestone status: **DONE_WITH_CONCERNS** — integration, deterministic tests, native type-check, production/staging builds, package isolation, branch push, and canonical clone are complete; repository-wide lint debt, dependency advisories, TV validation, and the actual GitHub transfer remain open.
