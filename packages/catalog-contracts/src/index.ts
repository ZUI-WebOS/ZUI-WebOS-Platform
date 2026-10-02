export type DeploymentModel = "developer-mode-ipk";
export type ReleaseSource = "github-releases";
export type DeploymentClass = "production" | "staging";

export interface ProductAppIdentity {
  readonly appId: string;
  readonly deploymentClass: DeploymentClass;
}

export interface ProductRegistryEntry {
  readonly id: string;
  readonly displayName: string;
  readonly repository: `https://github.com/${string}/${string}`;
  readonly appIds: readonly string[];
  readonly appIdentities: readonly ProductAppIdentity[];
  readonly expectedPublisher?: string;
  readonly deploymentModel: DeploymentModel;
  readonly releaseSource: ReleaseSource;
  readonly rootlessCompatible: true;
  readonly sourceModel: "external-product-repository";
}

export type TrustLevel =
  "UNVERIFIED" | "REGISTRY_MATCH" | "REPOSITORY_PINNED_HASH" | "SIGNED";
export type ReleaseChannel = "stable" | "staging";
export type ArtifactSourceType =
  "LOCAL_VERIFIED" | "GITHUB_RELEASE" | "EXTERNAL";

export interface ArtifactHash {
  readonly algorithm: "sha256";
  readonly digest: string;
}

export interface ArtifactSource {
  readonly type: ArtifactSourceType;
  readonly repository: `https://github.com/${string}/${string}`;
  readonly releaseRef?: string;
  readonly assetName?: string;
  readonly canonicalAssetUrl?: string;
  readonly evidencePath?: string;
}

export interface ProductRelease {
  readonly schemaVersion: 1;
  readonly productId: string;
  readonly version: string;
  readonly channel: ReleaseChannel;
  readonly sourceRepository: `https://github.com/${string}/${string}`;
  readonly releaseRef?: string;
  readonly artifacts: readonly ReleaseArtifact[];
}

export interface ReleaseArtifact {
  readonly artifactId: string;
  readonly filename: string;
  readonly appId: string;
  readonly version: string;
  readonly deploymentClass: DeploymentClass;
  readonly size: number;
  readonly hash: ArtifactHash;
  readonly source: ArtifactSource;
}

export type ArtifactVerificationStatus =
  | "VERIFIED_PINNED_ARTIFACT"
  | "HASH_MISMATCH"
  | "SIZE_MISMATCH"
  | "IDENTITY_MISMATCH"
  | "NO_RELEASE_METADATA";

export interface ArtifactVerificationResult {
  readonly status: ArtifactVerificationStatus;
  readonly trustLevel: TrustLevel;
  readonly expectedSha256: string | null;
  readonly hashMatches: boolean | null;
  readonly expectedSize: number | null;
  readonly sizeMatches: boolean | null;
  readonly expectedAppId: string | null;
  readonly appIdMatches: boolean | null;
  readonly expectedVersion: string | null;
  readonly versionMatches: boolean | null;
  readonly deploymentClass: DeploymentClass | null;
  readonly artifactRecord: ReleaseArtifact | null;
}

export type RegistryClassification =
  | "KNOWN_PRODUCT"
  | "KNOWN_STAGING_PRODUCT"
  | "UNKNOWN_PRODUCT"
  | "APP_ID_MISMATCH"
  | "INVALID_PACKAGE";

export interface RegistryMatch {
  readonly classification: RegistryClassification;
  readonly product: ProductRegistryEntry | null;
  readonly deploymentClass: DeploymentClass | null;
  readonly identityMatched: boolean;
  readonly expectedPublisher: string | null;
  readonly publisherMatched: boolean | null;
  readonly authenticityVerified: false;
  readonly explanation: string;
}

export interface ProductRegistry {
  readonly schemaVersion: 1;
  readonly products: readonly ProductRegistryEntry[];
}

