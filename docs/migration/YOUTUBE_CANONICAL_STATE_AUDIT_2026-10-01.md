# YouTube webOS Canonical-State Audit — 2026-10-01

Scope: read-only audit of `C:\My_OS\Youtube-webos`; proposed future local target `C:\My_OS\LG-TV\ZUI_YouTube_WebOS`; proposed GitHub target `ZUI-WebOS/ZUI-YouTube-WebOS`.

Method: filesystem inspection, Git plumbing/status/comparison commands, SHA-256 hashing, and read-only GitHub REST/GraphQL queries. No checkout, fetch, pull, build, install, package, commit, stash, reset, clean, worktree repair, remote change, repository creation/transfer/rename, or push was performed. Credential and secret values are excluded.

## 1. Organization security closeout

Read-only re-verification found the requested hardened state intact:

- organization `ZUI-WebOS`, ID `336342662`;
- `two_factor_requirement_enabled=true`;
- `default_repository_permission=none`;
- repository-creation flags (general/public/private) `false`;
- `members_can_change_repo_visibility=false`;
- `members_can_delete_repositories=false`;
- `Simulate-X` is an active owner (`admin`);
- `ZUI-WebOS/ZUI-IPTV-Player` retains repository ID `1247455998`;
- secret scanning, push protection, vulnerability alerts, and Dependabot security updates are enabled;
- `main` force-push and deletion are blocked with admin enforcement.

No GitHub setting was mutated. The former 2FA, repository-visibility, and repository-deletion manual gates are **CLOSED / PASS**.

## 2. Local YouTube topology

The user-facing root `C:\My_OS\Youtube-webos` contains the actual project root `C:\My_OS\Youtube-webos\YTTR-webOS`. Neither outer directory is a Git repository. Two independent Git repositories and three linked worktrees were found:

| Absolute path | Git role | Branch / HEAD | Status | Tracking |
|---|---|---|---|---|
| `C:\My_OS\Youtube-webos\YTTR-webOS\upstream\webosbrew` | Independent shallow repository, primary worktree of its own Git dir | `main` / `f1b3b72926bb0cc312b5ceddc6a5b8c8ca081914` | clean | `origin/main`, `+0/-0` |
| `C:\My_OS\Youtube-webos\YTTR-webOS\upstream\nicholasbly` | Independent shallow repository and primary worktree for the common NicholasBly Git dir | `feature/turkish-auto-translate-poc` / `5f7aa18fa0829b4e0607475222d5adacd85c6eff` | dirty | no upstream configured for this branch |
| `C:\My_OS\Youtube-webos\YTTR-webOS\contrib\nicholasbly` | Linked worktree | `feature/translated-caption-target` / `954919a8b562ba3944084edbcdaeb12707d24cfe` | clean | `fork/feature/translated-caption-target`, `+0/-0` |
| `C:\My_OS\Youtube-webos\YTTR-webOS\work\patch-verify-20260906` | Linked worktree | detached / `5f7aa18fa0829b4e0607475222d5adacd85c6eff` | clean | none |
| `C:\My_OS\Youtube-webos\YTTR-webOS\work\stability-patch-verify` | Linked worktree | detached / `5f7aa18fa0829b4e0607475222d5adacd85c6eff` | clean | none |

The linked `.git` files are absolute pointers into the primary common Git directory:

- `contrib\nicholasbly\.git` → `C:/My_OS/Youtube-webos/YTTR-webOS/upstream/nicholasbly/.git/worktrees/nicholasbly`
- `work\patch-verify-20260906\.git` → `.../.git/worktrees/patch-verify-20260906`
- `work\stability-patch-verify\.git` → `.../.git/worktrees/stability-patch-verify`

Those pointers will break if folders are moved independently. The two actual `.git` directories are under `upstream\webosbrew` and `upstream\nicholasbly`; the other markers are pointer files.

Remotes:

| Repository | Remote | URL |
|---|---|---|
| webosbrew | `origin` | `https://github.com/webosbrew/youtube-webos.git` |
| NicholasBly common repo | `origin` | `https://github.com/NicholasBly/youtube-webos.git` |
| NicholasBly common repo | `fork` | `https://github.com/Simulate-X/youtube-webos.git` |

Both independent repositories are shallow. The webosbrew clone exposes only its `f1b3b72` tip locally; the NicholasBly clone's shallow boundary is `5f7aa18`. Local tag listings are therefore not authoritative. Important ignored areas in the NicholasBly primary worktree are `.husky/` and `node_modules/`. Latest locally available commits are `f1b3b72` for webosbrew, `5f7aa18` for the NicholasBly base, and `954919a` for the contribution branch.

