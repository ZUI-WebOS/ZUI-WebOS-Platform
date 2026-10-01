# YouTube webOS Safe Migration Plan

Prepared: 2026-10-01  
Status: **FINAL MIGRATION COMPLETE** on 2026-10-01; Gates 0–8 and real-TV staging acceptance passed  
Source workspace: `C:\My_OS\Youtube-webos\YTTR-webOS`  
Future canonical path: `C:\My_OS\LG-TV\ZUI_YouTube_WebOS`  
Preferred future GitHub identity: existing fork `Simulate-X/youtube-webos` transferred/renamed to `ZUI-WebOS/ZUI-YouTube-WebOS`

This plan is intentionally split into gated phases. A failed gate stops the migration; it does not authorize reset, clean, overwrite, pointer repair, or deletion.

## Recovery Completed — 2026-10-01

The original recovery/preservation phase was completed without moving the workspace, fetching/deepening, reconciling 0.8.4, building, deploying, pushing, or mutating GitHub/TV/IPTV. The later separately authorized off-device backup is recorded below.

- Four original dirty source files were copied byte-for-byte to `C:\My_OS\LG-TV\_Archive\ZUI_YouTube_WebOS\Recovery_2026-10-01\raw-dirty-source` and verified against the audit hashes.
- Ten untracked trace/build provenance files were copied to `raw-untracked` with zero manifest mismatches.
- The TV-accepted `visibility-off-fix` IPK was preserved under `production-validated\visibility-off-fix`; SHA-256 remained `B67288594D656C0FF923825F0D9B231981C3E65E86EA208C7A0ED785DFBB7B90`.
- Pre- and post-recovery Git bundles were verified. Direct clone from the shallow bundle was not self-sufficient because the boundary commit references an unavailable parent; independent shallow-aware `--mirror --no-hardlinks` clones were therefore created and successfully cloned/restored.
- Disposable restore verification completed with mismatch count `0`; the verification area was retained.
- Local branch `recovery/zui-turkish-auto-tr-20261001` was created from exact base `5f7aa18fa0829b4e0607475222d5adacd85c6eff`.
- Recovery commits are `f9e346254994e0c4d0bc195b61b70819aece6f9c` and `cd9964db1d560da85350773db89b78768414d4d9`.
- Base-to-HEAD changes are exactly the four intended source paths, 549 insertions and 2 deletions.
- At recovery completion the branch remained local and unpushed. Its later off-device backup changed only that preservation state; Gates 4–8 remain pending and require separate authorization.

Detailed evidence: `docs\migration\youtube-recovery\YOUTUBE_RECOVERY_REPORT_2026-10-01.md`.

## Recovery Review: PASS — 2026-10-01

An independent read-only review accepted the recovery evidence:

- exact non-merge graph `5f7aa18...` → `f9e3462...` → `cd9964d...`;
- exactly four intended changed paths and no unrelated commit content;
- raw/archive/working-byte hashes matched, with the two documented LF-canonical committed blobs semantically identical to normalized raw content;
- all 21 manifest entries recalculated with zero mismatches;
- standalone shallow mirror and restored clone passed `git fsck --full`, exposed the recovery branch, and restored exactly four paths;
- production IPK hash, contribution branch SHA/clean state, and GitHub fork refs matched the recorded baseline;
- at review time, the recovery branch remained absent from GitHub and no push had occurred;
- high-confidence credential/private-key and credential-assignment scans found no matches.

Decision: **RECOVERY_ACCEPTED**. This accepts preservation and recovery integrity only; it does not authorize push, fetch/deepen, 0.8.4 reconciliation, build/package, app-ID change, TV install, migration, transfer, or rename.

Review evidence: `docs\migration\youtube-recovery\YOUTUBE_RECOVERY_REVIEW_2026-10-01.md`.

## Gate 0 — authority and freeze

- Obtain explicit authorization for recovery writes, commits, remote fetches, repository transfer, rename, and target-directory creation. Authorization to audit does not cover these actions.
- Freeze application development and TV packaging during the capture window.
- Reconfirm the exact five Git/worktree statuses and the IPTV repository status.
- Record organization/repository IDs and target-name availability again.
- Keep `C:\My_OS\Youtube-webos\YTTR-webOS` as the immutable rollback source until final acceptance.