export function validateRegistry(value: unknown): value is ProductRegistry {
  if (typeof value !== "object" || value === null) return false;
  const registry = value as Partial<ProductRegistry>;
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.products))
    return false;

  const entriesValid = registry.products.every((product: unknown) => {
    if (typeof product !== "object" || product === null) return false;
    const entry = product as Partial<ProductRegistryEntry>;
    return (
      typeof entry.id === "string" &&
      typeof entry.displayName === "string" &&
      typeof entry.repository === "string" &&
      entry.repository.startsWith("https://github.com/ZUI-WebOS/") &&
      Array.isArray(entry.appIds) &&
      entry.appIds.every(
        (appId) => typeof appId === "string" && appId.length > 0,
      ) &&
      Array.isArray(entry.appIdentities) &&
      entry.appIdentities.every((identity: unknown) => {
        if (typeof identity !== "object" || identity === null) return false;
        const item = identity as Partial<ProductAppIdentity>;
        return (
          typeof item.appId === "string" &&
          (item.deploymentClass === "production" ||
            item.deploymentClass === "staging") &&
          entry.appIds?.includes(item.appId) === true
        );
      }) &&
      (entry.expectedPublisher === undefined ||
        (typeof entry.expectedPublisher === "string" &&
          entry.expectedPublisher.length > 0)) &&
      entry.deploymentModel === "developer-mode-ipk" &&
      entry.releaseSource === "github-releases" &&
      entry.rootlessCompatible === true &&
      entry.sourceModel === "external-product-repository"
    );
  });
  if (!entriesValid) return false;
  const products = registry.products as readonly ProductRegistryEntry[];
  const productIds = products.map((product) => product.id);
  const appIds = products.flatMap((product) => product.appIds);
  return (
    new Set(productIds).size === productIds.length &&
    new Set(appIds).size === appIds.length
  );
}

export function matchProduct(
  registry: ProductRegistry,
  appId: string,
  observedPublisher?: string,
): RegistryMatch {
  for (const product of registry.products) {
    const identity = product.appIdentities.find(
      (candidate) => candidate.appId === appId,
    );
    if (identity !== undefined) {
      return {
        classification:
          identity.deploymentClass === "staging"
            ? "KNOWN_STAGING_PRODUCT"
            : "KNOWN_PRODUCT",
        product,
        deploymentClass: identity.deploymentClass,
        identityMatched: true,
        expectedPublisher: product.expectedPublisher ?? null,
        publisherMatched:
          product.expectedPublisher === undefined ||
          observedPublisher === undefined
            ? null
            : product.expectedPublisher === observedPublisher,
        authenticityVerified: false,
        explanation:
          "The application ID matches registry identity metadata. This does not prove publisher or artifact authenticity.",
      };
    }
  }
  return {
    classification: "UNKNOWN_PRODUCT",
    product: null,
    deploymentClass: null,
    identityMatched: false,
    expectedPublisher: null,
    publisherMatched: null,
    authenticityVerified: false,
    explanation:
      "No registry identity matches this app ID; authenticity is not established.",
  };
}

export function classifyPackageIdentity(
  registry: ProductRegistry,
  appId: string | null,
  expectedProductId?: string,
): RegistryMatch {
  if (appId === null || appId.length === 0) {
    return {
      classification: "INVALID_PACKAGE",
      product: null,
      deploymentClass: null,
      identityMatched: false,
      expectedPublisher: null,
      publisherMatched: null,
      authenticityVerified: false,
      explanation:
        "No valid package application ID is available for classification.",
    };
  }
  const match = matchProduct(registry, appId);
  if (
    expectedProductId === undefined ||
    match.product?.id === expectedProductId
  ) {
    return match;
  }
  const expectedProduct =
    registry.products.find((product) => product.id === expectedProductId) ??
    null;
  return {
    classification: "APP_ID_MISMATCH",
    product: expectedProduct,
    deploymentClass: null,
    identityMatched: false,
    expectedPublisher: expectedProduct?.expectedPublisher ?? null,
    publisherMatched: null,
    authenticityVerified: false,
    explanation: `Package app ID '${appId}' does not match product '${expectedProductId}'.`,
  };
}

const APP_ID = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/u;
const SHA256 = /^[A-Fa-f0-9]{64}$/u;

