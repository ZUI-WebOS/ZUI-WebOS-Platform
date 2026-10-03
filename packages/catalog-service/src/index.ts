import type {
  CacheAvailability,
  Catalog,
  CatalogArtifact,
  CatalogProduct,
  CatalogRelease,
  CatalogTrustState,
  DeploymentClass,
  ProductAppIdentity,
  ProductRegistry,
  ProductRegistryEntry,
  ProductRelease,
  ProductUpdateComparison,
  ReleaseArtifact,
  ReleaseChannel,
  RemoteAvailability,
  UpdateStatus,
} from "@zui-webos/catalog-contracts";
import type { InstalledApplication } from "@zui-webos/shared-types";

export interface CatalogCacheRecord {
  readonly artifactId: string;
  readonly sha256: string;
  readonly trustState: CatalogTrustState;
  readonly signingKeyId: string | null;
  readonly verifiedAt: string | null;
  readonly cacheAvailability: CacheAvailability;
}
export interface CatalogRemoteEvidence {
  readonly artifactId: string;
  readonly availability: RemoteAvailability;
  readonly draft: boolean | null;
  readonly prerelease: boolean | null;
}
export interface CatalogServiceInput {
  readonly registry: ProductRegistry;
  readonly releases: readonly ProductRelease[];
  readonly installedApplications: readonly InstalledApplication[];
  readonly cacheRecords?: readonly CatalogCacheRecord[];
  readonly remoteEvidence?: readonly CatalogRemoteEvidence[];
  readonly now?: Date;
}

interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly (string | number)[];
}
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
function parseSemVer(value: string): SemVer | null {
  const match = SEMVER.exec(value);
  if (match === null) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease:
      match[4] === undefined
        ? []
        : match[4]
            .split(".")
            .map((part) =>
              /^(0|[1-9]\d*)$/u.test(part) ? Number(part) : part,
            ),
  };
}
function compareSemVer(left: string, right: string): number | null {
  const a = parseSemVer(left);
  const b = parseSemVer(right);
  if (a === null || b === null) return null;
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0)
    return a.prerelease.length === b.prerelease.length
      ? 0
      : a.prerelease.length === 0
        ? 1
        : -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const x = a.prerelease[index];
    const y = b.prerelease[index];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "string") return -1;
    if (typeof x === "string" && typeof y === "number") return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
function compatibleChannel(deploymentClass: DeploymentClass): ReleaseChannel {
  return deploymentClass === "production" ? "stable" : "staging";
}
function trustRank(value: CatalogTrustState): number {
  return (
    {
      SIGNED: 5,
      REPOSITORY_PINNED_HASH: 4,
      REGISTRY_MATCH: 3,
      UNVERIFIED: 2,
      REVOKED: 1,
      INVALID_SIGNATURE: 0,
    } as const
  )[value];
}

export class UpdateEvaluationService {
  evaluate(input: {
    readonly product: CatalogProduct;
    readonly identity: ProductAppIdentity;
    readonly installed: InstalledApplication | null;
  }): ProductUpdateComparison {
    const channel = compatibleChannel(input.identity.deploymentClass);
    const candidates = input.product.releases
      .filter((release) => release.channel === channel)
      .flatMap((release) =>
        release.artifacts
          .filter(
            (artifact) =>
              artifact.appId === input.identity.appId &&
              artifact.deploymentClass === input.identity.deploymentClass,
          )
          .map((artifact) => ({ release, artifact })),
      )
      .filter((candidate) => parseSemVer(candidate.release.version) !== null)
      .sort(
        (left, right) =>
          compareSemVer(right.release.version, left.release.version) ?? 0,
      );
    const candidate = candidates[0] ?? null;
    let versionStatus: UpdateStatus;
    if (input.installed === null) versionStatus = "NOT_INSTALLED";
    else if (candidate === null) versionStatus = "NO_COMPATIBLE_RELEASE";
    else {
      const relation = compareSemVer(
        input.installed.version ?? "",
        candidate.release.version,
      );
      versionStatus =
        relation === null
          ? "VERSION_UNKNOWN"
          : relation === 0
            ? "UP_TO_DATE"
            : relation < 0
              ? "UPDATE_AVAILABLE"
              : "AHEAD_OF_CATALOG";
    }
    const trustStatus = candidate?.artifact.trustState ?? "UNVERIFIED";
    return {
      productId: input.product.productId,
      displayName: input.product.displayName,
      appId: input.identity.appId,
      installed: {
        installed: input.installed !== null,
        appId: input.identity.appId,
        version: input.installed?.version ?? null,
        deploymentClass: input.identity.deploymentClass,
        channel,
      },
      available: {
        releaseId: candidate?.release.releaseId ?? null,
        version: candidate?.release.version ?? null,
        channel,
        trustState: trustStatus,
        artifactId: candidate?.artifact.artifactId ?? null,
      },
      versionStatus,
      trustStatus,
      policyStatus:
        candidate !== null &&
        input.identity.deploymentClass === "staging" &&
        candidate.artifact.cacheAvailability === "CACHED_VERIFIED" &&
        (trustStatus === "SIGNED" || trustStatus === "REPOSITORY_PINNED_HASH")
          ? "PLAN_AVAILABLE"
          : "BLOCK",
    };
  }
}

