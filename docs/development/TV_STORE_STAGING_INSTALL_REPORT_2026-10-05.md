# TV Store staging install — real-TV acceptance

Date: 2026-10-05. Hardware acceptance: **PASS**. Repository quality and publication gates are recorded below; final milestone closure additionally requires CI and CodeQL success on the pushed HEAD.

## Authorized scope and baseline

Baseline main/origin: `01e0e1736110a0c36c2b6dbba1223ac0a1371bc8`. The preserved installation-flow work and inventory reliability fix are accepted together. This run executed exactly one catalog installation, following the user's real-TV **Install now** confirmation. No second install, install retry, uninstall, storage clear, DevMode extension, Store update, source-repository change, signing-key access, or release publication was performed.

Accepted installed Store: `com.zui.webos.store.staging`, `0.3.1`, title `ZUI Store STAGING`. Its existing IPK was not replaced during reacceptance:

- File: `com.zui.webos.store.staging_0.3.1_all.ipk`
- Size: `1533686` bytes
- SHA-256: `6F342A911B9ED8E448830C22E31E033E29D1AAC50DAE4B03B6D509EB721F3E63`

## Exact target and trust

| Field                | Verified value                                                     |
| -------------------- | ------------------------------------------------------------------ |
| Logical product      | `zui-youtube-webos`                                                |
| Artifact             | `zui-youtube-webos-0.8.4-staging`                                  |
| Release              | `zui-staging-zui-youtube-webos-0.8.4-20261003-ab05d0d`             |
| Source commit        | `ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2`                         |
| App ID               | `com.zui.webos.youtube.staging`                                    |
| Version / deployment | `0.8.4` / staging                                                  |
| Package              | `com.zui.webos.youtube.staging_0.8.4_all.ipk`                      |
| Size                 | `94208` bytes                                                      |
| SHA-256              | `816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4` |
| Verification         | `SIGNED_TRUSTED`, current signature/cache/identity checks          |
| Fresh preflight      | `NOT_INSTALLED`, `ALLOW_WITH_APPROVAL`                             |

The artifact hash binds the receipt to the registry/release above. The existing receipt schema does not separately store logical product/release/artifact IDs; this report supplies that correlation rather than inventing receipt fields.

## Real-TV observations

The actual installed Store UI paired with the freshly armed service and created a fresh intent. Review displayed the staging identity, target version and device alias. Read-only DOM observation confirmed initial focus `approval-cancel`; screenshot 17 shows its visible focus ring. The user deliberately activated **Şimdi Yükle** with the real remote and reported it in chat. No automation submitted this approval.

Observed timestamps are UTC (local Istanbul time is UTC+03:00):

| Time         | Actual state                       |
| ------------ | ---------------------------------- |
| 09:13:38.736 | `RUNNING / VERIFYING_PACKAGE`      |
| 09:13:39.202 | `RUNNING / CHECKING_TV`            |
| 09:13:42.452 | `RUNNING / INSTALLING`             |
| 09:13:45.775 | `RUNNING / VERIFYING_INSTALLATION` |
| 09:13:48.745 | `SUCCEEDED / COMPLETE`             |

Pre-install and post-install inventory succeeded on attempt one (2,933 ms and 3,173 ms respectively). The TV showed **Başarıyla yüklendi**, `ZUI YouTube for webOS · 0.8.4`, with result-back focus. Returning to product detail showed **Güncel**, installed/available `0.8.4`, signed trust, and no reinstall button.

A separate fresh inventory at 09:14:37.260 UTC confirmed:

| Application                     | Before        | After   | Result               |
| ------------------------------- | ------------- | ------- | -------------------- |
| `com.zui.player`                | `1.0.1`       | `1.0.1` | Protected, unchanged |
| `youtube.leanback.v4`           | `0.8.3`       | `0.8.3` | Protected, unchanged |
| `com.zui.webos.store.staging`   | `0.3.1`       | `0.3.1` | Unchanged            |
| `com.zui.webos.youtube.staging` | Not installed | `0.8.4` | Verified installed   |

