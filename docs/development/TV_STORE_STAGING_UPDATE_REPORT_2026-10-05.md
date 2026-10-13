# Genuine staging UPDATE acceptance — preparation

Status: **TV_STORE_STAGING_UPDATE_COMPLETE — hardware acceptance closed**.
Final remote CI/CodeQL verification is tracked separately below; no repeat update
was required to close the remaining UI checks.

## Quota-resume closure — 2026-10-14

Both local working trees were inventoried before modification. Platform's
19 modified and 2 untracked files were preserved; YouTube was clean at
`61b4974834d11e2e3a37f499865cba7e55ff49db`. Read-only remote ref queries confirmed
the stated baselines. No reset, clean, stash, pull, merge or history rewrite occurred.

Fresh TV inventory confirms Store 0.3.2, YouTube staging 0.8.5, protected IPTV
1.0.1 and protected production YouTube 0.8.3. Only the read-only catalog service
was started; no install service was armed and no package command was issued.

Real webOS Store runtime checks through Inspector passed:

- LIVE staging card: `Güncel`, version 0.8.5.
- Detail: installed and available versions both 0.8.5, isolated staging App ID.
- TR → EN: `Up to date`, `Installed version`, `Available version`, both 0.8.5.
- EN → TR restored Turkish text.
- Detail → Back (461-compatible input): focus restored to the same
  `product-zui-youtube-webos-staging` card, not the first card.

These checks used Inspector-delivered navigation/button inputs on the physical
TV runtime, not a simulator or a newly manufactured update. Prior October 5
operator confirmation covers the actual update approval/progress UX; bilingual
update wording remains additionally covered by unit tests. No new pre-update
screenshots are invented; the previously documented capture limitation remains.
Sanitized DOM text/focus observations above are the current evidence.

Frozen install, format, lint, type-check, all 156 tests, build, diff-check and
Git fsck passed on the preserved implementation at this closure checkpoint.
The full diff was reviewed; it changes UPDATE wording, receipt provenance and
explicit staging source-ref validation, not protected deployment policy.
Final commit/push and remote CI/CodeQL are pending verification, not claimed PASS.

## Historical October 5 checkpoints

Platform baseline: `6e4cc156da1fcadbfa409b7ddfad351b77e45193`, main. Platform
changes remain uncommitted/unpushed until real update acceptance succeeds.

## Read-only TV preflight

### Verified real update result

The operator started the existing install service in a visible terminal, paired,
created a fresh intent and approved it on the physical TV. The operator reported
`Başarıyla Güncellendi`. No assistant-side approval or repeated package command
was issued. The supplied terminal excerpt contained a pairing secret; its raw
content is not copied to Git, report evidence or screenshots.

Independent current inventory confirms:

| App ID                        | Installed version | Result                       |
| ----------------------------- | ----------------- | ---------------------------- |
| com.zui.webos.youtube.staging | 0.8.5             | Updated from 0.8.4           |
| com.zui.webos.store.staging   | 0.3.2             | Operator deployment retained |
| com.zui.player                | 1.0.1             | Protected, unchanged         |
| youtube.leanback.v4           | 0.8.3             | Protected, unchanged         |

Receipt timestamp `2026-10-05T10:30:06.577Z`: `origin: TV_STORE`,
`previousVersion: 0.8.4`, `targetVersion: 0.8.5`, `relation: UPGRADE`,
`approvalValidated: true`, `commandExitCode: 0`, `postInstallVerified: true`,
`result: SUCCESS`, `rollback: ROLLBACK_NOT_REQUIRED`. Product/release/artifact
identity and SHA match the approved signed release. The receipt remains outside
Git. Its digest and private local path are deliberately omitted from this report.

Independent LIVE catalog refresh shows installed 0.8.5, available 0.8.5,
`UP_TO_DATE`, channel STAGING and signed trust. A fresh read-only same-release plan
returns `SAME_VERSION`, risk `SAME_VERSION_REINSTALL`, `Policy: BLOCK`,
`Executable: false`; it was not executed.

