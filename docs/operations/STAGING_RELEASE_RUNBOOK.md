# Operational Staging Release Runbook

This workflow creates **staging-only draft prereleases**. It never publishes a release, signs production, changes a source branch, or installs to a TV.

## 1. Preconditions

- Work from a clean ZUI product repository whose `origin` matches the platform product registry.
- Fetch the expected ref and record the exact lowercase 40-character commit SHA.
- Use an IPK that exactly matches the platform's pinned staging artifact metadata.
- Confirm `gh auth status` has access to the registered product repository.
- Keep the signing key under `%LOCALAPPDATA%\ZUI-WebOS\keys\`; never copy it into this repository.

## 2. Create the operational key once

```powershell
pnpm exec zui-webos trust key generate-staging
```

Enter and confirm a strong passphrase at the hidden prompt. Generation refuses to overwrite an existing key. Review the generated public metadata file, register only that public entry in `repository/trust/keys.json`, and retire the historical acceptance-only key without deleting it.

For non-interactive operator automation, `ZUI_WEBOS_STAGING_SIGNING_PASSPHRASE` is accepted. Environment variables can be observed by sufficiently privileged local processes and may persist in parent-process history/configuration; prefer the hidden prompt. The CLI removes its process copy after reading and never logs the value.

## 3. Prepare and verify locally

Runtime artifacts and release bundles use the process-neutral data root
`%USERPROFILE%\.zui-webos\` by default. This deliberately avoids Windows
Store/AppContainer virtualization of `%LOCALAPPDATA%`. Set
`ZUI_WEBOS_DATA_DIR` to an absolute path to configure one alternative root for
cache, release inputs, and release bundles. The signing key remains separately
protected under `%LOCALAPPDATA%\ZUI-WebOS\keys\`.

If a pinned IPK was produced by an older build that cached runtime data under
`%LOCALAPPDATA%`, stage it once from the process that can see the legacy file:

```powershell
pnpm exec zui-webos release staging stage-input `
  zui-youtube-webos-0.8.4-staging `
  C:\path\to\com.zui.webos.youtube.staging_0.8.4_all.ipk
```

This verifies SHA-256, size, App ID, and version against repository metadata,
writes to `release-inputs\sha256\<DIGEST>\` without overwrite, and does not
create a bundle or mutate GitHub.

Choose a collision-resistant identity that starts with `zui-staging-` and clearly names product/version/build, for example:

```text
zui-staging-zui-youtube-webos-0.8.4-20261003-ab05d0d
```

```powershell
pnpm exec zui-webos release staging prepare `
  zui-youtube-webos-0.8.4-staging `
  C:\path\to\com.zui.webos.youtube.staging_0.8.4_all.ipk `
  C:\My_OS\LG-TV\ZUI_YouTube_WebOS `
  ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2 `
  zui-staging-zui-youtube-webos-0.8.4-20261003-ab05d0d
```

The command blocks dirty source state, wrong origin/ref/HEAD, production metadata, artifact hash/size/App-ID/version mismatch, inactive keys, and existing local bundle identity. The bundle is written outside Git under `%USERPROFILE%\.zui-webos\releases\staging\<release-id>\` by default and contains the three upload assets plus local verification/report metadata.

Verify independently:

```powershell
pnpm exec zui-webos release staging verify <bundle-directory>
```

Do not upload unless the result is `SIGNED_TRUSTED`.

## 4. Upload exactly one draft prerelease

The mutating command requires the exact release ID as approval and prints the repository, target commit, draft/staging state, assets, and signing key before mutation:

```powershell
pnpm exec zui-webos release staging upload <bundle-directory> `
  --approve zui-staging-zui-youtube-webos-0.8.4-20261003-ab05d0d
```

The publisher allows only the registry repository and exactly:

- the staging IPK;
- `release-manifest.json`;
- `release-manifest.sig`.

It creates `draft=true`, `prerelease=true`, uploads the whitelist, reads the release back, and verifies repository, release/tag identity, target commit, state, names, and sizes. There is no publish/stable/production option.

## 5. Verify through distribution and catalog

After the reviewed catalog record is copied from `catalog-release-record.json` into the platform release registry, use the existing provider path:

```powershell
pnpm exec zui-webos artifact fetch ZUI-WebOS/ZUI-YouTube-WebOS <release-id> zui-youtube-webos-0.8.4-staging
pnpm exec zui-webos artifact cache verify 816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4
```

Then confirm Catalog Service marks the release DRAFT/STAGING/SIGNED/CACHED_VERIFIED and generate a read-only plan. Stop before installation.

## Abort and recovery

- Before upload: leave the non-overwritten local bundle for diagnosis; create a new release ID only after correcting the cause.
- Wrong passphrase/key: stop. Do not regenerate over the existing key. Recover the encrypted key/passphrase backup.
- Partial upload: tooling stops and leaves the draft visible for evidence. Do not rerun or publish it; inspect the release and decide explicitly whether to remove the incomplete new draft or create a fresh identity.
- If the explicit decision is to complete that same draft, use `release staging resume-upload <bundle-directory> <github-release-id> --approve <release-id>`. Recovery requires the exact numeric release ID, repository, tag, target commit, draft/prerelease state, and an empty or exact-subset asset set. It uploads only missing whitelist assets, never clobbers an existing asset, and performs full read-back verification.
- Read-back mismatch: treat the release as untrusted. Do not add catalog metadata and do not use its assets.
- Suspected key compromise: change the public entry to `REVOKED`, revalidate caches, and follow the rotation guide.

Never commit the private PEM, passphrase, local bundle, tokens, credentials, or logs containing secrets.