## 3. GitHub repository topology

Read-only GitHub results:

| Repository | ID | Fork topology | Visibility / archived | Default HEAD | Branches / tags / releases | Issues / PRs | Latest release | Last pushed |
|---|---:|---|---|---|---|---|---|---|
| `webosbrew/youtube-webos` | `427904639` | fork of `FriedChickenButt/youtube-webos`; source same | public / no | `main` → `f1b3b729...` | 12 / 28 / 25 | 361 total, 74 open / 118 total, 9 open | `v0.5.3`, 2026-04-18 | 2026-07-19 |
| `NicholasBly/youtube-webos` | `990910034` | fork of `webosbrew/youtube-webos`; source `FriedChickenButt/youtube-webos` | public / no | `main` → `78a374a32774b92a2094e1cda8db4da0d83540d4` | 3 / 47 / 46 | 141 total, 38 open / 6 total, 1 open | `0.8.4`, 2026-09-29 | 2026-09-29 |
| `Simulate-X/youtube-webos` | `1359362456` | fork of `NicholasBly/youtube-webos`; source `FriedChickenButt/youtube-webos` | public / no | `main` → `5f7aa18fa0829b4e0607475222d5adacd85c6eff` | 4 / 46 / 0 | 0 / 0 | none | 2026-09-06 |

All three advertise `GPL-3.0`. The upstream descriptions are “YouTube app for webOS without ads”; only webosbrew has the `webos` topic. `Simulate-X/youtube-webos` is conclusively a real GitHub fork, not an unrelated repository: GitHub reports parent `NicholasBly/youtube-webos` and common source `FriedChickenButt/youtube-webos`. Its `main` SHA equals the primary worktree base, and its `feature/translated-caption-target` SHA equals the clean contribution worktree.

`ZUI-WebOS/ZUI-YouTube-WebOS` returned HTTP 404 and is not currently occupied. This proves name availability at audit time only; it is not a reservation. No create or transfer was attempted.

## 4. License and attribution

The inspected `LICENSE` files in webosbrew, NicholasBly, and the contribution worktree are byte-identical: SHA-256 `230184F60BAE2FEAF244F10A8BAC053C8FF33A183BCC365B4D8B876D2B7F4809`. `package.json` identifies `GPL-3.0-only`; the file is the GNU GPL version 3 text.

The license text requires, when conveying modified source, prominent modification notices and dates, retention of appropriate copyright/license/no-warranty notices, a copy of the GPL, and licensing the covered work as a whole under GPLv3. When object code/IPKs are conveyed, Corresponding Source must be supplied through a GPLv3-permitted method. The project also contains `src/spatial-navigation-polyfill.js`, which carries its own `Copyright (c) 2018-2019 LG Electronics Inc.` and MIT notice; that embedded notice must remain intact.

The inspected license text does not impose a repository-name restriction and therefore does not itself prohibit `ZUI-YouTube-WebOS`. It does not grant trademark or endorsement rights. The future repository should avoid implying affiliation with YouTube/Google, LG, webosbrew, or NicholasBly and should preserve the existing `LICENSE`, file-level notices, history, upstream links, and a clear modifications/attribution record. This is a source-text compliance audit, not legal advice.

## 5. Dirty primary analysis

Primary: `C:\My_OS\Youtube-webos\YTTR-webOS\upstream\nicholasbly`, branch `feature/turkish-auto-translate-poc`, base `5f7aa18...`.

Porcelain-v2 shows no deletions and no actual cached content diff. The two `.A` entries are intent-to-add: their index entries are the empty blob while substantive content remains in the worktree. Overall worktree source diff is 549 insertions and 2 deletions.

| Path | Git state | Approximate purpose | Uniqueness evidence |
|---|---|---|---|
| `src/auto-tr-controller.js` | `.A` intent-to-add | AUTO_TR controller: Turkish target selection, lifecycle retries/state, user-disabled handling and persistence | 10,306 bytes; SHA-256 `077E4531D7E78881232BB226E3F473ECDFA2882D1CDA2011CCB2C850FB3F3B40`; absent from base, contribution branch, and both verification worktrees |
| `src/turkish-captions-poc.js` | `.A` intent-to-add | inject translation target, wrap caption setting, persistent mode, trace/fallback, expose diagnostic `__YTTR_POC__` surface | 18,235 bytes; SHA-256 `53616795095758CDBAB3880FF3E5D9074EA18115C6A2F4E438CC9AA13F508CF7`; absent from all other inspected worktrees |
| `src/userScript.js` | `.M` worktree-only | imports the Turkish caption POC after polyfills | 2,208 bytes; SHA-256 `4BAD02F69D8A117FCF95ECD306330B41FA2195F01806AA4463780A066A2EFABF`; clean/base copies hash `6B3802981518C0FE2FDC9A8BA28933E7EFC84D14CB56521C677932DDD1EE7D88` |
| `webpack.config.js` | `.M` worktree-only | makes the module opt-in through `--env yttr` | 6,458 bytes; SHA-256 `845257FCB2064EAFA689397456FB0987CA49F7F09F1511CC2A9EBA42CC621B4E`; clean/base copies hash `44075748F87AD2E5E6822D9E890B5FB7E8C19ACC9518F4A452657ABB811FD3EF` |

