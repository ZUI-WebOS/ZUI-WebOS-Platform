import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ArtifactDistributionService,
  GitHubReleaseProvider,
} from "@zui-webos/artifact-distribution";
import { CatalogService } from "@zui-webos/catalog-service";
import type { CatalogCacheRecord } from "@zui-webos/catalog-service";
import {
  validateRegistry,
  validateReleaseRecords,
  type ProductRegistry,
  type ProductRelease,
} from "@zui-webos/catalog-contracts";
import {
  validateTrustStore,
  type PublicTrustStore,
} from "@zui-webos/signed-release";
import type { DeviceAlias, InventorySnapshot } from "@zui-webos/shared-types";
import {
  NodeProcessRunner,
  PlatformError,
  WebOSCliAdapter,
} from "@zui-webos/webos-client";
import type { TvStoreDataProvider } from "./api.js";
import type { TvStoreCatalogResponse } from "./contracts.js";
import { toTvStoreCatalog } from "./mock.js";

interface CatalogSources {
  readonly registry: ProductRegistry;
  readonly releases: readonly ProductRelease[];
}

interface InventoryReader {
  listInstalledApplications(alias: DeviceAlias): Promise<InventorySnapshot>;
}

interface LiveTvStoreDependencies {
  readonly inventory?: InventoryReader;
  readonly loadSources?: () => Promise<CatalogSources>;
  readonly loadCacheRecords?: () => Promise<readonly CatalogCacheRecord[]>;
  readonly now?: () => Date;
  readonly retryDelayMs?: number;
  readonly cacheMs?: number;
}

function repositoryUrl(path: string): URL {
  return new URL(`../../../repository/${path}`, import.meta.url);
}

export async function loadTvStoreCatalogSources(): Promise<CatalogSources> {
  const registryValue: unknown = JSON.parse(
    await readFile(repositoryUrl("apps/products.json"), "utf8"),
  );
  if (!validateRegistry(registryValue))
    throw new PlatformError(
      "CATALOG_SOURCE_INVALID",
      "Product registry is invalid.",
    );
  const entries = await readdir(repositoryUrl("releases/"), {
    recursive: true,
    withFileTypes: true,
  });
  const releases: unknown[] = [];
  for (const entry of entries)
    if (entry.isFile() && entry.name.endsWith(".json"))
      releases.push(
        JSON.parse(
          await readFile(join(entry.parentPath, entry.name), "utf8"),
        ) as unknown,
      );
  const validation = validateReleaseRecords(releases, registryValue);
  if (!validation.valid)
    throw new PlatformError(
      "CATALOG_SOURCE_INVALID",
      "Release metadata is invalid.",
    );
  return { registry: registryValue, releases: releases as ProductRelease[] };
}

async function loadPublicTrustStore(): Promise<PublicTrustStore> {
  const value: unknown = JSON.parse(
    await readFile(repositoryUrl("trust/keys.json"), "utf8"),
  );
  if (!validateTrustStore(value))
    throw new PlatformError(
      "CATALOG_SOURCE_INVALID",
      "Public signing trust store is invalid.",
    );
  return value;
}

export async function loadTvStoreCacheRecords(): Promise<
  readonly CatalogCacheRecord[]
> {
  const distribution = new ArtifactDistributionService(
    new GitHubReleaseProvider(),
  );
  const trustStore = await loadPublicTrustStore();
  const records: CatalogCacheRecord[] = [];
  for (const digest of await distribution.list()) {
    try {
      const result = await distribution.verifyCached(digest, trustStore);
      records.push({
        artifactId: result.artifactId,
        sha256: result.sha256,
        trustState: "SIGNED",
        signingKeyId: result.keyId,
        verifiedAt: new Date().toISOString(),
        cacheAvailability: "CACHED_VERIFIED",
      });
    } catch {
      // Invalid cache content is never elevated into the public projection.
    }
  }
  return records;
}

function defaultInventory(): InventoryReader {
  const client = new WebOSCliAdapter({
    runner: new NodeProcessRunner(),
    timeoutMs: 15_000,
  });
  return {
    listInstalledApplications: (alias) =>
      client.readInstalledApplications(alias),
  };
}

export class LiveTvStoreDataProvider implements TvStoreDataProvider {
  private readonly inventory: InventoryReader;
  private readonly loadSources: () => Promise<CatalogSources>;
  private readonly loadCacheRecords: () => Promise<
    readonly CatalogCacheRecord[]
  >;
  private readonly now: () => Date;
  private readonly retryDelayMs: number;
  private readonly cacheMs: number;
  private cached: {
    readonly expiresAt: number;
    readonly value: TvStoreCatalogResponse;
  } | null = null;
  private inFlight: Promise<TvStoreCatalogResponse> | null = null;

  constructor(
    private readonly deviceAlias: DeviceAlias,
    dependencies: LiveTvStoreDependencies = {},
  ) {
    this.inventory = dependencies.inventory ?? defaultInventory();
    this.loadSources = dependencies.loadSources ?? loadTvStoreCatalogSources;
    this.loadCacheRecords =
      dependencies.loadCacheRecords ?? loadTvStoreCacheRecords;
    this.now = dependencies.now ?? (() => new Date());
    this.retryDelayMs = dependencies.retryDelayMs ?? 500;
    this.cacheMs = dependencies.cacheMs ?? 300_000;
  }

  private async readInventory(): Promise<InventorySnapshot> {
    let failure: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.inventory.listInstalledApplications(this.deviceAlias);
      } catch (error) {
        failure = error;
        const code = error instanceof PlatformError ? error.code : "";
        if (
          attempt === 3 ||
          ![
            "COMMAND_TIMEOUT",
            "DEVICE_INVENTORY_FAILED",
            "DEVICE_UNREACHABLE",
          ].includes(code)
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }
    throw failure;
  }

  private async refreshCatalog(
    observedAt: Date,
  ): Promise<TvStoreCatalogResponse> {
    if (this.cached !== null && observedAt.getTime() < this.cached.expiresAt)
      return this.cached.value;
    const [sources, cacheRecords] = await Promise.all([
      this.loadSources(),
      this.loadCacheRecords(),
    ]);
    const inventory = await this.readInventory();
    const catalog = new CatalogService().build({
      ...sources,
      installedApplications: inventory.applications,
      cacheRecords,
      now: observedAt,
    });
    const value = toTvStoreCatalog(catalog, "LIVE", true);
    this.cached = {
      expiresAt: this.now().getTime() + this.cacheMs,
      value,
    };
    return value;
  }

  async catalog(): Promise<TvStoreCatalogResponse> {
    const observedAt = this.now();
    if (this.cached !== null && observedAt.getTime() < this.cached.expiresAt)
      return this.cached.value;
    if (this.inFlight !== null) return this.inFlight;
    this.inFlight = this.refreshCatalog(observedAt);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }
}