Exactly one new matching TV_STORE receipt was found. It recorded timestamp `2026-10-05T09:13:48.593Z`, the exact target App ID/version/hash, `approvalValidated: true`, `commandExitCode: 0`, `postInstallVerified: true`, `result: SUCCESS`, and `rollback: NOT_REQUIRED`. Secret/token/passphrase/private/path fields were absent. Service health reported `armed: false`; the install service was subsequently stopped without rearming.

## Negative acceptance

- Replayed approval of the **same consumed real intent** returned HTTP `403 / SESSION_EXPIRED`. No second execution occurred. The actual rejection is session expiry, not a fabricated intent-specific code.
- A new read-only plan using verified artifact bytes and fresh real inventory returned `SAME_VERSION`, `BLOCK`, non-executable, with `SAME_VERSION_REINSTALL` risk.
- Mock coordinator tests independently reject both `com.zui.player` and `youtube.leanback.v4` even when metadata claims staging; neither distribution nor InstallerService execution is reached.
- Existing regression tests cover expiry, repeated approval, stale/changed inventory, trust, protected identities, cancellation, inventory retry/coalescing and no install retry.
- Runtime observation during successful acceptance recorded zero fatal exceptions and zero error logs. The expected negative replay HTTP 403 happened afterwards and is not classified as a fatal/uncaught runtime error.

## Sanitized real-TV evidence

All images are actual TV-rendered output captured through its Inspector, not browser mockups. No pairing code, session token, private address, key material or private path is included.

- [Review: Cancel initial focus](../../evidence/tv-store/17-real-tv-install-review-cancel.png)
- [Verification progress sample](../../evidence/tv-store/acceptance-verifying_package.png)
- [Check TV](../../evidence/tv-store/acceptance-checking_tv.png)
- [Install](../../evidence/tv-store/acceptance-installing.png)
- [Verify installation](../../evidence/tv-store/acceptance-verifying_installation.png)
- [Progress complete](../../evidence/tv-store/acceptance-complete.png)
- [Refreshed current detail](../../evidence/tv-store/18-real-tv-installed-up-to-date.png)
- [Sanitized runtime timeline](../../evidence/tv-store/staging-install-runtime.json)

Practical evidence limits: no separate screenshot was saved of preflight eligibility, Install-now focus, or the success-result view. Preflight/service evidence, user confirmation and actual runtime/DOM observation cover these points; the COMPLETE image is the completed progress view, not a substituted result screenshot. Asynchronous screen sampling can cross a phase transition: the verifying_package filename shows CHECKING_TV visually; the runtime JSON, not filenames, is authoritative for phase timestamps. No second install was run to recreate missing images.

## Root cause and remaining boundaries

The prior mutation preflight lacked LIVE's bounded inventory resilience. Coordinator and InstallerService now share a fresh-read wrapper: at most three transient-read attempts, 500/1,000 ms backoff, same-instance in-flight coalescing, no completed cache and no installation retry. Malformed inventory, policy and integrity errors fail closed. Exact original LG transport cause was not recorded; concurrent sessions remain an unproven possible contributor. This successful run required no read retries.

The LAN service is explicitly armed, short-lived and staging-only, not a production TLS/authentication service. Genuine newer-version UPDATE remains a future hardware acceptance gate. Next product work should be that genuine staging UPDATE, additional applications/UX or beta delivery, not another generic infrastructure milestone.

## Repository closeout gates

Measured local gates: frozen-lockfile install, format check, lint, type-check, full test suite (**148/148**, 17 files), build, diff check and full Git fsck all passed. The two additional tests explicitly cover protected production identities. Changed-text secret scan and visual evidence privacy review passed. Remote CI and CodeQL results are checked against the pushed final HEAD and reported at handoff; hardware PASS alone does not close the milestone.

See [installation architecture](../architecture/TV_STORE_INSTALLATION_FLOW.md) for the implementation and operator boundary.