Pass condition: a written scope names every permitted mutation and the start-state snapshot exactly matches the 2026-10-01 audit or differences have been reviewed.

## Gate 1 — pre-migration evidence manifest

Create the manifest outside every audited Git worktree. Include:

- absolute path, byte size, last-write time, and SHA-256 for all dirty/untracked files;
- raw `git status --porcelain=v2 --branch --untracked-files=all` for each worktree;
- `git diff --binary`, `git diff --cached --binary`, intent-to-add/index state, and `git ls-files --stage` evidence;
- `git show-ref`, branch/upstream configuration, remotes, tags, shallow boundaries, `git worktree list --porcelain`, and common-dir paths;
- hashes for `LICENSE`, lockfiles, `package.json`, `assets/appinfo.json`, existing IPKs, and historically accepted artifacts;
- GitHub repository IDs, fork parent/source, default-branch SHAs, branches/tags/releases, and organization hardening flags.

Special rule: copy and hash raw bytes before any `git add`, formatter, checkout, build, or editor action because Git warned about future LF→CRLF conversion.

Pass condition: a second hash run matches the first and the manifest contains no credential/token/private key values.

## Gate 2 — recoverability package

Create two independent recovery layers:

1. a Git bundle (or verified mirror clone) containing every reachable branch/tag/ref in both independent repositories;
2. a byte-preserving archive/copy of dirty, untracked, ignored-but-required, notes, captures, and artifacts that Git cannot represent.

Because both local repositories are shallow, first bundle the exact currently available graph. Do not assume it is a complete upstream backup. After dirty bytes are secured, an authorized later step may fetch/deepen and create a second complete bundle.

Verification must occur in a disposable destination outside the source and future canonical paths:

- clone/list the bundle;
- restore the non-Git payload;
- compare SHA-256 hashes;
- prove the four unique source files and all ten primary untracked items are present;
- prove `954919a` and all required branch tips resolve.

Pass condition: restoration is complete and byte-identical. A bundle that omits dirty/untracked content is not sufficient.

## Gate 3 — preserve unpublished source in Git

On an explicitly authorized recovery branch based on `5f7aa18`:

- preserve `src/auto-tr-controller.js`, `src/turkish-captions-poc.js`, `src/userScript.js`, and `webpack.config.js` exactly;
- distinguish source commits from generated trace/IPK material;
- verify pre/post-commit file hashes and inspect the commit diff;
- ensure no notes, captures, device details, tokens, cookies, signed caption URLs, or generated work directories enter public history;
- retain the clean `feature/translated-caption-target` commit `954919a` separately until integration strategy is reviewed.

Recommended commit structure:

1. generic translated-caption target/helper and tests (existing `954919a`);
2. runtime lifecycle/controller integration;
3. persistent caption visibility preference and targeted regression tests;
4. build opt-in wiring, if it remains necessary.

Pass condition: a clean recovery branch reproduces the audited source hashes or any intentional normalization is explicitly reviewed with a semantic diff and test evidence.

## Gate 4 — reconcile with active upstream

- Fetch/deepen only after Gates 1–3 prove recoverability.
- Reconfirm current `NicholasBly/main`; audit snapshot was `78a374a` (0.8.4), two commits ahead of the local base.
- Integrate through a reviewable merge/rebase/cherry-pick strategy chosen in that task; do not overwrite current upstream modules.
- Pay special attention to 0.8.4 changes in `src/userScript.js`, spatial navigation, SponsorBlock, UI, launch, adblock, thumbnail/video quality, and packaging/version files.
- Keep `webosbrew/main` as a reference remote; do not attempt to merge its 105/242-commit divergence wholesale without a separate product decision.

Pass condition: commit graph and conflict resolutions are reviewed; generic helper, runtime lifecycle, and persistent-OFF behavior all remain represented.

## Gate 5 — build and behavior verification

Use a disposable clean clone or isolated worktree, never the irreplaceable dirty source. Do not normalize lockfiles or install with a different package manager without approval.

Minimum checks for the NicholasBly-derived candidate:

