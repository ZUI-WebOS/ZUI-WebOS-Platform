# YouTube webOS Pre-Recovery State — 2026-10-01

Captured before branch creation, staging, or commit. Repository commands in this phase were read-only.

## Repository identity

- Absolute primary worktree: `C:\My_OS\Youtube-webos\YTTR-webOS\upstream\nicholasbly`
- Repository root: `C:/My_OS/Youtube-webos/YTTR-webOS/upstream/nicholasbly`
- Branch: `feature/turkish-auto-translate-poc`
- HEAD: `5f7aa18fa0829b4e0607475222d5adacd85c6eff`
- Shallow: `true`
- Shallow boundary: `5f7aa18fa0829b4e0607475222d5adacd85c6eff`
- Tags visible locally: none

## Git status --porcelain=v2

```text
# branch.oid 5f7aa18fa0829b4e0607475222d5adacd85c6eff
# branch.head feature/turkish-auto-translate-poc
1 .A N... 000000 000000 100644 0000000000000000000000000000000000000000 0000000000000000000000000000000000000000 src/auto-tr-controller.js
1 .A N... 000000 000000 100644 0000000000000000000000000000000000000000 0000000000000000000000000000000000000000 src/turkish-captions-poc.js
1 .M N... 100644 100644 100644 db05fdb5d52387ebb165d633755323b91c214f67 db05fdb5d52387ebb165d633755323b91c214f67 src/userScript.js
1 .M N... 100644 100644 100644 d82d0ba46bd87272a37e3217d3d78fced1d4a72d d82d0ba46bd87272a37e3217d3d78fced1d4a72d webpack.config.js
? artifacts/trace/youtube.leanback.v4_0.8.3_all.ipk
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/9262051282473701_youtube_leanback_preview.png
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/9262051307371701_youtube_leanback_splash.png
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/appinfo.json
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/icon.png
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/icon.svg
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/index.html
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/index.js
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/largeIcon.png
? work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11/webOSUserScripts/userScript.js
```

The first two `.A` entries are intent-to-add: `git diff --cached` was empty and the index held no substantive file content. The working-tree bytes are the recovery authority.

## Git diff record

`git diff --binary` showed exactly four paths, 549 insertions and 2 deletions:

- new `src/auto-tr-controller.js` (+189);
- new `src/turkish-captions-poc.js` (+355);
- modified `src/userScript.js` (+4/-1);
- modified `webpack.config.js` (+3/-1).

`git diff --cached --binary` returned no content. Exact pre-recovery content is represented by the raw-byte archive and SHA-256 manifest created before any Git mutation; the base-side content is reachable at `5f7aa18...`.

## Raw source hash gate

| Relative path | SHA-256 |
|---|---|
| `src/auto-tr-controller.js` | `077E4531D7E78881232BB226E3F473ECDFA2882D1CDA2011CCB2C850FB3F3B40` |
| `src/turkish-captions-poc.js` | `53616795095758CDBAB3880FF3E5D9074EA18115C6A2F4E438CC9AA13F508CF7` |
| `src/userScript.js` | `4BAD02F69D8A117FCF95ECD306330B41FA2195F01806AA4463780A066A2EFABF` |
| `webpack.config.js` | `845257FCB2064EAFA689397456FB0987CA49F7F09F1511CC2A9EBA42CC621B4E` |

All four matched the prior canonical-state audit baseline.

## Branches and upstreams

```text
+ feature/translated-caption-target  954919a (contrib/nicholasbly) [fork/feature/translated-caption-target]
* feature/turkish-auto-translate-poc 5f7aa18
  main                               5f7aa18 [origin/main]
```

## Remotes

```text
fork   https://github.com/Simulate-X/youtube-webos.git (fetch/push)
origin https://github.com/NicholasBly/youtube-webos.git (fetch/push)
```

No remote was contacted or modified in the snapshot.

## Reachable local refs

| Ref | Object |
|---|---|
| `refs/heads/feature/translated-caption-target` | `954919a8b562ba3944084edbcdaeb12707d24cfe` |
| `refs/heads/feature/turkish-auto-translate-poc` | `5f7aa18fa0829b4e0607475222d5adacd85c6eff` |
| `refs/heads/main` | `5f7aa18fa0829b4e0607475222d5adacd85c6eff` |
| `refs/remotes/fork/feature/translated-caption-target` | `954919a8b562ba3944084edbcdaeb12707d24cfe` |
| `refs/remotes/origin/HEAD` | `5f7aa18fa0829b4e0607475222d5adacd85c6eff` |
| `refs/remotes/origin/main` | `5f7aa18fa0829b4e0607475222d5adacd85c6eff` |

No local tags were present. Because the repository is shallow, this ref set is only the locally reachable history and is not a complete upstream backup.

## Worktree map

| Worktree | State |
|---|---|
| `C:/My_OS/Youtube-webos/YTTR-webOS/upstream/nicholasbly` | branch `feature/turkish-auto-translate-poc`, `5f7aa18...`, dirty |
| `C:/My_OS/Youtube-webos/YTTR-webOS/contrib/nicholasbly` | branch `feature/translated-caption-target`, `954919a...`, clean |
| `C:/My_OS/Youtube-webos/YTTR-webOS/work/patch-verify-20260906` | detached `5f7aa18...`, clean |
| `C:/My_OS/Youtube-webos/YTTR-webOS/work/stability-patch-verify` | detached `5f7aa18...`, clean |

## Untracked provenance

Ten files were untracked: one trace IPK and nine files under `work/trace-build-ae1cd4d4038b4d8daec7bb25c4004b11`. Their byte hashes are recorded in `UNTRACKED_PROVENANCE_SHA256.txt` in the external recovery archive.

Ignored entries were `.husky/` and `node_modules/`. They were classified as dependency/hook material rather than unique provenance and excluded. No large cache was copied.

## Line-ending and attributes state

- Effective `core.autocrlf=true`, originating from the system Git config.
- `core.eol` is unset.
- Repository `.gitattributes` is absent.
- `git check-attr -a` returned no path-specific attributes for the four files.
- `git diff` warned that LF would be replaced by CRLF the next time Git touched each of the four files.

Therefore original filesystem bytes must be archived before staging, and staged blobs must be compared with those raw originals rather than assuming byte identity.

## Production provenance gate

`artifacts/visibility-off-fix/youtube.leanback.v4_0.8.3_all.ipk` existed, size 91,744 bytes, SHA-256 `B67288594D656C0FF923825F0D9B231981C3E65E86EA208C7A0ED785DFBB7B90`. This matched the production baseline. The folder contained no additional files at snapshot time.