These four source changes are unpublished and unique to the dirty primary worktree. Git also warned that LF content would be converted to CRLF on a future Git touch, so recovery must hash raw bytes before any normalization.

Untracked build/trace material:

| Path | Bytes | SHA-256 | Classification |
|---|---:|---|---|
| `artifacts/trace/youtube.leanback.v4_0.8.3_all.ipk` | 90,852 | `4D125DC2E8AB7128520F58DFC88E131F8674F73CD752C273CDB5F663C721513F` | trace package; preserve until provenance is reconciled |
| `work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/9262051282473701_youtube_leanback_preview.png` | 18,064 | `F8CEA3F8C7353E2592B19BA5326C6B314C8373CB9497C72EB97438B0CA4F31FF` | generated preview |
| `.../9262051307371701_youtube_leanback_splash.png` | 10,578 | `37D9B2D8E8C7310D163C1468E87BCF758715764A4ACBBBF579C5925C619F8ADF` | generated splash |
| `.../appinfo.json` | 1,481 | `34BDDD676BC07E9AF67AD24EE48B76D7CD3215BF85BDFF4B9865297BC35F3527` | package metadata |
| `.../icon.png` | 2,836 | `29C92DF4708B90206626C7F5175A33B627C0F96E090EB91EA26EC01A27E6876D` | package asset |
| `.../icon.svg` | 3,079 | `A3095DC3F4E5AC4DD764F71763C79D86F8B0BE1F73F53F3A793B916BDEB035ED` | package asset |
| `.../index.html` | 93 | `AABD5D8D89F40DF9EAEE6D994F6B8EB0B42A9B441AD9730E3D3BF2ADBE70C685` | generated entry point |
| `.../index.js` | 1,249 | `B2A2622392A673B5153CBA66D995A95DD6BB4079BA48D9702E634724974F64D4` | generated loader |
| `.../largeIcon.png` | 4,689 | `EAECC4D9B3595197C87E1CA02AF950161E05B46E3FDD5B7CB7B3F3E64AAE3EA5` | package asset |
| `.../webOSUserScripts/userScript.js` | 196,500 | `CADD84339CD6BEF7E59F476287516744A2B75439AA856696C39693027B8A573E` | generated bundle containing the experimental integration |

Historical local notes record additional accepted packages under outer `artifacts/`, including the TV-validated visibility-off build hash `B67288594D656C0FF923825F0D9B231981C3E65E86EA208C7A0ED785DFBB7B90`; that evidence is outside Git and should be preserved as audit/release provenance, not imported blindly into source history.

## 6. Branch comparison

- `feature/turkish-auto-translate-poc` has no unique commit relative to local `5f7aa18`; its value is entirely the dirty worktree described above.
- `feature/translated-caption-target` has merge-base `5f7aa18`, is one commit ahead (`954919a`, “Add reusable translated caption target helpers”), and changes only `src/translated-caption-target.js` and `bench/translated-caption-target-test.mjs` (+82 lines). It provides a generic, default-off target helper and deterministic tests, but no runtime lifecycle integration.
- `Simulate-X/youtube-webos:main` equals `5f7aa18` and is two commits behind current `NicholasBly/main`.
- Current `NicholasBly/main` is `78a374a`; the two new commits are `e0c70f3` (`0.8.4`) and `78a374a` (`Update repo.json for new release`). They include significant stability/feature changes across adblock, comments, launch, return-dislike, screensaver, spatial navigation, SponsorBlock, thumbnail/UI/userScript/video quality, plus version/build artifacts.
- Against current NicholasBly main, the translated-target branch is one commit ahead and two behind: a genuine divergence at merge-base `5f7aa18`.
- `webosbrew/main` and `NicholasBly/main` diverge at `f0a7f71f822f52afdbb5287367ee55deb050fe73`; the GitHub comparison reports NicholasBly 242 commits ahead and 105 behind. They are materially different product lines, not interchangeable tips.