- Node version satisfies `>=22`;
- exact `package-lock.json` is honored;
- lint, type-check, formatting check, and caption-target/controller regression tests pass;
- production and relevant modern/yttr build variants pass;
- `ares-package` produces expected application ID `youtube.leanback.v4` and intended version;
- artifact SHA-256, size, appinfo, and source commit are recorded;
- real-TV acceptance covers AUTO_TR selection, lifecycle reset recovery, manual language selection, explicit OFF across video changes/restart, explicit ON recovery, and failure fallback.

Pass condition: deterministic build evidence and real-TV acceptance are both recorded. Simulator/build-only success is insufficient for the caption lifecycle behavior.

## Gate 6 — GitHub transfer/create decision

Preferred path: transfer the existing real fork `Simulate-X/youtube-webos` to `ZUI-WebOS`, then rename it to `ZUI-YouTube-WebOS`. This preserves repository identity, history, branches, and native fork-network attribution.

Immediately before transfer verify:

- source repository ID remains `1359362456`;
- target organization ownership and policy permit the transfer/fork;
- `ZUI-WebOS/ZUI-YouTube-WebOS` remains absent;
- required branches and tags are pushed and protected by recovery evidence;
- releases/issues/settings/security features are inventoried;
- transfer effects on fork parent, Actions, secrets, Pages, branch protection, scanning, and visibility are understood.

Fallback: create a new organization repository only if GitHub rejects transfer or product/legal policy requires independence. If fallback is used, push preserved history rather than a source-only snapshot, document all upstream remotes/attribution, and explicitly record loss of native fork-network identity.

Pass condition: repository numeric identity/fork topology after the operation matches the chosen strategy, and no visibility/security regression remains unreviewed.

## Gate 7 — local canonical path and worktrees

- Create a fresh verified clone at `C:\My_OS\LG-TV\ZUI_YouTube_WebOS`; do not move the current primary directory in place.
- Configure the proposed remote model only after the GitHub identity is final:

```text
origin    https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS.git
upstream  https://github.com/NicholasBly/youtube-webos.git
webosbrew https://github.com/webosbrew/youtube-webos.git
source    https://github.com/FriedChickenButt/youtube-webos.git   # optional
```

- Recreate needed worktrees from branch/commit refs under the new common Git directory. Do not copy linked `.git` pointer files.
- Recreate verification worktrees only when needed; `patch-verify-20260906` and `stability-patch-verify` carry no unique state.
- Keep the contribution branch as a normal branch/worktree until its integration/publication decision is complete.

Pass condition: every `.git` pointer resolves inside the new canonical common Git directory, `git worktree list` has no stale entries, and all expected refs/hashes resolve.

## Gate 8 — post-migration verification

Verify and record:

- canonical absolute path and Git common-dir;
- repository numeric ID, fork parent/source, visibility, default branch, and HEAD;
- branch/tag counts and required SHAs;
- remotes and upstream tracking;
- clean status in canonical and recreated worktrees;
- byte hashes for recovered source and selected artifacts;
- GPL/attribution files and embedded MIT notice;
- build, package, and real-TV test evidence;
- organization 2FA/least-privilege flags and repository security/branch-protection settings;
- unchanged `C:\My_OS\LG-TV\ZUI_IPTV_Player` status.

Pass condition: all checks match the approved target manifest. Any mismatch keeps the migration incomplete.

## Rollback

If any gate fails:

1. stop; do not clean/reset or repair pointers in place;
2. leave the original `C:\My_OS\Youtube-webos\YTTR-webOS` untouched;
3. preserve logs and the failed target for diagnosis;
4. restore from the verified bundle plus non-Git recovery payload into a new disposable path;
5. if a GitHub transfer already occurred, use the documented repository ID/settings inventory and an explicitly authorized reverse-transfer or remote retarget—not a new ad-hoc repository;
6. re-run hashes, refs, statuses, and build/TV gates before declaring rollback complete.

Do not delete the old workspace or recovery packages until the new canonical path, GitHub identity, build, and TV behavior have been accepted and a retention period has elapsed.

## Recovery off-device backup: PASS

On 2026-10-01, the accepted local recovery branch was backed up to the existing `Simulate-X/youtube-webos` fork using one non-force push with the exact full-ref mapping `refs/heads/recovery/zui-turkish-auto-tr-20261001:refs/heads/recovery/zui-turkish-auto-tr-20261001`.