export interface ReleaseValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateReleaseRecords(
  values: readonly unknown[],
  registry: ProductRegistry,
): ReleaseValidationResult {
  const errors: string[] = [];
  const releaseKeys = new Set<string>();
  const artifactIds = new Set<string>();
  const artifactHashes = new Map<string, string>();
  for (const value of values) {
    if (typeof value !== "object" || value === null) {
      errors.push("Release record is not an object.");
      continue;
    }
    const release = value as Partial<ProductRelease>;
    const product = registry.products.find(
      (item) => item.id === release.productId,
    );
    if (release.schemaVersion !== 1 || product === undefined) {
      errors.push("Release has an invalid schemaVersion or productId.");
      continue;
    }
    if (typeof release.version !== "string" || release.version.length === 0) {
      errors.push(`Release '${release.productId}' has an invalid version.`);
      continue;
    }
    const releaseKey = `${release.productId}@${release.version}`;
    if (releaseKeys.has(releaseKey))
      errors.push(`Duplicate release '${releaseKey}'.`);
    releaseKeys.add(releaseKey);
    if (
      (release.channel !== "stable" && release.channel !== "staging") ||
      release.sourceRepository !== product.repository ||
      !Array.isArray(release.artifacts)
    ) {
      errors.push(`Release '${releaseKey}' has invalid source or artifacts.`);
      continue;
    }
    for (const rawArtifact of release.artifacts as readonly unknown[]) {
      if (typeof rawArtifact !== "object" || rawArtifact === null) {
        errors.push(`Release '${releaseKey}' contains a non-object artifact.`);
        continue;
      }
      const artifact = rawArtifact as Partial<ReleaseArtifact>;
      const identity = product.appIdentities.find(
        (item) => item.appId === artifact.appId,
      );
      const sourceType = artifact.source?.type;
      if (
        typeof artifact.artifactId !== "string" ||
        artifact.artifactId.length === 0 ||
        typeof artifact.filename !== "string" ||
        !artifact.filename.endsWith(".ipk") ||
        typeof artifact.appId !== "string" ||
        !APP_ID.test(artifact.appId) ||
        artifact.version !== release.version ||
        identity === undefined ||
        artifact.deploymentClass !== identity.deploymentClass ||
        typeof artifact.size !== "number" ||
        !Number.isSafeInteger(artifact.size) ||
        artifact.size < 0 ||
        artifact.hash?.algorithm !== "sha256" ||
        typeof artifact.hash.digest !== "string" ||
        !SHA256.test(artifact.hash.digest) ||
        (sourceType !== "LOCAL_VERIFIED" &&
          sourceType !== "GITHUB_RELEASE" &&
          sourceType !== "EXTERNAL") ||
        artifact.source?.repository !== product.repository
      ) {
        errors.push(`Artifact in '${releaseKey}' has invalid metadata.`);
        continue;
      }
      if (
        artifact.source.assetName !== undefined &&
        artifact.source.assetName !== artifact.filename
      ) {
        errors.push(
          `Artifact '${artifact.artifactId}' source asset name conflicts with its filename.`,
        );
      }
      if (
        artifact.source.type === "GITHUB_RELEASE" &&
        (artifact.source.releaseRef === undefined ||
          artifact.source.assetName === undefined ||
          artifact.source.canonicalAssetUrl === undefined)
      ) {
        errors.push(
          `GitHub artifact '${artifact.artifactId}' has an incomplete source descriptor.`,
        );
      }
      if (artifactIds.has(artifact.artifactId)) {
        errors.push(`Duplicate artifact ID '${artifact.artifactId}'.`);
      }
      artifactIds.add(artifact.artifactId);
      const identityKey = `${artifact.appId}@${artifact.version}:${artifact.deploymentClass}`;
      const previousHash = artifactHashes.get(identityKey);
      const normalizedHash = artifact.hash.digest.toUpperCase();
      if (previousHash !== undefined && previousHash !== normalizedHash) {
        errors.push(`Conflicting hashes for '${identityKey}'.`);
      }
      artifactHashes.set(identityKey, normalizedHash);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function verifyArtifactMetadata(
  releases: readonly ProductRelease[],
  observed: {
    readonly filename: string;
    readonly sha256: string;
    readonly size: number;
    readonly appId: string;
    readonly version: string;
  },
): ArtifactVerificationResult {
  const candidates = releases.flatMap((release) => release.artifacts);
  const artifact =
    candidates.find((item) => item.filename === observed.filename) ?? null;
  if (artifact === null) {
    return {
      status: "NO_RELEASE_METADATA",
      trustLevel: "REGISTRY_MATCH",
      expectedSha256: null,
      hashMatches: null,
      expectedSize: null,
      sizeMatches: null,
      expectedAppId: null,
      appIdMatches: null,
      expectedVersion: null,
      versionMatches: null,
      deploymentClass: null,
      artifactRecord: null,
    };
  }
  const hashMatches =
    artifact.hash.digest.toUpperCase() === observed.sha256.toUpperCase();
  const sizeMatches = artifact.size === observed.size;
  const appIdMatches = artifact.appId === observed.appId;
  const versionMatches = artifact.version === observed.version;
  const status: ArtifactVerificationStatus = !hashMatches
    ? "HASH_MISMATCH"
    : !sizeMatches
      ? "SIZE_MISMATCH"
      : !appIdMatches || !versionMatches
        ? "IDENTITY_MISMATCH"
        : "VERIFIED_PINNED_ARTIFACT";
  return {
    status,
    trustLevel:
      status === "VERIFIED_PINNED_ARTIFACT"
        ? "REPOSITORY_PINNED_HASH"
        : "UNVERIFIED",
    expectedSha256: artifact.hash.digest.toUpperCase(),
    hashMatches,
    expectedSize: artifact.size,
    sizeMatches,
    expectedAppId: artifact.appId,
    appIdMatches,
    expectedVersion: artifact.version,
    versionMatches,
    deploymentClass: artifact.deploymentClass,
    artifactRecord: artifact,
  };
}
