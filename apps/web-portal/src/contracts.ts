import type {
  ArtifactVerificationResult,
  Catalog,
  CatalogProduct,
  CatalogRelease,
  ProductUpdateComparison,
  RegistryMatch,
  TrustLevel,
} from "@zui-webos/catalog-contracts";
import type { InstallationPlanV2 } from "@zui-webos/installation-planner";
import type { PackageInspection } from "@zui-webos/package-inspector";
import type {
  DeveloperModeStatus,
  InstalledApplication,
  ManagedDevice,
  WebOSDevice,
} from "@zui-webos/shared-types";

export interface ApiErrorDto {
  readonly code: string;
  readonly message: string;
  readonly action: string | null;
}
export interface DeviceDto extends WebOSDevice {
  readonly connectionStatus: "reachable" | "unreachable" | "unknown";
}
export interface ClassifiedApplication {
  readonly application: InstalledApplication;
  readonly match: RegistryMatch;
  readonly update: ProductUpdateComparison | null;
}
export interface DashboardDto {
  readonly mode: "REAL" | "MOCK";
  readonly devices: readonly DeviceDto[];
  readonly selectedDevice: string;
  readonly applications: readonly ClassifiedApplication[];
  readonly products: number;
  readonly releases: number;
  readonly verifiedCacheEntries: number;
  readonly updatesAvailable: number;
  readonly receiptCount: number;
  readonly developerMode: DeveloperModeStatus | null;
  readonly generatedAt: string;
}
export type CatalogDto = Catalog;
export interface DeviceDetailDto {
  readonly device: ManagedDevice;
  readonly applications: readonly ClassifiedApplication[];
  readonly developerMode: DeveloperModeStatus;
}
export interface PackageResultDto {
  readonly inspectionId: string;
  readonly inspection: PackageInspection;
  readonly registryMatch: RegistryMatch | null;
  readonly verification: ArtifactVerificationResult | null;
}
export interface ReceiptDto {
  readonly timestamp: string;
  readonly device: string;
  readonly app: string;
  readonly version: string;
  readonly trust: TrustLevel;
  readonly result: string;
  readonly postInstallVerified: boolean;
}
export interface CacheDto {
  readonly digest: string;
  readonly filename: string;
  readonly productId: string;
  readonly release: string;
  readonly trustDecision: string;
  readonly signingKey: string;
  readonly verifiedAt: string;
}
export interface PlanRequest {
  readonly inspectionId: string;
  readonly device: string;
}
export interface CatalogSelectionRequest {
  readonly productId: string;
  readonly releaseId: string;
  readonly artifactId: string;
}
export interface CatalogPlanRequest extends CatalogSelectionRequest {
  readonly device: string;
}
export interface CatalogFetchResultDto {
  readonly productId: string;
  readonly releaseId: string;
  readonly artifactId: string;
  readonly filename: string;
  readonly sha256: string;
  readonly trust: "SIGNED";
  readonly trustDecision: "SIGNED_TRUSTED";
  readonly signingKeyId: string;
  readonly cacheAvailability: "CACHED_VERIFIED";
}
export type PublicInstallationPlanDto = Omit<
  InstallationPlanV2,
  "artifact" | "proposedCommand"
> & {
  readonly artifact: Omit<InstallationPlanV2["artifact"], "path">;
  readonly proposedCommand: null;
};
export interface ApiEnvelope<T> {
  readonly ok: true;
  readonly data: T;
}
export type ApiResult<T> =
  ApiEnvelope<T> | { readonly ok: false; readonly error: ApiErrorDto };
export type {
  CatalogProduct,
  CatalogRelease,
  InstallationPlanV2,
  ProductUpdateComparison,
};
