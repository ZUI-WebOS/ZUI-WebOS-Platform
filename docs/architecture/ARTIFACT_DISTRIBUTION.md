# Artifact Distribution

`ArtifactDistributionService` keeps network policy out of the CLI. Its GitHub adapter uses authenticated `gh api` calls, accepts only registry-selected `owner/repository` identities, discovers the named draft release, and streams assets without exposing credentials.

The service verifies `release-manifest.sig` before trusting manifest artifact metadata. It then requires one exact asset name, enforces signed and local byte limits, streams into a randomized `.part.ipk`, calculates SHA-256 while downloading, verifies final size/hash, and reparses the IPK app ID and version. Only a fully verified file is atomically promoted.

Verified artifacts live outside Git at `%LOCALAPPDATA%\ZUI-WebOS\artifacts\sha256\<DIGEST>\`. `verified-metadata.json` binds the source, release, asset, canonical-manifest digest, signing key, artifact digest, verification time, manifest, and detached signature. Cache use rechecks current key status, artifact hash, size, app ID, and version. Failure removes only the randomized partial file; it never executes content or automatically deletes cached evidence.
