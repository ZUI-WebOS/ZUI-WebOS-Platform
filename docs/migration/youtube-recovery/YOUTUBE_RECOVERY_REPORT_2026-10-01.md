# YouTube webOS Recovery Report — 2026-10-01

Scope: the original recovery/preservation phase made no workspace move, GitHub transfer/rename/create, upstream fetch/deepen/reconciliation, 0.8.4 merge/rebase, build/package, TV operation, worktree repair, push, or unrelated source change. Section 15 records the later, separately authorized off-device backup push.

## 1. Pre-recovery state

- Primary: `C:\My_OS\Youtube-webos\YTTR-webOS\upstream\nicholasbly`
- Original branch: `feature/turkish-auto-translate-poc`
- Exact base: `5f7aa18fa0829b4e0607475222d5adacd85c6eff`
- Repository: shallow, boundary at the same base commit; no local tags.
- Dirty state: two intent-to-add files with substantive content only in the worktree, two modified tracked files, and ten untracked trace/build files.
- Cached diff before recovery: empty.
- Clean related branch: `feature/translated-caption-target` at `954919a8b562ba3944084edbcdaeb12707d24cfe`.
- Detached verification worktrees: both clean at `5f7aa18...`.
- Effective line-ending config: system `core.autocrlf=true`; `core.eol` unset; no repository `.gitattributes`; no path-specific attributes.

Full snapshot: `YOUTUBE_PRE_RECOVERY_STATE_2026-10-01.md`.

## 2. Raw-byte preservation

Before branch creation or staging, the four unique source files were copied with their original relative paths to:

`C:\My_OS\LG-TV\_Archive\ZUI_YouTube_WebOS\Recovery_2026-10-01\raw-dirty-source`

| Path | Raw SHA-256 | Copy result |
|---|---|---|
| `src/auto-tr-controller.js` | `077E4531D7E78881232BB226E3F473ECDFA2882D1CDA2011CCB2C850FB3F3B40` | exact |
| `src/turkish-captions-poc.js` | `53616795095758CDBAB3880FF3E5D9074EA18115C6A2F4E438CC9AA13F508CF7` | exact |
| `src/userScript.js` | `4BAD02F69D8A117FCF95ECD306330B41FA2195F01806AA4463780A066A2EFABF` | exact |
| `webpack.config.js` | `845257FCB2064EAFA689397456FB0987CA49F7F09F1511CC2A9EBA42CC621B4E` | exact |

Source/copy mismatch count: `0`.

## 3. Untracked provenance preservation

All ten current untracked files were copied byte-for-byte under `raw-untracked`, preserving relative paths:

- one 90,852-byte trace IPK, SHA-256 `4D125DC2E8AB7128520F58DFC88E131F8674F73CD752C273CDB5F663C721513F`;
- two generated preview/splash PNGs;
- trace-build `appinfo.json`, icons, `index.html`, `index.js`, and built `webOSUserScripts/userScript.js`.

All ten hashes matched. `.husky/` and `node_modules/` were the only important ignored areas; they were classified as reproducible hook/dependency material and intentionally excluded. No cache was copied.

The production-validated folder contained one file and it was copied byte-for-byte to:

`production-validated\visibility-off-fix\youtube.leanback.v4_0.8.3_all.ipk`

### Production Runtime Baseline

- App ID: `youtube.leanback.v4`
- Accepted IPK: `artifacts/visibility-off-fix/youtube.leanback.v4_0.8.3_all.ipk`
- IPK SHA-256: `B67288594D656C0FF923825F0D9B231981C3E65E86EA208C7A0ED785DFBB7B90`
- Runtime bundle SHA-256: `9096727EB81F22673F0405D0B0493936A7AF03B95C1C8B1614F543C02EE20EC2`
- Acceptance: 23/23 tests, install/launch, and real-TV Turkish caption PASS.

The live TV bundle had matched the accepted visibility-off-fix bundle. Clean contribution builds had different bundle hashes and did not contain `__YTTR_POC__`.

