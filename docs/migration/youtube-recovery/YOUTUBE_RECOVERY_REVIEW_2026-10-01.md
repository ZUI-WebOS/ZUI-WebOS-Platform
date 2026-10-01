# YouTube webOS Recovery Review — 2026-10-01

Scope: independent read-only review of the recovery archive, final standalone mirror, disposable restore, local recovery branch, and two recovery commits. No source/ref/worktree/GitHub/TV/app-ID mutation was performed.

## 1. Commit graph review

**PASS**

- Current branch remained `recovery/zui-turkish-auto-tr-20261001`; HEAD remained `cd9964db1d560da85350773db89b78768414d4d9`.
- Exact parent chain:
  - base `5f7aa18fa0829b4e0607475222d5adacd85c6eff`;
  - `f9e346254994e0c4d0bc195b61b70819aece6f9c`;
  - `cd9964db1d560da85350773db89b78768414d4d9`.
- `rev-list --count base..HEAD` returned `2`.
- Merge-base was exactly `5f7aa18...`.
- Both recovery commits have one parent; no merge or intermediate commit exists.
- `954919a...` is not an ancestor of the recovery HEAD, proving the contribution branch was not merged/cherry-picked.
- Base-to-HEAD changes are exactly:
  - `src/auto-tr-controller.js` — added;
  - `src/turkish-captions-poc.js` — added;
  - `src/userScript.js` — modified;
  - `webpack.config.js` — modified.
- Diffstat: 4 files, 549 insertions, 2 deletions. `git diff --check` returned success.

## 2. Commit content review

**PASS**

Commit `f9e3462...` contains only two regular mode-100644 source files: the 189-line controller and 355-line caption POC. It contains no artifact, IPK, `work/`, dependency tree, hidden metadata, or unrelated path. Its message accurately records recovery purpose, original base, external raw preservation, date, and absence of 0.8.4 reconciliation.

Commit `cd9964d...` contains only integration wiring:

- `src/userScript.js`: import/comment wiring, 3 insertions/1 deletion including final-newline canonicalization;
- `webpack.config.js`: opt-in `env.yttr` alias wiring, 2 insertions/1 deletion including final-newline canonicalization.

Total is the expected 5 insertions/2 deletions. The patch contains no mass line-ending/formatting drift and its message accurately describes recovery scope.

## 3. Raw-byte verification

**PASS**

The archive and current working files independently recalculated to the four expected raw SHA-256 values:

| Path | Raw/archive/working SHA-256 | Committed representation |
|---|---|---|
| `src/auto-tr-controller.js` | `077E4531D7E78881232BB226E3F473ECDFA2882D1CDA2011CCB2C850FB3F3B40` | byte-identical |
| `src/turkish-captions-poc.js` | `53616795095758CDBAB3880FF3E5D9074EA18115C6A2F4E438CC9AA13F508CF7` | byte-identical |
| `src/userScript.js` | `4BAD02F69D8A117FCF95ECD306330B41FA2195F01806AA4463780A066A2EFABF` | intentional LF canonical form `705777A096BA0FF64E7C136780D57FF454F0B70781311C8CA6D6CB0CE94272CC` |
| `webpack.config.js` | `845257FCB2064EAFA689397456FB0987CA49F7F09F1511CC2A9EBA42CC621B4E` | intentional LF canonical form `E4046E1976C14A7A4308734F0972C51A7B0282E4A929B96C603E511B32292E52` |

For the last two files, independently removing CR bytes from CRLF sequences in the raw files produced exactly the committed SHA-256 values. This proves canonicalization-only byte differences; the reviewed patch confirms only the intended five additions/two deletions semantically.

## 4. Manifest verification

**PASS**

| Manifest | Entries | Mismatches |
|---|---:|---:|
| `RAW_DIRTY_SOURCE_SHA256.txt` | 4 | 0 |
| `UNTRACKED_PROVENANCE_SHA256.txt` | 10 | 0 |
| `PRODUCTION_VALIDATED_SHA256.txt` | 1 | 0 |
| `GIT_BUNDLES_SHA256.txt` | 2 | 0 |
| `RECOVERY_DOCUMENTS_SHA256.txt` | 4 | 0 |
| **Total** | **21** | **0** |

No manifest was changed or auto-repaired. `RECOVERY_DOCUMENTS_SHA256.txt` continues to validate the immutable report copies stored under the recovery archive, not later live-document review annotations.

## 5. Mirror/restore review

**PASS**

- Final mirror is bare and shallow, with HEAD symbolic ref `refs/heads/recovery/zui-turkish-auto-tr-20261001` at `cd9964d...`.
- It contains base/main refs, contribution ref `954919a...`, recovery branch, and recorded remote-tracking refs.
- `objects/info/alternates` is absent. The mirror therefore owns its objects and does not depend on the original source repository object directory.
- Mirror `git fsck --full`: PASS.
- Existing standalone clone's `origin` points only to the archived final mirror, not the original primary repo.
- Standalone clone is shallow, on the recovery branch at `cd9964d...`; base and contribution objects are reachable.
- Restored base-to-HEAD diff contains exactly the four intended paths; restored `git fsck --full`: PASS.