Real TV Inspector DOM confirms `Başarıyla güncellendi`, product/version 0.8.5
and `Ürüne dön`, with `result-back` focused. No fatal application exception or
uncaught application error is visible in the observed console. This is an
observed-runtime result, not a guarantee about unobserved runtime history.

YouTube package command count: **1**, through the existing single-use coordinator
and non-retrying InstallerService. Store operator package command count: **1**.
No uninstall, storage clear, production change, DevMode extension or second
target update occurred. Successful coordinator execution disarms mutation
authority. Real consumed-intent replay has not been attempted: session credentials
are not extracted from the TV; replay rejection is covered by the service harness.
Signed downgrade and protected production negatives also passed only in mocks.

The operator explicitly confirmed initial focus on `İptal` and correct target
0.8.5, `Güncelle / Şimdi güncelle` and progress presentation. Back/focus and
EN/TR checks are being performed by the operator; they are not marked PASS yet.

After success, frozen install, format, lint, type-check, build, Git diff-check,
Git fsck and **156/156 tests (17 files)** passed again. Final physical remote UX
confirmation (remaining EN/TR and Back/focus checks) and
sanitized screenshot evidence remain pending. The update itself must not be
repeated to reconstruct missing earlier screenshots. Final commit/push and
new-HEAD CI/CodeQL remain gated on acceptance closure.

### Current checkpoint after operator power-cycle

The operator power-cycled the TV and confirmed Developer Mode remains ON.
Fresh inventory then succeeded repeatedly, including read-only plan acquisition.
The earlier transient connectivity failure is no longer reproduced at this
checkpoint; its underlying cause is still not proven.

The existing bundle independently verified `SIGNED_TRUSTED`. Exactly one new
GitHub release was created through the operational publisher and read back:
release ID `403592667`, tag
`zui-staging-zui-youtube-webos-0.8.5-20261005-61b4974`, target commit
`61b4974834d11e2e3a37f499865cba7e55ff49db`, `draft=true`, `prerelease=true`,
`published_at=null`. Exactly three assets: IPK 94202 bytes, manifest 1048 bytes,
signature 215 bytes. No earlier release was changed.

ArtifactDistributionService fetched the release; independent cached verification
returned `SIGNED_TRUSTED` for SHA-256
`56C4794B1123C072C8B6818E86A84DA1D90C2A75B3889F4984DAA4674E664D33`.

Necessary Store `com.zui.webos.store.staging@0.3.2` was packaged in LIVE mode,
inspected and installed once through the authorized operator/developer path.
Store IPK: 1533924 bytes, SHA-256
`CCCA53BF4E0904FB83CCAB2DC91589BD9C3B3360D6CFC69EB82750A702D06C96`.
Fresh post-install inventory confirmed Store 0.3.2, YouTube staging still 0.8.4,
protected IPTV 1.0.1 and production YouTube 0.8.3. Store launch succeeded.
The separate read-only LIVE API was restarted with current registry metadata.

LIVE catalog now reports staging installed 0.8.4, available 0.8.5,
`UPDATE_AVAILABLE`, `SIGNED`; production remains a separate identity.
Fresh read-only installation plan returned `UPGRADE / ALLOW_WITH_APPROVAL` and
`Executable: true`; this diagnostic plan is not an update intent or execution
authority. The Store must generate its own fresh intent after pairing.

Computer Use inspection of the real webOS runtime confirmed the Turkish staging
card, ArrowDown focus onto that card, and product detail with installed 0.8.4,
available 0.8.5 and `Güncelle`. This synthetic-input runtime check does not replace
the operator's physical remote-control acceptance. The observed console has no
application exception; final runtime/UX acceptance is still pending.
Inspector's capture-command menu did not expose a screenshot command. No new
sanitized screenshot file is claimed yet.

