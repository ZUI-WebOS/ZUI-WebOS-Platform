import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  ArtifactDistributionService,
  GitHubReleaseProvider,
} from "@zui-webos/artifact-distribution";
import { CatalogService } from "@zui-webos/catalog-service";
import type {
  CatalogCacheRecord,
  CatalogRemoteEvidence,
} from "@zui-webos/catalog-service";
import {
  matchProduct,
  validateRegistry,
  validateReleaseRecords,
  verifyArtifactMetadata,
  type Catalog,
  type ProductRegistry,
  type ProductRelease,
} from "@zui-webos/catalog-contracts";
import { createInstallationPlan } from "@zui-webos/installation-planner";
import type { InstallationPlanV2 } from "@zui-webos/installation-planner";
import { FileReceiptStore } from "@zui-webos/installer-service";
import { inspectIpk } from "@zui-webos/package-inspector";
import { platformDataRoot } from "@zui-webos/runtime-paths";
import {
  validateTrustStore,
  type PublicTrustStore,
} from "@zui-webos/signed-release";
import type {
  DeveloperModeStatus,
  DeviceAlias,
  InstalledApplication,
  InventorySnapshot,
} from "@zui-webos/shared-types";
import {
  NodeProcessRunner,
  PlatformError,
  WebOSCliAdapter,
  validateDeviceAlias,
} from "@zui-webos/webos-client";

import type {
  CacheDto,
  CatalogFetchResultDto,
  CatalogPlanRequest,
  CatalogSelectionRequest,
  ClassifiedApplication,
  DashboardDto,
  DeviceDetailDto,
  PackageResultDto,
  PlanRequest,
  PublicInstallationPlanDto,
  ReceiptDto,
} from "./contracts.js";
import {
  mockCatalog,
  mockDashboard,
  mockDevice,
  mockFetchResult,
  mockPlan,
  mockReceipts,
} from "./mock.js";

const localBase = platformDataRoot();
const uploads = join(localBase, "web-manager", "uploads");
const uploadIndex = new Map<string, string>();
const LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