Confirmed incident facts: the production package and runtime bundle were correct; `yttr.caption.preference` and `ytaf-configuration` were absent; restoring preference version 2 with `mode=AUTO_TR`, `targetLanguage=tr`, `captionsEnabled=true` restored Turkish translation; restart persistence, English ASR → Turkish, HTTP 200, 322 cues, rendered Turkish DOM captions, playback, Extended runtime, and SponsorBlock hook were observed.

Not proven: the external cause of storage deletion, or whether an unrecorded temporary contribution install ever occurred. Current runtime identity and known install history do not support a contribution-overwrite conclusion.

Production app-ID risk: contribution/staging builds currently share `youtube.leanback.v4`. Future contribution/staging packages must use a separate staging ID, Simulator, or separate test target and must not be installed over the accepted production runtime. No app ID or TV/storage state was changed here.

## 4. SHA-256 manifests

External manifests:

- `manifests\RAW_DIRTY_SOURCE_SHA256.txt`
- `manifests\UNTRACKED_PROVENANCE_SHA256.txt`
- `manifests\PRODUCTION_VALIDATED_SHA256.txt`
- `manifests\GIT_BUNDLES_SHA256.txt`
- `manifests\RECOVERY_DOCUMENTS_SHA256.txt`

Relative paths are used inside manifests. Raw source, untracked provenance, production IPK, and disposable restore checks all reported mismatch count `0`.

## 5. Git bundle recovery

Pre-recovery bundle:

- `git\nicholasbly-local-refs-2026-10-01.bundle`
- 1,848,595 bytes
- SHA-256 `9F86BB691520CA8FA5F9CA3B38DCEF57F4E6060B59CC96AA5171C34C6C5B8AA2`
- `git bundle verify`: PASS; six branch/remote refs plus HEAD/worktree pseudo-refs recorded.

Post-recovery bundle:

- `git\nicholasbly-recovery-final-2026-10-01.bundle`
- 1,858,506 bytes
- SHA-256 `200C8BC3144C66568EB58F313B74B4FAEA77AB661BACDC5D06025ED5522B11E6`
- `git bundle verify`: PASS; includes local recovery branch at `cd9964d...`.

Important limitation: Git described each bundle as complete relative to the shallow local graph, but a direct bundle clone failed because boundary commit `5f7aa18...` references unavailable parent `a6d7be8...`. No fetch/deepen was performed. To provide an actually restorable equivalent, independent `git clone --mirror --no-hardlinks` repositories were created before and after recovery. Both remained shallow, passed `git fsck --full`, and were cloneable without the source repository.

## 6. Disposable restore verification

Verification root retained at:

`C:\My_OS\LG-TV\ZUI_WebOS_Platform\.migration-rehearsal\youtube-recovery-verify`

- Initial direct bundle clone attempt: failed due the documented shallow-parent limitation. Git automatically removed the incomplete clone target; the failure is retained as a documented event, not as a repository directory.
- Pre-recovery mirror clone: PASS; base and `954919a` reachable.
- Raw source overlay: 4/4 exact.
- Untracked overlay: 10/10 exact.
- Production IPK: exact.
- Combined mismatch count: `0`.
- Post-recovery mirror clone: PASS at branch `recovery/zui-turkish-auto-tr-20261001`, HEAD `cd9964d...`.
- Post-recovery restored diff: exactly four intended paths.
- Restored repository `git fsck --full`: PASS.

The rehearsal area is not canonical and was not deleted.

## 7. Recovery branch

Only after raw archive, bundle verification, and disposable restore passed, the original primary worktree was switched to a new local branch:

`recovery/zui-turkish-auto-tr-20261001`

Base was explicitly verified as `5f7aa18fa0829b4e0607475222d5adacd85c6eff`. Branch creation did not change any of the four working-file hashes. At recovery completion the branch had no upstream and had not been pushed; the later off-device backup did not configure an upstream.

## 8. Recovery commits