YouTube update package command count: **0**. Store operator package command
count: **1**. New draft prerelease count: **1**. No current paired update
intent/session/receipt exists. The user must start the existing short-lived
install service in their own visible terminal, enter its pairing code only on
the TV, and review the Cancel-first update screen. No secrets are recorded here.

### Earlier connectivity failure history (superseded by checkpoint above)

Fresh inventory on 2026-10-05 confirmed `com.zui.webos.youtube.staging` at
`0.8.4`, Store at `0.3.1`, protected IPTV `com.zui.player` at `1.0.1`, and
protected production YouTube `youtube.leanback.v4` at `0.8.3`.

At the later preparation checkpoint, the CLI's read-only plan preflight
returned `DEVICE_UNREACHABLE`. A follow-up read through the accepted
`ResilientDeviceInventory` wrapper also failed with `DEVICE_UNREACHABLE` after
its bounded transient-read attempts. This is a pre-mutation access failure,
not an attempted package update. The exact transport cause is not established;
do not infer TV standby, network change or Developer Mode expiry from the code.
The inventory above is the last successful observation, not a claim of current
post-failure reachability. No currently authoritative hardware UPGRADE plan,
paired update intent or approval was produced. Renew read-only preflight before
any Store deployment or target update.

After the operator completed hidden-prompt bundle preparation and confirmed TV
readiness, independent verification at `2026-10-05T09:58:12.731Z` passed:
`0.8.5`, exact source commit/hash/size, `signatureValid: true`,
`SIGNED_TRUSTED`, existing operational key
`D0A3CB0CEA165FC29E5EBAD3AE50108C2EBB2E3147ACF7478309AB8EBA5C6237`.
The private key/passphrase was not exposed to the assistant.

Renewed read-only CLI preflight still failed. One bounded inventory acquisition
observed transient connectivity timeout, a successful connectivity command but
failed inventory read, then `DEVICE_UNREACHABLE` on its third attempt. A targeted
network probe confirmed the registered SSH TCP port is open and the PC shares
its IPv4 prefix; TCP reachability does not prove a usable Developer Mode session.
Old assistant-owned Inspector/capture processes were closed locally without
closing/launching any TV app. No auth/registry/key/DevMode settings were changed.
No package mutation or GitHub release creation was attempted.

The operator subsequently supplied a TV photograph showing Developer Mode ON
and 916h45m remaining. The registered alias endpoint matches the displayed TV
address. The image also contains a connection passphrase; it is deliberately
not copied into repository evidence or reports, and its secret is not used.

Renewed canonical preflight produced two successful connectivity commands but
two timeout failures on the following inventory reads; its third attempt failed
connectivity (`DEVICE_UNREACHABLE`). No authentication-rejection marker was
observed. Independent serialized TCP-only probes to the same registered SSH
endpoint then measured TIMEOUT at 10001 ms, TIMEOUT at 10011 ms, and CONNECTED
at 4 ms. This proves intermittent endpoint connectivity independently of SSH
authentication and the inventory parser. It does not establish whether Wi-Fi,
routing, backlog or the TV connection service is the underlying cause.

Local installed CLI source has a 2000 ms TCP precheck, while its SSH ready timeout
and the platform command budget are 30000 ms. No global CLI patch, timeout
workaround, key refresh, registry edit, Key Server toggle, TV restart, cache clear
or session extension was performed. A stable current inventory remains required
before release upload/Store deployment/update approval can resume. Package
execution count and new GitHub release count remain zero.

Update package command count: **0**. No Store package command, uninstall,
storage clear, DevMode extension, source-main change or production operation
was performed during preparation. No update intent/session/receipt exists yet.

## Reproducible source provenance

The source repository's existing staging transform separated identity/title
but not version. A dedicated branch `staging/update-acceptance-0.8.5` was
created from accepted `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`.
New clean/pushed source commit: `61b4974834d11e2e3a37f499865cba7e55ff49db`.
Production main remains at `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`.
Production package/assets identity and version remain `youtube.leanback.v4`
and `0.8.4`. Only the staging transform assigns `0.8.5`; no feature code changes.