Feature conclusion: NicholasBly is the active 0.8.x webOS line and contains the newer stability/application work. The clean contribution branch contains the reusable caption-target helper. The complete AUTO_TR/persistent-OFF/lifecycle behavior exists only as unpublished dirty primary content. No single existing clean branch contains all three.

## 7. Verification worktrees

Both detached worktrees are clean, share the NicholasBly common Git directory, and point exactly to the pre-feature base `5f7aa18`. Neither contains the four dirty primary source changes. Their names, detached/clean state, identical base, and local stability/contribution notes support the conclusion that they were isolated verification copies rather than independent development lines.

| Worktree | Classification | Reason |
|---|---|---|
| `work\patch-verify-20260906` | `RECREATE_LATER` | clean, detached, no unique commit/content; reproducible after canonical recovery |
| `work\stability-patch-verify` | `RECREATE_LATER` | clean, detached, no unique commit/content; reproducible after canonical recovery |
| `contrib\nicholasbly` | `KEEP` | clean published feature commit and branch relationship must be retained |

No worktree was removed or repaired.

## 8. Build-system analysis

| Candidate line | Package manager / lockfile | Node contract | Build / tests / lint | webOS package metadata | Existing outputs / feasibility |
|---|---|---|---|---|---|
| webosbrew 0.5.3 | pnpm 10.33.0 pinned in `packageManager`; `pnpm-lock.yaml` | no `engines.node` field in inspected `package.json`; therefore Node >=22 is **not** confirmed from that manifest | `pnpm build`; `test:compat`; `lint:eslint`, `lint:tsc`, `lint:prettier`, aggregate `lint:all` | `assets/appinfo.json`, ID `youtube.leanback.v4`, title `YouTube AdFree`; packaging `ares-package -n dist` | local clone clean/shallow; no audit build run |
| NicholasBly 0.8.3 family | npm; `package-lock.json` | `>=22` | `npm run build`; no general `test` script; `lint`, `type-check`, `prettier-check`; variants modern/perf | `assets/appinfo.json`, ID `youtube.leanback.v4`, version `0.8.3`; packaging `ares-package -n dist -o dist` | installed `node_modules` exists in primary; tracked `dist` IPKs exist; build writes `dist` and could alter state |

Host tools are Node `v24.18.0`, npm `11.16.0`, pnpm `11.5.0`. They satisfy NicholasBly's Node constraint, but the host pnpm version does not equal webosbrew's pinned pnpm 10.33.0. No dependency install or package-manager normalization occurred.

Builds were deliberately not run: both build/package flows write output into the active checkout (`dist`), NicholasBly already tracks IPKs in that directory, and the primary contains irreplaceable dirty/untracked state. Feasibility is plausible from installed dependencies, existing outputs, scripts, and historical test/build records, but current-source build reproducibility remains unverified in this audit.

## 9. Canonical candidate matrix

| Candidate | Current HEAD | State | Unique ZUI / Turkish / captions | Stability / build confidence | Upstream / history / license | Unpublished local changes | Migration complexity |
|---|---|---|---|---|---|---|---|
| A. webosbrew upstream | `f1b3b72` | clean, shallow | none found | older 0.5.3 line; scripts present, not run | original middle fork line; GPL-3.0-only; strong public history | none | high because 0.8.x and ZUI work would need porting |
| B. NicholasBly current main | `78a374a` | remote clean; local tip not fetched | no ZUI translation work; newest 0.8.4 stability/application changes | highest current upstream confidence; 46 releases | active parent of Simulate-X; GPL-3.0-only | none in remote | medium: integrate ZUI branches after recovery |
| C. Turkish AUTO_TR primary | base `5f7aa18` | dirty | complete unique local AUTO_TR/lifecycle/persistent-OFF integration | historically tested/built; current tree not rebuilt; two upstream commits behind | same NicholasBly history; GPL-3.0-only | **yes: 4 source files + 10 artifact/build files** | highest risk until preserved; then core ZUI payload |
| D. translated-target branch | `954919a` | clean | generic caption-target helper/tests; no runtime wiring | scoped tests/build historically passed | published Simulate-X fork branch; one clean commit | no | low; must reconcile with current upstream and C |
| E. Simulate-X fork main | `5f7aa18` | remote clean | none on main; D exists as branch | known 0.8.3 base; two commits behind | real fork, history/fork relation preserved; GPL-3.0-only | dirty C exists only locally | low for transfer, but unsafe before C recovery |
| F. detached verification worktrees | `5f7aa18` | clean/detached | none | historical verification copies only | shared history, no independent lineage | none | do not migrate as canonical; recreate later |