1. `f9e346254994e0c4d0bc195b61b70819aece6f9c` — `Recover Turkish AUTO_TR controller and caption POC`
   - `src/auto-tr-controller.js`
   - `src/turkish-captions-poc.js`

2. `cd9964db1d560da85350773db89b78768414d4d9` — `Recover AUTO_TR integration wiring`
   - `src/userScript.js`
   - `webpack.config.js`

Each message records unpublished-worktree recovery, original base, recovery date, external raw preservation, and that NicholasBly 0.8.4 reconciliation has not occurred.

Base-to-HEAD result: exactly four paths, 549 insertions, 2 deletions. No artifact, work directory, IPK, node_modules, recovery report, or unrelated file was committed.

## 9. Line-ending verification

The two new source files staged byte-identically:

| Path | Blob | Committed SHA-256 |
|---|---|---|
| `src/auto-tr-controller.js` | `a245f0d1b24589dd4a727aa812c6af1f7bf40a95` | `077E4531D7E78881232BB226E3F473ECDFA2882D1CDA2011CCB2C850FB3F3B40` |
| `src/turkish-captions-poc.js` | `58f4e650024af32c10fa90b22cdffb18998ae281` | `53616795095758CDBAB3880FF3E5D9074EA18115C6A2F4E438CC9AA13F508CF7` |

`src/userScript.js` contained 55 CRLF plus 8 bare-LF endings; `webpack.config.js` contained 182 CRLF plus 3 bare-LF endings. Initial ordinary staging canonicalized them; the mismatch gate stopped the commit. Exact raw blobs were tested, but would have produced a misleading 479-line diff and non-clean filter state. The final commit therefore deliberately uses Git's LF-canonical representation while the worktree and external archive retain the original raw bytes.

| Path | Raw/worktree SHA-256 | Final committed LF blob | Final committed SHA-256 |
|---|---|---|---|
| `src/userScript.js` | `4BAD02F69D8A117FCF95ECD306330B41FA2195F01806AA4463780A066A2EFABF` | `8feefc68ff716610c94b262f4d0723d627da9e8d` | `705777A096BA0FF64E7C136780D57FF454F0B70781311C8CA6D6CB0CE94272CC` |
| `webpack.config.js` | `845257FCB2064EAFA689397456FB0987CA49F7F09F1511CC2A9EBA42CC621B4E` | `b661f874211be6d052f4451669d6f80176f82b31` | `E4046E1976C14A7A4308734F0972C51A7B0282E4A929B96C603E511B32292E52` |

The final commit diff is the intended 5 insertions/2 deletions for integration wiring. No byte change was made to the original working files; all four post-commit working hashes still equal the audit baseline.

## 10. Git integrity

- Original primary exists.
- Recovery HEAD: `cd9964db1d560da85350773db89b78768414d4d9`.
- `git fsck --full`: exit `0`; only the pre-existing intent-to-add empty blob was reported dangling.
- Primary tracked state after commits: no modified/staged tracked paths; the ten original untracked provenance paths remain untracked.
- Recovery branch and both commits restore correctly from the final independent mirror.
- During the recovery phase, no remote, upstream, tag, or remote-tracking ref was changed. The later backup added only the remote recovery branch and left the local upstream unset.

## 11. Unchanged branches/worktrees

- `feature/turkish-auto-translate-poc` ref remains `5f7aa18...`.
- `main` remains `5f7aa18...` and tracks `origin/main`.
- `feature/translated-caption-target` remains clean at `954919a...`, tracking the unchanged fork ref.
- `patch-verify-20260906` remains clean/detached at `5f7aa18...`.
- `stability-patch-verify` remains clean/detached at `5f7aa18...`.
- The independent webosbrew repository was not mutated.
- During the recovery phase, no GitHub ref/repository/organization setting was mutated or pushed. The later backup added only the remote recovery ref; repository and organization settings remained unchanged.
- IPTV repository/source was not touched.

## 12. Files created/changed