function repoUrl(path: string): URL {
  return new URL(`../../../repository/${path}`, import.meta.url);
}
export async function loadCatalogSources(): Promise<{
  readonly registry: ProductRegistry;
  readonly releases: readonly ProductRelease[];
}> {
  const registryValue: unknown = JSON.parse(
    await readFile(repoUrl("apps/products.json"), "utf8"),
  );
  if (!validateRegistry(registryValue))
    throw new PlatformError(
      "CATALOG_SOURCE_INVALID",
      "Product registry is invalid.",
    );
  const entries = await readdir(repoUrl("releases/"), {
    recursive: true,
    withFileTypes: true,
  });
  const values: unknown[] = [];
  for (const entry of entries)
    if (entry.isFile() && entry.name.endsWith(".json"))
      values.push(
        JSON.parse(
          await readFile(join(entry.parentPath, entry.name), "utf8"),
        ) as unknown,
      );
  const validation = validateReleaseRecords(values, registryValue);
  if (!validation.valid)
    throw new PlatformError(
      "CATALOG_SOURCE_INVALID",
      "Release metadata is invalid.",
      validation.errors.join("; "),
    );
  return { registry: registryValue, releases: values as ProductRelease[] };
}
async function loadTrustStore(): Promise<PublicTrustStore> {
  const value: unknown = JSON.parse(
    await readFile(repoUrl("trust/keys.json"), "utf8"),
  );
  if (!validateTrustStore(value))
    throw new PlatformError(
      "CATALOG_SOURCE_INVALID",
      "Public signing trust store is invalid.",
    );
  return value;
}
function adapter() {
  return new WebOSCliAdapter({
    runner: new NodeProcessRunner(),
    timeoutMs: 15_000,
  });
}
function distribution() {
  return new ArtifactDistributionService(new GitHubReleaseProvider());
}
function repositoryIdentity(repository: string): string {
  const prefix = "https://github.com/";
  if (!repository.startsWith(prefix))
    throw new PlatformError(
      "CATALOG_SOURCE_INVALID",
      "Catalog repository identity is invalid.",
    );
  return repository.slice(prefix.length);
}
function validateLogicalId(value: string, label: string): void {
  if (!LOGICAL_ID.test(value))
    throw new PlatformError(
      "INVALID_ARGUMENT",
      `${label} is not a valid logical identifier.`,
    );
}
async function cacheRecords(): Promise<readonly CatalogCacheRecord[]> {
  const service = distribution();
  const trustStore = await loadTrustStore();
  const records: CatalogCacheRecord[] = [];
  for (const digest of await service.list()) {
    try {
      const result = await service.verifyCached(digest, trustStore);
      records.push({
        artifactId: result.artifactId,
        sha256: result.sha256,
        trustState: "SIGNED",
        signingKeyId: result.keyId,
        verifiedAt: new Date().toISOString(),
        cacheAvailability: "CACHED_VERIFIED",
      });
    } catch {
      /* Invalid cache content is never elevated into the trusted catalog. */
    }
  }
  return records;
}
async function remoteEvidence(
  releases: readonly ProductRelease[],
): Promise<readonly CatalogRemoteEvidence[]> {
  const provider = new GitHubReleaseProvider();
  const evidence: CatalogRemoteEvidence[] = [];
  for (const release of releases) {
    const artifacts = release.artifacts.filter(
      (artifact) => artifact.source.type === "GITHUB_RELEASE",
    );
    if (artifacts.length === 0 || release.releaseRef === undefined) continue;
    try {
      const remote = await provider.getRelease(
        repositoryIdentity(release.sourceRepository),
        release.releaseRef,
      );
      for (const artifact of artifacts)
        evidence.push({
          artifactId: artifact.artifactId,
          availability: remote.assets.some(
            (asset) => asset.name === artifact.filename,
          )
            ? "REMOTE_AVAILABLE"
            : "REMOTE_UNAVAILABLE",
          draft: remote.draft,
          prerelease: remote.prerelease,
        });
    } catch {
      for (const artifact of artifacts)
        evidence.push({
          artifactId: artifact.artifactId,
          availability: "REMOTE_UNKNOWN",
          draft: null,
          prerelease: null,
        });
    }
  }
  return evidence;
}
function classify(
  registry: ProductRegistry,
  applications: readonly InstalledApplication[],
  catalog: Catalog,
): readonly ClassifiedApplication[] {
  return applications.map((application) => ({
    application,
    match: matchProduct(registry, application.id, application.vendor),
    update:
      catalog.comparisons.find((item) => item.appId === application.id) ?? null,
  }));
}
function publicPlan(plan: InstallationPlanV2): PublicInstallationPlanDto {
  const artifact = {
    filename: plan.artifact.filename,
    sha256: plan.artifact.sha256,
    size: plan.artifact.size,
    appId: plan.artifact.appId,
    title: plan.artifact.title,
    version: plan.artifact.version,
    deploymentClass: plan.artifact.deploymentClass,
    trustLevel: plan.artifact.trustLevel,
  };
  return { ...plan, artifact, proposedCommand: null };
}

export class WebManagerApi {
  private latestPlanValue: PublicInstallationPlanDto | null = null;
  constructor(readonly mock = false) {}

  private async buildCatalog(
    applications: readonly InstalledApplication[],
    includeRemote = true,
  ): Promise<Catalog> {
    if (this.mock) return mockCatalog;
    const sources = await loadCatalogSources();
    return new CatalogService().build({
      ...sources,
      installedApplications: applications,
      cacheRecords: await cacheRecords(),
      ...(includeRemote
        ? { remoteEvidence: await remoteEvidence(sources.releases) }
        : {}),
    });
  }

  async dashboard(): Promise<DashboardDto> {
    if (this.mock) return mockDashboard;
    const sources = await loadCatalogSources();
    const client = adapter();
    const devices = await client.listDevices();
    const selected = (devices.find((d) => d.isDefault)?.alias ??
      devices[0]?.alias ??
      "tv") as DeviceAlias;
    let inventory: InventorySnapshot = {
      device: selected,
      timestamp: new Date().toISOString(),
      source: "ares-install-listfull",
      applications: [],
    };
    let status: DeveloperModeStatus | null = null;
    try {
      [inventory, status] = await Promise.all([
        client.listInstalledApplications(selected),
        client.status(selected),
      ]);
    } catch {
      /* Dashboard remains useful while a TV is offline. */
    }
    const catalog = await this.buildCatalog(inventory.applications, false);
    const detailed = await Promise.all(
      devices.map(async (device) => {
        try {
          return {
            ...device,
            connectionStatus: (await client.inspectDevice(device.alias)).health
              .connectionStatus,
          };
        } catch {
          return { ...device, connectionStatus: "unreachable" as const };
        }
      }),
    );
    return {
      mode: "REAL",
      devices: detailed,
      selectedDevice: selected,
      applications: classify(sources.registry, inventory.applications, catalog),
      products: catalog.summary.managedProducts,
      releases: catalog.products.flatMap((product) => product.releases).length,
      verifiedCacheEntries: catalog.summary.verifiedArtifacts,
      updatesAvailable: catalog.summary.updatesAvailable,
      receiptCount: (await new FileReceiptStore().list()).length,
      developerMode: status,
      generatedAt: new Date().toISOString(),
    };
  }

