import type {
  CatalogArtifact,
  CatalogRelease,
  CatalogTrustState,
  DeploymentClass,
  ReleaseChannel,
  UpdateStatus,
} from "@zui-webos/catalog-contracts";

export const TV_STORE_API_VERSION = 1 as const;
export const TV_STORE_API_PREFIX = "/api/tv-store/v1" as const;

export interface TvStoreProduct {
  readonly productId: string;
  readonly displayName: string;
  readonly description: { readonly en: string; readonly tr: string };
  readonly icon: "iptv" | "youtube" | "store" | "generic";
  readonly repository: string;
  readonly appId: string;
  readonly deploymentClass: DeploymentClass;
  readonly channel: ReleaseChannel;
  readonly installed: boolean;
  readonly installedVersion: string | null;
  readonly availableVersion: string | null;
  readonly updateStatus: UpdateStatus;
  readonly trustState: CatalogTrustState;
  readonly rootlessCompatible: boolean;
  readonly inventoryAvailable: boolean;
  readonly release: Pick<
    CatalogRelease,
    "releaseId" | "sourceCommit" | "draft" | "prerelease" | "published"
  > | null;
  readonly artifact: Pick<
    CatalogArtifact,
    "artifactId" | "appId" | "version" | "deploymentClass" | "trustState"
  > | null;
}

export interface TvStoreCatalogResponse {
  readonly apiVersion: typeof TV_STORE_API_VERSION;
  readonly mode: "LIVE" | "MOCK";
  readonly generatedAt: string;
  readonly inventoryAvailable: boolean;
  readonly products: readonly TvStoreProduct[];
  readonly summary: {
    readonly products: number;
    readonly installed: number;
    readonly updates: number;
  };
}

export function isTvStoreCatalogResponse(
  value: unknown,
): value is TvStoreCatalogResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TvStoreCatalogResponse>;
  if (
    candidate.apiVersion !== TV_STORE_API_VERSION ||
    (candidate.mode !== "LIVE" && candidate.mode !== "MOCK") ||
    typeof candidate.generatedAt !== "string" ||
    typeof candidate.inventoryAvailable !== "boolean" ||
    !Array.isArray(candidate.products)
  )
    return false;
  return candidate.products.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;
    const product = item as Partial<TvStoreProduct>;
    return (
      typeof product.productId === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(product.productId) &&
      typeof product.displayName === "string" &&
      typeof product.description === "object" &&
      product.description !== null &&
      typeof product.description.en === "string" &&
      typeof product.description.tr === "string" &&
      typeof product.appId === "string" &&
      (product.deploymentClass === "production" ||
        product.deploymentClass === "staging") &&
      (product.channel === "stable" ||
        product.channel === "staging" ||
        product.channel === "beta") &&
      typeof product.installed === "boolean" &&
      typeof product.inventoryAvailable === "boolean" &&
      typeof product.rootlessCompatible === "boolean" &&
      typeof product.updateStatus === "string" &&
      typeof product.trustState === "string"
    );
  });
}