Created externally under `C:\My_OS\LG-TV\_Archive\ZUI_YouTube_WebOS\Recovery_2026-10-01`:

- raw source and untracked/production byte copies;
- SHA-256 manifests;
- two verified Git bundles;
- pre- and post-recovery independent shallow mirrors;
- copied recovery reports.

Created/changed in the platform documentation/rehearsal area:

- `docs\migration\youtube-recovery\YOUTUBE_PRE_RECOVERY_STATE_2026-10-01.md`;
- `docs\migration\youtube-recovery\YOUTUBE_RECOVERY_REPORT_2026-10-01.md`;
- `docs\migration\YOUTUBE_SAFE_MIGRATION_PLAN.md`;
- retained `.migration-rehearsal\youtube-recovery-verify\...` restore evidence.

Changed in the original YouTube Git repository: one new local branch and exactly two commits covering four intended source paths. No source working-file bytes were altered by recovery.

## 13. Remaining risks

- Recovery history now exists locally, in the external archive, and on the verified remote recovery branch. It has not been reconciled with upstream or promoted into `main`.
- The repository remains shallow and two commits behind the previously audited NicholasBly 0.8.4 tip; no upstream history was fetched.
- Git bundle files verify but are not independently cloneable across the missing shallow parent. Use the verified final mirror for standalone restoration, or deepen later only after separate authorization.
- Two original working files retain mixed line endings while their committed forms are canonical LF; the raw archive is the byte authority.
- The recovery code has not been rebuilt, retested, reconciled with 0.8.4, or revalidated on TV in this task.
- Contribution/staging and production still share app ID `youtube.leanback.v4`; installing contribution builds on the production TV target remains prohibited.
- No failed direct-bundle clone directory remains because Git automatically removed the incomplete target. The successful `repository-from-mirror` and `repository-post-recovery` directories remain clearly named; the failed attempt is recorded in this report.

## 14. Exact recommended next action

Open a separately authorized task to plan the NicholasBly 0.8.4 reconciliation from the preserved recovery branch. Before any build or TV installation, approve a separate staging app ID or an isolated Simulator/test target. Do not merge, rebase, cherry-pick, transfer, rename, build, package, install, or change app IDs as part of this completed backup task.

Final status: **DONE_WITH_CONCERNS** — preservation, restore proof, local recovery branch, and exact four-path commits are complete; shallow-history portability, upstream reconciliation, and app-ID isolation remain open gates.

## 15. Off-device backup

The separately authorized off-device backup was completed on 2026-10-01 without changing the recovered source or beginning upstream reconciliation.

- GitHub repository: `Simulate-X/youtube-webos` (repository ID `1359362456`).
- Exact local source ref: `refs/heads/recovery/zui-turkish-auto-tr-20261001`.
- Exact remote destination ref: `refs/heads/recovery/zui-turkish-auto-tr-20261001` on `fork`.
- Remote branch SHA: `cd9964db1d560da85350773db89b78768414d4d9`.
- GitHub `pushed_at`: `2026-10-01T15:09:14Z` (`2026-10-01T18:09:14+03:00`, Europe/Istanbul).
- Push was non-force, used one explicit full-ref refspec, and was executed exactly once.
- No upstream/tracking branch was configured for the local recovery branch.
- Remote `main` remained `5f7aa18fa0829b4e0607475222d5adacd85c6eff`.
- Remote `feature/translated-caption-target` remained `954919a8b562ba3944084edbcdaeb12707d24cfe`.
- The remote branch contains exactly the two recovery commits and the four audited paths: `src/auto-tr-controller.js`, `src/turkish-captions-poc.js`, `src/userScript.js`, and `webpack.config.js`.
- The repository remained public, non-archived, forked, and defaulted to `main`; existing other branches, all 46 tags, and the zero-release state were unchanged. No PR or release was created.

Off-device backup result: **PASS**. This establishes a remote recovery copy only; it does not approve 0.8.4 reconciliation, build/test, TV installation, repository transfer, rename, or publication work.