  async device(alias: string): Promise<DeviceDetailDto> {
    if (this.mock)
      return alias === "bedroom"
        ? {
            ...mockDevice,
            device: {
              ...mockDevice.device,
              alias: validateDeviceAlias("bedroom"),
              health: {
                ...mockDevice.device.health,
                connectionStatus: "unreachable",
              },
            },
          }
        : mockDevice;
    const device = validateDeviceAlias(alias);
    const client = adapter();
    const sources = await loadCatalogSources();
    const [detail, inventory, status] = await Promise.all([
      client.inspectDevice(device),
      client.listInstalledApplications(device),
      client.status(device),
    ]);
    const catalog = await this.buildCatalog(inventory.applications, false);
    return {
      device: detail,
      applications: classify(sources.registry, inventory.applications, catalog),
      developerMode: status,
    };
  }

  async catalog(): Promise<Catalog> {
    if (this.mock) return mockCatalog;
    const client = adapter();
    const devices = await client.listDevices();
    const selected =
      devices.find((item) => item.isDefault)?.alias ?? devices[0]?.alias;
    let applications: readonly InstalledApplication[] = [];
    if (selected !== undefined)
      try {
        applications = (await client.listInstalledApplications(selected))
          .applications;
      } catch {
        /* Catalog remains available without device inventory. */
      }
    return this.buildCatalog(applications);
  }

  async catalogProduct(productId: string) {
    validateLogicalId(productId, "productId");
    const product = (await this.catalog()).products.find(
      (item) => item.productId === productId,
    );
    if (product === undefined)
      throw new PlatformError(
        "CATALOG_PRODUCT_NOT_FOUND",
        "Catalog product was not found.",
      );
    return product;
  }

  async catalogRelease(productId: string, releaseId: string) {
    validateLogicalId(releaseId, "releaseId");
    const release = (await this.catalogProduct(productId)).releases.find(
      (item) => item.releaseId === releaseId,
    );
    if (release === undefined)
      throw new PlatformError(
        "CATALOG_RELEASE_NOT_FOUND",
        "Catalog release was not found.",
      );
    return release;
  }

  async fetchCatalogArtifact(
    request: CatalogSelectionRequest,
  ): Promise<CatalogFetchResultDto> {
    validateLogicalId(request.productId, "productId");
    validateLogicalId(request.releaseId, "releaseId");
    validateLogicalId(request.artifactId, "artifactId");
    if (this.mock) {
      if (request.productId !== mockFetchResult.productId)
        throw new PlatformError(
          "CATALOG_PRODUCT_NOT_FOUND",
          "Catalog product was not found.",
        );
      if (request.releaseId !== mockFetchResult.releaseId)
        throw new PlatformError(
          "CATALOG_RELEASE_NOT_FOUND",
          "Catalog release was not found.",
        );
      if (request.artifactId !== mockFetchResult.artifactId)
        throw new PlatformError(
          "ARTIFACT_NOT_AVAILABLE",
          "Catalog artifact was not found.",
        );
      return mockFetchResult;
    }
    const sources = await loadCatalogSources();
    const product = sources.registry.products.find(
      (item) => item.id === request.productId,
    );
    if (product === undefined)
      throw new PlatformError(
        "CATALOG_PRODUCT_NOT_FOUND",
        "Catalog product was not found.",
      );
    const release = sources.releases.find(
      (item) =>
        item.productId === request.productId &&
        item.releaseRef === request.releaseId,
    );
    if (release === undefined)
      throw new PlatformError(
        "CATALOG_RELEASE_NOT_FOUND",
        "Catalog release was not found.",
      );
    const artifact = release.artifacts.find(
      (item) => item.artifactId === request.artifactId,
    );
    if (
      artifact === undefined ||
      artifact.source.type !== "GITHUB_RELEASE" ||
      release.releaseRef === undefined
    )
      throw new PlatformError(
        "ARTIFACT_NOT_AVAILABLE",
        "Catalog artifact is not available from the trusted provider.",
      );
    try {
      const result = await distribution().fetch({
        repository: repositoryIdentity(product.repository),
        tag: release.releaseRef,
        artifactId: artifact.artifactId,
        trustStore: await loadTrustStore(),
      });
      return {
        productId: product.id,
        releaseId: release.releaseRef,
        artifactId: result.artifactId,
        filename: artifact.filename,
        sha256: result.sha256,
        trust: "SIGNED",
        trustDecision: "SIGNED_TRUSTED",
        signingKeyId: result.keyId,
        cacheAvailability: "CACHED_VERIFIED",
      };
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      throw new PlatformError(
        "ARTIFACT_FETCH_FAILED",
        "Trusted artifact download and verification failed.",
      );
    }
  }