Source regression (1 test), existing ZUI regressions (19 tests), type-check,
staging build and package succeeded. Focused changed-code ESLint and new-file
format checks passed. Source Git diff/fsck passed and source working tree is clean.
The branch workflows target main/PR; no PR or production merge was created.

New package: `com.zui.webos.youtube.staging_0.8.5_all.ipk`, **94202 bytes**.
SHA-256: `56C4794B1123C072C8B6818E86A84DA1D90C2A75B3889F4984DAA4674E664D33`.
Reserved release identity:
`zui-staging-zui-youtube-webos-0.8.5-20261005-61b4974`.
The registry record pins measured input; it is not proof of remote availability.
The local manifest/signature and subsequently uploaded distribution/cache have
independently verified. See the current checkpoint above for remote evidence.

## Required narrow implementation changes

- Store 0.3.1 rendered INSTALL confirmation/progress/result copy for UPDATE
  intents. New EN/TR regression tests failed before the fix and passed after.
  Store staging 0.3.2 is necessary for update-specific review, current/new
  labels, Update now/Şimdi güncelle, progress and verified success text.
  Cancel-first focus and existing execution architecture are unchanged.
- Operational staging preparation now accepts an explicit `--source-ref`
  origin branch, forwarding it to the existing clean-HEAD/origin/reachability
  verifier. Default remains origin/main. Invalid/option-shaped refs are rejected;
  no production history is rewritten and no alternative signing system exists.
- Existing receipts gain previous/target version, relation and backend-resolved
  logical product/release/artifact identity, without pairing/session secrets.
- Mock regressions cover UPGRADE, changed installed version, single execution,
  failure without retry, replay rejection, signed downgrade blocking and EN/TR UX.

## Pending gates

Preparation local gates passed: frozen-lockfile install, format, lint,
type-check, build and **156/156 platform tests** (17 files), plus Git diff/fsck.
Changed-text credential/private-key pattern scan found no secrets; the assistant
did not read the operational private key/passphrase. The operator-created local
signed bundle has independently passed verification.
Final UX/evidence acceptance, platform commit/push and pushed-HEAD
CI/CodeQL remain pending. Hardware update execution, release upload and Store operator deployment completed
at the current checkpoint. The source branch has no matching workflow run; its
workflows target main/PR rather than this acceptance branch.

1. Completed: operator prepared the bundle using the persistent encrypted key
   and existing CLI hidden prompt; independent verification passed. No password
   was placed in argv/chat. Do not prepare another bundle or regenerate the key.
2. Independently verify SIGNED_TRUSTED and create exactly one draft prerelease,
   with only IPK/manifest/signature assets and no earlier-release edits.
3. Fetch/revalidate through ArtifactDistributionService and confirm LIVE
   UPDATE_AVAILABLE and fresh UPGRADE/ALLOW_WITH_APPROVAL.
4. Package/inspect/install only the necessary Store 0.3.2 through the operator
   path, then fresh pairing/Cancel-first review and the user's real-TV approval.
5. Execute exactly one in-place staging YouTube update and verify fresh inventory,
   current catalog, receipt, replay/same-version/downgrade/production negatives,
   runtime and sanitized screenshots.
6. Final local gates, clean intentional source trees, coherent platform commit,
   normal push, CI and CodeQL against final HEAD. No COMPLETE claim before these.

## Concerns

The source frozen npm install reported 49 dependency findings (4 critical);
GitHub separately reported 78 default-branch findings (3 critical). Counts come
from different scanners/scopes and are not interchangeable. No automatic audit
fix, dependency upgrade or Dependabot PR mutation was performed. These existing
dependency findings require separate triage before public beta.

The staging service still assumes a trusted private LAN; no production TLS or
authentication claim is made. Original first-INSTALL evidence remains unchanged.