- Remote recovery SHA: `cd9964db1d560da85350773db89b78768414d4d9`.
- GitHub `pushed_at`: `2026-10-01T15:09:14Z` (`2026-10-01T18:09:14+03:00`, Europe/Istanbul).
- Remote `main` remains `5f7aa18fa0829b4e0607475222d5adacd85c6eff`.
- Remote `feature/translated-caption-target` remains `954919a8b562ba3944084edbcdaeb12707d24cfe`.
- The remote branch is exactly two commits ahead of the recovery base, with only the four audited source/config paths.
- No force push, upstream/tracking configuration, PR, tag, release, repository transfer, rename, or settings change was performed.
- Repository identity remains ID `1359362456`, public, non-archived, a fork, with default branch `main`; the 46-tag and zero-release inventory is unchanged.

This pass closes only the off-device backup gate. All later reconciliation, isolated build/test, app-ID separation, real-TV validation, and organization migration gates remain subject to separate authorization and acceptance.

## Consolidation milestone — 2026-10-01

- **Gate 4 upstream reconciliation: PASS.** Current NicholasBly `main` remained the audited 0.8.4 SHA `78a374a...`; contribution and recovery work were integrated into `integration/zui-youtube-webos` without rewriting their source branches.
- **Gate 5 deterministic build/test portion: PASS.** ZUI tests passed 19/19, scoped integration lint passed, native `npm run type-check` passed, and both production and staging builds/packages passed. The real-TV portion remains intentionally pending because this milestone prohibited TV operations.
- **Staging isolation: PASS.** Production remains `youtube.leanback.v4`; staging is `com.zui.webos.youtube.staging` with title `ZUI YouTube STAGING` through a build-time-only manifest transform.
- **Gate 6 transfer readiness: PASS; transfer not executed.** Repository ID `1359362456`, fork topology, target-name availability and organization create/admin authority were verified. Manual ownership transfer, rename and post-transfer security verification remain pending.
- **Gate 7 canonical clone candidate: PASS.** `C:\My_OS\LG-TV\ZUI_YouTube_WebOS` is a clean full-history clone at `ab05d0d...`, tracking the pushed integration branch with the pre-transfer four-remote model.
- **Gate 8 final migration acceptance: PENDING.** The GitHub transfer/rename, canonical-origin retarget, post-transfer settings inventory and any separately authorized staging/TV validation have not occurred.

Detailed evidence: `docs\migration\YOUTUBE_INTEGRATION_0_8_4_REPORT.md`.

## Final migration completion — 2026-10-01

- **Gate 4: PASS.** NicholasBly 0.8.4, the translated-caption contribution and the recovery work were reconciled at integration SHA `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`.
- **Gate 5: PASS.** Tests/build/package checks passed, and the isolated staging package passed real-TV playback and Turkish AUTO_TR caption acceptance.
- **Gate 6: PASS.** GitHub's official transfer and rename preserved repository ID `1359362456`, public visibility, parent `NicholasBly/youtube-webos`, source `FriedChickenButt/youtube-webos`, all original refs, 46 tags and zero releases. Final identity is `ZUI-WebOS/ZUI-YouTube-WebOS`.
- **Gate 7: PASS.** `C:\My_OS\LG-TV\ZUI_YouTube_WebOS` is the clean canonical clone on `main`, tracking `origin/main`, with the four approved remotes and no worktree-pointer problem.
- **Gate 8: PASS.** Post-transfer repository security was restored, production `youtube.leanback.v4` remained installed and untouched, staging `com.zui.webos.youtube.staging` was validated and retained, and `main` was normally fast-forwarded to `ab05d0d...` without force, rebase or squash.
- **Legacy retention: ACTIVE.** `C:\My_OS\Youtube-webos` is classified `LEGACY_RECOVERY_SOURCE`; its recovery branch, ten untracked provenance files and linked worktrees remain unmodified.

Final evidence: `docs\migration\YOUTUBE_FINAL_MIGRATION_REPORT.md`.

## Exact next task

Run a separate **YouTube dependency-security maintenance milestone** for the six automatically opened Dependabot security-update PRs. Review and test each minimal update independently using `com.zui.webos.youtube.staging`; include CodeQL evaluation. Do not delete `LEGACY_RECOVERY_SOURCE`, mass-format the repository, run broad `npm audit fix`, or install the production candidate in that task.
