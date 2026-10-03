# Catalog Service

`CatalogService` is the single normalization boundary for product, release, artifact, cache, remote-provider, and installed-application state. It lives in `packages/catalog-service`; the browser consumes its normalized result and does not reconstruct catalog trust or policy.

## Inputs

- the schema-validated product registry;
- schema-validated release records;
- installed applications returned by the existing webOS client;
- cache entries revalidated by `ArtifactDistributionService`;
- current, read-only evidence returned by `GitHubReleaseProvider` for metadata-selected repositories and releases.

Provider failure is represented as `REMOTE_UNKNOWN`. A missing named asset in a successfully read release is `REMOTE_UNAVAILABLE`. Neither state changes the artifact trust decision.

## Normalized output

The service returns `Catalog`, `CatalogProduct`, `CatalogRelease`, and `CatalogArtifact` contracts. Releases expose a logical ID, channel, source repository/commit, draft/prerelease/published evidence, trust state, signing key, and artifacts. Artifacts keep three independent dimensions:

- trust: `SIGNED`, `REPOSITORY_PINNED_HASH`, `REGISTRY_MATCH`, `UNVERIFIED`, `REVOKED`, or `INVALID_SIGNATURE`;
- remote state: `REMOTE_AVAILABLE`, `REMOTE_UNAVAILABLE`, or `REMOTE_UNKNOWN`;
- cache state: `CACHED_VERIFIED`, `NOT_CACHED`, or `CACHE_INVALID`.

A repository hash is not promoted to signed trust. A cached artifact is promoted only after the existing distribution service revalidates its signature, key lifecycle/scope, hash, size, App ID, and version.

## API boundary

The Web Manager accepts only `productId`, `releaseId`, and `artifactId`. The backend resolves repository, release, asset, and cache location from validated catalog data. Arbitrary URLs, destinations, local paths, commands, and repository selectors are rejected and are not part of the public DTOs.

`POST /api/catalog/artifacts/fetch` reuses `ArtifactDistributionService`; it can download and verify bytes into the content-addressed cache but cannot install or execute them. `POST /api/catalog/plans` revalidates the selected signed cache entry and delegates to the existing installation planner. The returned browser plan excludes the absolute artifact path and proposed command.

## Privacy and authority

Catalog computation is local-first. It has no telemetry, analytics, or third-party tracking. GitHub access is limited to trusted registry/release identities. The backend remains authoritative for trust, update comparison, cache state, and policy; browser state is display and selection input only.
