export type DeploymentModel = "developer-mode-ipk";
export type ReleaseSource = "github-releases";

export interface ProductRegistryEntry {
  readonly id: string;
  readonly displayName: string;
  readonly repository: `https://github.com/${string}/${string}`;
  readonly appIds: readonly string[];
  readonly deploymentModel: DeploymentModel;
  readonly releaseSource: ReleaseSource;
  readonly rootlessCompatible: true;
  readonly sourceModel: "external-product-repository";
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
      entry.deploymentModel === "developer-mode-ipk" &&
      entry.releaseSource === "github-releases" &&
      entry.rootlessCompatible === true &&
      entry.sourceModel === "external-product-repository"
    );
  });
}