  async planCatalog(
    request: CatalogPlanRequest,
  ): Promise<PublicInstallationPlanDto> {
    validateLogicalId(request.productId, "productId");
    validateLogicalId(request.releaseId, "releaseId");
    validateLogicalId(request.artifactId, "artifactId");
    validateDeviceAlias(request.device);
    if (this.mock) {
      await this.fetchCatalogArtifact(request);
      this.latestPlanValue = mockPlan;
      return mockPlan;
    }
    const sources = await loadCatalogSources();
    const release = sources.releases.find(
      (item) =>
        item.productId === request.productId &&
        item.releaseRef === request.releaseId,
    );
    if (release === undefined)
      throw new PlatformError(
        "CATALOG_RELEASE_NOT_FOUND",
        "Catalog release was not found.",
      );
    const artifact = release.artifacts.find(
      (item) => item.artifactId === request.artifactId,
    );
    if (artifact === undefined)
      throw new PlatformError(
        "ARTIFACT_NOT_AVAILABLE",
        "Catalog artifact was not found.",
      );
    const cached = await distribution().verifyCached(
      artifact.hash.digest,
      await loadTrustStore(),
    );
    if (cached.artifactId !== artifact.artifactId)
      throw new PlatformError(
        "ARTIFACT_VERIFICATION_FAILED",
        "Verified cache identity does not match the catalog selection.",
      );
    const inspection = await inspectIpk(cached.artifactPath);
    const manifest = inspection.manifests[0];
    if (manifest === undefined)
      throw new PlatformError(
        "PACKAGE_METADATA_INVALID",
        "Cached artifact has no application manifest.",
      );
    const client = adapter();
    const device = validateDeviceAlias(request.device);
    const [detail, inventory] = await Promise.all([
      client.inspectDevice(device),
      client.listInstalledApplications(device),
    ]);
    const plan = createInstallationPlan({
      package: inspection,
      registry: sources.registry,
      inventory,
      connectionStatus: detail.health.connectionStatus,
      artifactVerification: verifyArtifactMetadata(sources.releases, {
        filename: artifact.filename,
        sha256: inspection.hash.digest,
        size: inspection.size,
        appId: manifest.id,
        version: manifest.version,
      }),
      signedDistributionTrusted: true,
    });
    this.latestPlanValue = publicPlan(plan);
    return this.latestPlanValue;
  }

  async cache(): Promise<readonly CacheDto[]> {
    if (this.mock)
      return [
        {
          digest: mockFetchResult.sha256,
          filename: mockFetchResult.filename,
          productId: mockFetchResult.productId,
          release: mockFetchResult.releaseId,
          trustDecision: mockFetchResult.trustDecision,
          signingKey: mockFetchResult.signingKeyId,
          verifiedAt: "2026-10-02T20:05:00.000Z",
        },
      ];
    const catalog = await this.buildCatalog([], false);
    return catalog.products.flatMap((product) =>
      product.releases.flatMap((release) =>
        release.artifacts
          .filter(
            (artifact) => artifact.cacheAvailability === "CACHED_VERIFIED",
          )
          .map((artifact) => ({
            digest: artifact.sha256,
            filename: artifact.filename,
            productId: product.productId,
            release: release.releaseId,
            trustDecision: "SIGNED_TRUSTED",
            signingKey: artifact.signingKeyId ?? "UNKNOWN",
            verifiedAt: artifact.verifiedAt ?? "UNKNOWN",
          })),
      ),
    );
  }

  async receipts(): Promise<readonly ReceiptDto[]> {
    if (this.mock) return mockReceipts;
    const results: ReceiptDto[] = [];
    for (const path of await new FileReceiptStore().list()) {
      try {
        const receipt = sanitizeReceipt(
          JSON.parse(await readFile(path, "utf8")) as unknown,
        );
        if (receipt !== null) results.push(receipt);
      } catch {
        continue;
      }
    }
    return results;
  }