The initial direct-bundle clone failed because the shallow boundary commit referenced an unavailable parent. Git automatically removed that incomplete target, so no failed repository directory remains. The successful restore directories `repository-from-mirror` and `repository-post-recovery` are distinct and present. The failure is documented separately and is not confused with mirror success.

## 6. Production baseline review

**PASS**

- Archived IPK: `youtube.leanback.v4_0.8.3_all.ipk`
- Size: 91,744 bytes
- SHA-256: `B67288594D656C0FF923825F0D9B231981C3E65E86EA208C7A0ED785DFBB7B90`
- Recorded runtime bundle SHA-256: `9096727EB81F22673F0405D0B0493936A7AF03B95C1C8B1614F543C02EE20EC2`
- App ID: `youtube.leanback.v4`
- Acceptance record: 23/23 tests, install/launch, real-TV Turkish caption PASS.

The report correctly distinguishes confirmed storage loss (`yttr.caption.preference` and `ytaf-configuration` absent, successful AUTO_TR restoration/persistence) from the unproven external deletion cause. It does not claim a contribution-package overwrite.

## 7. Contribution branch review

**PASS**

- Worktree branch: `feature/translated-caption-target`.
- HEAD: `954919a8b562ba3944084edbcdaeb12707d24cfe`.
- Tracking: `fork/feature/translated-caption-target`, ahead/behind `+0/-0`.
- Status: clean.
- Commit contains only `src/translated-caption-target.js` and `bench/translated-caption-target-test.mjs` as added files.
- It remains separate from the recovery branch.

## 8. GitHub state review

**PASS**

- `Simulate-X/youtube-webos` exists, repository ID `1359362456`, public, non-archived, real fork of `NicholasBly/youtube-webos`, source `FriedChickenButt/youtube-webos`.
- Default branch remains `main` at `5f7aa18fa0829b4e0607475222d5adacd85c6eff`.
- `feature/translated-caption-target` remains present at `954919a8b562ba3944084edbcdaeb12707d24cfe`.
- `recovery/zui-turkish-auto-tr-20261001` returned not found and is not on GitHub.
- No GitHub mutation or push was performed.

## 9. App-ID collision status

**OPEN RISK — unchanged intentionally**

Both recovery/production and contribution `assets/appinfo.json` specify `youtube.leanback.v4`. No manifest or app ID was edited.

**No contribution or staging package may be installed over the production TV using app ID `youtube.leanback.v4`.** A future authorized implementation task must use a separate staging app ID, Simulator, or isolated test target.

## 10. Secret scan

**PASS**

Read-only scans covered all four files in both recovery commits, recovery documentation, migration plan, and manifests.

| Scope | Rule/category | Result |
|---|---|---|
| Recovery commits | High-confidence credential/private-key patterns | SAFE — 0 paths |
| Recovery commits | Credential assignment heuristic | SAFE — 0 paths |
| Recovery docs/manifests | High-confidence credential/private-key patterns | SAFE — 0 paths |
| Recovery docs/manifests | Credential assignment heuristic | SAFE — 0 paths |
| Migration plan | Context-only words such as token/secret/private key | SAFE after context review; policy text only, no value |

No suspected secret value was printed or recorded.

## 11. Documentation changes

Documentation-only changes in this review:

- created `YOUTUBE_RECOVERY_REVIEW_2026-10-01.md`;
- updated `YOUTUBE_SAFE_MIGRATION_PLAN.md` with `Recovery Review: PASS`;
- corrected `YOUTUBE_RECOVERY_REPORT_2026-10-01.md` to state that Git automatically removed the failed direct-bundle clone target.

No recovery archive/manifest, source repository, Git ref, rehearsal repository, GitHub object, app ID, or TV state was changed.

## 12. Remaining risks

- The recovery branch remains local/unpushed by design.
- Repository and mirrors remain shallow; they do not contain unavailable upstream ancestry before the shallow boundary.
- Verified bundle files are not independently cloneable across that boundary; the final no-alternates mirror is the standalone recovery authority.
- Recovered code has not been reconciled with NicholasBly 0.8.4 or rebuilt/retested in this review.
- Production and contribution/staging app IDs still collide.
- The archive report copy remains the immutable manifested recovery-time snapshot; later corrections exist only in live platform documentation.

## 13. Final recovery decision

**RECOVERY_ACCEPTED**

All mandatory acceptance criteria passed: exact two-commit graph, exact four paths, 21 manifest entries with zero mismatches, standalone mirror/restore integrity, production baseline hash, unchanged contribution branch, no detected secret leakage, and unchanged GitHub refs.

This decision accepts recovery integrity only. It is not authorization for push, fetch/deepen, reconciliation, build, TV installation, app-ID change, migration, repository transfer, or rename.

## 14. Exact next action

Keep the current branch and archive unchanged. In a separate explicitly authorized task, review the exact external action text and then push only `recovery/zui-turkish-auto-tr-20261001` to the existing `Simulate-X/youtube-webos` fork as an off-device backup. Before any subsequent 0.8.4 reconciliation or package installation, define and verify a non-production staging app ID or isolated Simulator/test target.
