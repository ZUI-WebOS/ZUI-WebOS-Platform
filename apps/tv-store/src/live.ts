import { randomUUID } from "node:crypto";
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
import type {
  DeviceAlias,
  InventorySnapshot,
  PlatformErrorCode,
} from "@zui-webos/shared-types";
import {
  NodeProcessRunner,
  PlatformError,
  WebOSCliAdapter,
} from "@zui-webos/webos-client";
import type { TvStoreDataProvider } from "./api.js";
import type { TvStoreCatalogResponse } from "./contracts.js";
import { toTvStoreCatalog } from "./mock.js";
import { readCatalogInvalidationSignal } from "./catalog-invalidation.js";

export interface CatalogSources {
  readonly registry: ProductRegistry;
  readonly releases: readonly ProductRelease[];
}

export interface InventoryReader {
  listInstalledApplications(alias: DeviceAlias): Promise<InventorySnapshot>;
}

export interface InventoryResilienceEvent {
  readonly requestId: string;
  readonly deviceAlias: DeviceAlias;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly result: "COALESCED" | "PASS" | "RETRY" | "FAIL";
  readonly errorCode: PlatformErrorCode | null;
  readonly processExitCode: number | null;
  readonly durationMs: number;
}

interface ResilientInventoryOptions {
  readonly maxAttempts?: number;
  readonly retryDelayMs?: number;
  readonly sleep?: (delayMs: number) => Promise<void>;
  readonly requestId?: () => string;
  readonly onEvent?: (event: InventoryResilienceEvent) => void;
}

const TRANSIENT_INVENTORY_ERRORS = new Set<PlatformErrorCode>([
  "COMMAND_TIMEOUT",
  "DEVICE_INVENTORY_FAILED",
  "DEVICE_UNREACHABLE",
]);

function processExitCode(error: PlatformError): number | null {
  const match = /^exitCode=(?<code>-?\d+)$/u.exec(error.detail ?? "");
  return match?.groups?.code === undefined ? null : Number(match.groups.code);
}

/**
 * Provides fresh, device-scoped inventory acquisition without a data cache.
 * Concurrent callers share one operation, while transient LG CLI failures are
 * retried with bounded backoff. Integrity and parsing failures never retry.
 */
export class ResilientDeviceInventory implements InventoryReader {
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly createRequestId: () => string;
  private readonly onEvent: (event: InventoryResilienceEvent) => void;
  private readonly inFlight = new Map<
    DeviceAlias,
    { readonly requestId: string; readonly promise: Promise<InventorySnapshot> }
  >();

  constructor(
    private readonly reader: InventoryReader,
    options: ResilientInventoryOptions = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.sleep =
      options.sleep ??
      ((delayMs) =>
        new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        }));
    this.createRequestId = options.requestId ?? randomUUID;
    this.onEvent = options.onEvent ?? (() => undefined);
  }

  listInstalledApplications(alias: DeviceAlias): Promise<InventorySnapshot> {
    const existing = this.inFlight.get(alias);
    if (existing !== undefined) {
      this.onEvent({
        requestId: existing.requestId,
        deviceAlias: alias,
        attempt: 0,
        maxAttempts: this.maxAttempts,
        result: "COALESCED",
        errorCode: null,
        processExitCode: null,
        durationMs: 0,
      });
      return existing.promise;
    }
    const requestId = this.createRequestId();
    const promise = this.readFresh(alias, requestId).finally(() => {
      if (this.inFlight.get(alias)?.promise === promise)
        this.inFlight.delete(alias);
    });
    this.inFlight.set(alias, { requestId, promise });
    return promise;
  }

  private async readFresh(
    alias: DeviceAlias,
    requestId: string,
  ): Promise<InventorySnapshot> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const started = performance.now();
      try {
        const value = await this.reader.listInstalledApplications(alias);
        this.onEvent({
          requestId,
          deviceAlias: alias,
          attempt,
          maxAttempts: this.maxAttempts,
          result: "PASS",
          errorCode: null,
          processExitCode: null,
          durationMs: Math.round(performance.now() - started),
        });
        return value;
      } catch (error: unknown) {
        const code = error instanceof PlatformError ? error.code : null;
        const retry =
          code !== null &&
          TRANSIENT_INVENTORY_ERRORS.has(code) &&
          attempt < this.maxAttempts;
        this.onEvent({
          requestId,
          deviceAlias: alias,
          attempt,
          maxAttempts: this.maxAttempts,
          result: retry ? "RETRY" : "FAIL",
          errorCode: code,
          processExitCode:
            error instanceof PlatformError ? processExitCode(error) : null,
          durationMs: Math.round(performance.now() - started),
        });
        if (!retry) throw error;
        await this.sleep(this.retryDelayMs * 2 ** (attempt - 1));
      }
    }
    throw new Error("Unreachable inventory retry state.");
  }
}

interface LiveTvStoreDependencies {
  readonly inventory?: InventoryReader;
  readonly loadSources?: () => Promise<CatalogSources>;
  readonly loadCacheRecords?: () => Promise<readonly CatalogCacheRecord[]>;
  readonly now?: () => Date;
  readonly retryDelayMs?: number;
  readonly cacheMs?: number;
  readonly readInvalidationSignal?: () => Promise<string>;
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

export async function loadPublicTrustStore(): Promise<PublicTrustStore> {
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
  private readonly cacheMs: number;
  private readonly readInvalidationSignal: () => Promise<string>;
  private invalidationSignal: string | null = null;
  private cached: {
    readonly expiresAt: number;
    readonly value: TvStoreCatalogResponse;
  } | null = null;
  private inFlight: Promise<TvStoreCatalogResponse> | null = null;

  constructor(
    private readonly deviceAlias: DeviceAlias,
    dependencies: LiveTvStoreDependencies = {},
  ) {
    this.inventory = new ResilientDeviceInventory(
      dependencies.inventory ?? defaultInventory(),
      dependencies.retryDelayMs === undefined
        ? {}
        : { retryDelayMs: dependencies.retryDelayMs },
    );
    this.loadSources = dependencies.loadSources ?? loadTvStoreCatalogSources;
    this.loadCacheRecords =
      dependencies.loadCacheRecords ?? loadTvStoreCacheRecords;
    this.now = dependencies.now ?? (() => new Date());
    this.cacheMs = dependencies.cacheMs ?? 300_000;
    this.readInvalidationSignal =
      dependencies.readInvalidationSignal ?? readCatalogInvalidationSignal;
  }

  private async readInventory(): Promise<InventorySnapshot> {
    return this.inventory.listInstalledApplications(this.deviceAlias);
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
    const signal = await this.readInvalidationSignal();
    if (this.invalidationSignal === null) this.invalidationSignal = signal;
    else if (signal !== this.invalidationSignal) {
      this.invalidationSignal = signal;
      this.cached = null;
    }
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