  async inspectUpload(
    filename: string,
    bytes: Buffer,
  ): Promise<PackageResultDto> {
    if (bytes.length === 0 || bytes.length > 512 * 1024 * 1024)
      throw new PlatformError(
        "PACKAGE_TOO_LARGE",
        "Package upload size is invalid.",
      );
    const safe = basename(filename).replace(/[^A-Za-z0-9._-]/gu, "_");
    if (!safe.endsWith(".ipk"))
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "Only .ipk packages are accepted.",
      );
    await mkdir(uploads, { recursive: true });
    const id = randomUUID();
    const path = join(uploads, `${id}-${safe}`);
    await writeFile(path, bytes, { flag: "wx" });
    uploadIndex.set(id, path);
    const inspection = await inspectIpk(path);
    const { registry, releases } = await loadCatalogSources();
    const manifest = inspection.manifests[0];
    return {
      inspectionId: id,
      inspection,
      registryMatch:
        manifest === undefined
          ? null
          : matchProduct(registry, manifest.id, manifest.vendor),
      verification:
        manifest === undefined
          ? null
          : verifyArtifactMetadata(releases, {
              filename: safe,
              sha256: inspection.hash.digest,
              size: inspection.size,
              appId: manifest.id,
              version: manifest.version,
            }),
    };
  }

  async plan(request: PlanRequest): Promise<PublicInstallationPlanDto> {
    const path = uploadIndex.get(request.inspectionId);
    if (path === undefined)
      throw new PlatformError(
        "PACKAGE_METADATA_INVALID",
        "Package inspection session is missing or expired.",
      );
    const device = validateDeviceAlias(request.device);
    const inspection = await inspectIpk(path);
    const manifest = inspection.manifests[0];
    if (manifest === undefined)
      throw new PlatformError(
        "PACKAGE_METADATA_INVALID",
        "Exactly one app manifest is required.",
      );
    const { registry, releases } = await loadCatalogSources();
    const client = adapter();
    const [detail, inventory] = await Promise.all([
      client.inspectDevice(device),
      client.listInstalledApplications(device),
    ]);
    const plan = createInstallationPlan({
      package: inspection,
      registry,
      inventory,
      connectionStatus: detail.health.connectionStatus,
      artifactVerification: verifyArtifactMetadata(releases, {
        filename: basename(path).replace(/^[0-9a-f-]+-/u, ""),
        sha256: inspection.hash.digest,
        size: inspection.size,
        appId: manifest.id,
        version: manifest.version,
      }),
    });
    this.latestPlanValue = publicPlan(plan);
    return this.latestPlanValue;
  }

  latestPlan(): PublicInstallationPlanDto | null {
    return this.latestPlanValue;
  }
}

export function sanitizeReceipt(value: unknown): ReceiptDto | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (
    typeof r.timestamp !== "string" ||
    typeof r.deviceAlias !== "string" ||
    typeof r.appId !== "string" ||
    typeof r.version !== "string"
  )
    return null;
  const trust = [
    "UNVERIFIED",
    "REGISTRY_MATCH",
    "REPOSITORY_PINNED_HASH",
    "SIGNED",
  ].includes(String(r.trustLevel))
    ? (r.trustLevel as ReceiptDto["trust"])
    : "UNVERIFIED";
  return {
    timestamp: r.timestamp,
    device: r.deviceAlias,
    app: r.appId,
    version: r.version,
    trust,
    result: typeof r.result === "string" ? r.result : "UNKNOWN",
    postInstallVerified: r.postInstallVerified === true,
  };
}
export function errorAction(code: string): string | null {
  return (
    (
      {
        DEVICE_NOT_FOUND: "Check the configured device alias.",
        DEVICE_UNREACHABLE:
          "Confirm the TV and PC are on the same network, then refresh.",
        WEBOS_CLI_NOT_FOUND: "Install or repair the official webOS CLI.",
        PACKAGE_METADATA_INVALID:
          "Choose a valid webOS IPK and inspect it again.",
        SIGNATURE_INVALID:
          "Do not use this artifact; verify its release source.",
        SIGNING_KEY_REVOKED: "Use a release signed by an active trusted key.",
        PLAN_STALE: "Refresh device state and generate a new plan.",
        CATALOG_PRODUCT_NOT_FOUND: "Refresh the catalog and select a product.",
        CATALOG_RELEASE_NOT_FOUND: "Refresh the selected product releases.",
        ARTIFACT_NOT_AVAILABLE: "Choose an available catalog artifact.",
        ARTIFACT_FETCH_FAILED: "Retry after checking GitHub CLI connectivity.",
        ARTIFACT_VERIFICATION_FAILED:
          "Do not use the artifact; refresh trusted release metadata.",
        CATALOG_SOURCE_INVALID: "Repair the local validated catalog metadata.",
      } as Record<string, string>
    )[code] ?? null
  );
}