## 10. Recommended canonical base

Recommended lineage: use the existing `Simulate-X/youtube-webos` fork as the repository identity to preserve Git history and fork-network provenance, but do **not** treat its stale `main` as feature-complete. The future canonical content should be built by first recovering the dirty `feature/turkish-auto-translate-poc` work exactly, retaining the clean `feature/translated-caption-target` commit, then reconciling both with current `NicholasBly/main` (`78a374a`, 0.8.4) in a separate authorized implementation task.

Required gates before any move/transfer:

1. hash-manifest and byte-preserve all dirty/untracked primary material;
2. create a recovery bundle/clone that contains all reachable refs;
3. convert the dirty four-file source payload into reviewed commits without line-ending drift;
4. keep `feature/translated-caption-target` and verify its published SHA;
5. reconcile against 0.8.4 with tests/build/TV acceptance, rather than silently overwriting upstream changes;
6. only then transfer the existing fork to `ZUI-WebOS` and rename it, if GitHub's preflight permits.

Transfer is technically plausible because the source is a genuine public fork, `Simulate-X` is the active owner of the target organization, and the target name is currently absent. Final eligibility remains a live GitHub gate: organization fork policy, namespace collision, permissions, and fork-network transfer rules must be rechecked immediately before transfer. A brand-new unrelated repository is the fallback, not the preferred path, because it would lose native fork provenance unless history/remotes are reconstructed carefully.

## 11. Proposed remote model

After a successful transfer/rename, proposed names are:

```text
origin    https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS.git
upstream  https://github.com/NicholasBly/youtube-webos.git
webosbrew https://github.com/webosbrew/youtube-webos.git
source    https://github.com/FriedChickenButt/youtube-webos.git   # optional provenance-only remote
```

`origin` would be the writable canonical repository; `upstream` the active 0.8.x integration source; `webosbrew` the older diverged upstream line; optional `source` documents the fork-network root. No remote was changed in this task.

## 12. Recovery/migration strategy

The detailed executable sequence is in `YOUTUBE_SAFE_MIGRATION_PLAN.md`. Core controls are: capture a pre-migration SHA-256 manifest and all Git refs/status; create and verify Git bundles plus an external copy of untracked data; preserve dirty bytes before any Git normalization; avoid moving absolute-pointer worktrees; establish the canonical clone at `C:\My_OS\LG-TV\ZUI_YouTube_WebOS`; recreate verification worktrees from commits after the primary clone is healthy; verify refs/remotes/status/build/package hashes; retain the original tree untouched until acceptance; and keep a tested rollback route.

## 13. Files created/changed

Only documentation under `C:\My_OS\LG-TV\ZUI_WebOS_Platform` was intentionally changed:

- `docs\github\ORGANIZATION_SECURITY_AUDIT_2026-10-01.md`
- `docs\github\ORGANIZATION_SECURITY_BASELINE.md`
- `docs\migration\YOUTUBE_CANONICAL_STATE_AUDIT_2026-10-01.md`
- `docs\migration\YOUTUBE_SAFE_MIGRATION_PLAN.md`

The platform scaffold is not a Git repository, and no `git init` was run. No YouTube or IPTV source/Git file was modified.

## 14. Unresolved risks

- The unique AUTO_TR work is not committed and can be lost by reset/clean/move or line-ending conversion.
- Local NicholasBly history is shallow and stale by two upstream commits; a future recovery task must deepen/fetch only after dirty bytes are independently secured.
- The 0.8.4 delta touches `src/userScript.js` and many stability modules, so conflict-free integration cannot be assumed.
- Current build reproducibility was not exercised because it would write into the working tree.
- Transfer eligibility and target-name availability can change after this audit.
- Existing tracked IPKs and external/local artifacts require a deliberate source/provenance policy under GPLv3.
- One organization owner remains a continuity risk; Actions allowlisting, CodeQL, and private vulnerability reporting remain optional defense-in-depth work.

## 15. Exact recommended next action

Run a separate, explicitly authorized **recovery-only** task on `C:\My_OS\Youtube-webos\YTTR-webOS\upstream\nicholasbly`: create an external hash manifest and Git bundle/copy of every dirty and untracked item, verify restoration into a disposable location, then commit the four unique source changes on a dedicated recovery branch without changing their bytes. Do not move the workspace or transfer the GitHub repository until that recovery proof passes.

Final status: **DONE_WITH_CONCERNS** — the read-only audit and decision are complete; the concerns are the intentionally untouched unpublished dirty state, shallow/stale local history, and deferred build/TV/transfer gates.