function normalizeArtifact(
  artifact: ReleaseArtifact,
  caches: ReadonlyMap<string, CatalogCacheRecord>,
  remotes: ReadonlyMap<string, CatalogRemoteEvidence>,
): CatalogArtifact {
  const cache = caches.get(artifact.artifactId);
  const remote = remotes.get(artifact.artifactId);
  const cacheMatches =
    cache !== undefined &&
    cache.sha256.toUpperCase() === artifact.hash.digest.toUpperCase();
  return {
    artifactId: artifact.artifactId,
    filename: artifact.filename,
    appId: artifact.appId,
    version: artifact.version,
    deploymentClass: artifact.deploymentClass,
    size: artifact.size,
    sha256: artifact.hash.digest.toUpperCase(),
    trustState:
      cacheMatches && cache.cacheAvailability === "CACHED_VERIFIED"
        ? cache.trustState
        : "REPOSITORY_PINNED_HASH",
    signingKeyId: cacheMatches ? cache.signingKeyId : null,
    remoteAvailability:
      artifact.source.type === "GITHUB_RELEASE"
        ? (remote?.availability ?? "REMOTE_UNKNOWN")
        : "REMOTE_UNAVAILABLE",
    cacheAvailability: cacheMatches
      ? cache.cacheAvailability
      : cache === undefined
        ? "NOT_CACHED"
        : "CACHE_INVALID",
    verifiedAt: cacheMatches ? cache.verifiedAt : null,
  };
}
function normalizeRelease(
  release: ProductRelease,
  caches: ReadonlyMap<string, CatalogCacheRecord>,
  remotes: ReadonlyMap<string, CatalogRemoteEvidence>,
): CatalogRelease {
  const artifacts = release.artifacts.map((artifact) =>
    normalizeArtifact(artifact, caches, remotes),
  );
  const remote = release.artifacts
    .map((artifact) => remotes.get(artifact.artifactId))
    .find((item) => item !== undefined);
  return {
    releaseId:
      release.releaseRef ??
      `${release.productId}-${release.channel}-${release.version}`,
    productId: release.productId,
    version: release.version,
    channel: release.channel,
    repository: release.sourceRepository,
    sourceCommit: release.sourceCommit ?? null,
    draft: remote?.draft ?? null,
    prerelease: remote?.prerelease ?? null,
    published:
      remote === undefined || remote.draft === null ? null : !remote.draft,
    trustState: artifacts.reduce<CatalogTrustState>(
      (best, artifact) =>
        trustRank(artifact.trustState) > trustRank(best)
          ? artifact.trustState
          : best,
      "UNVERIFIED",
    ),
    signingKeyId:
      artifacts.find((artifact) => artifact.signingKeyId !== null)
        ?.signingKeyId ?? null,
    artifacts,
  };
}
function normalizeProduct(
  product: ProductRegistryEntry,
  releases: readonly ProductRelease[],
  caches: ReadonlyMap<string, CatalogCacheRecord>,
  remotes: ReadonlyMap<string, CatalogRemoteEvidence>,
): CatalogProduct {
  return {
    productId: product.id,
    displayName: product.displayName,
    description: null,
    repository: product.repository,
    appIdentities: product.appIdentities,
    rootlessCompatible: product.rootlessCompatible,
    releases: releases
      .filter((release) => release.productId === product.id)
      .map((release) => normalizeRelease(release, caches, remotes)),
  };
}

export class CatalogService {
  constructor(private readonly updates = new UpdateEvaluationService()) {}
  build(input: CatalogServiceInput): Catalog {
    const caches = new Map(
      (input.cacheRecords ?? []).map((item) => [item.artifactId, item]),
    );
    const remotes = new Map(
      (input.remoteEvidence ?? []).map((item) => [item.artifactId, item]),
    );
    const products = input.registry.products.map((product) =>
      normalizeProduct(product, input.releases, caches, remotes),
    );
    const comparisons = products.flatMap((product) =>
      product.appIdentities.map((identity) =>
        this.updates.evaluate({
          product,
          identity,
          installed:
            input.installedApplications.find(
              (application) => application.id === identity.appId,
            ) ?? null,
        }),
      ),
    );
    return {
      products,
      comparisons,
      summary: {
        managedProducts: products.length,
        updatesAvailable: comparisons.filter(
          (item) => item.versionStatus === "UPDATE_AVAILABLE",
        ).length,
        verifiedArtifacts: products
          .flatMap((product) => product.releases)
          .flatMap((release) => release.artifacts)
          .filter(
            (artifact) => artifact.cacheAvailability === "CACHED_VERIFIED",
          ).length,
      },
      generatedAt: (input.now ?? new Date()).toISOString(),
    };
  }
}
