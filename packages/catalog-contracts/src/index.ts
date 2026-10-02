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

export interface ProductRelease {
  readonly productId: string;
  readonly version: string;
  readonly source: ReleaseSource;
}

export interface ReleaseArtifact {
  readonly productId: string;
  readonly releaseVersion: string;
  readonly filename: string;
  readonly sha256: string;
  readonly appId: string;
  readonly deploymentClass: DeploymentClass;
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

  return registry.products.every((product: unknown) => {
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
