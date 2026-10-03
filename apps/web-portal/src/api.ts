import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import {
  matchProduct,
  validateRegistry,
  validateReleaseRecords,
  verifyArtifactMetadata,
  type ProductRegistry,
  type ProductRelease,
} from "@zui-webos/catalog-contracts";
import { createInstallationPlan } from "@zui-webos/installation-planner";
import type { InstallationPlanV2 } from "@zui-webos/installation-planner";
import { FileReceiptStore } from "@zui-webos/installer-service";
import { inspectIpk } from "@zui-webos/package-inspector";
import type {
  DeveloperModeStatus,
  DeviceAlias,
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
  CatalogDto,
  DashboardDto,
  DeviceDetailDto,
  PackageResultDto,
  PlanRequest,
  ReceiptDto,
} from "./contracts.js";
import {
  mockDashboard,
  mockDevice,
  mockReceipts,
  mockRegistry,
  mockRelease,
} from "./mock.js";

const localBase = join(
  process.env.LOCALAPPDATA ?? join(homedir(), ".zui-webos"),
  ...(process.env.LOCALAPPDATA === undefined ? [] : ["ZUI-WebOS"]),
);
const uploads = join(localBase, "web-manager", "uploads");
const cacheRoot = join(localBase, "artifacts", "sha256");
const uploadIndex = new Map<string, string>();

function repoUrl(path: string): URL {
  return new URL(`../../../repository/${path}`, import.meta.url);
}
export async function loadCatalog(): Promise<CatalogDto> {
  const registryValue: unknown = JSON.parse(
    await readFile(repoUrl("apps/products.json"), "utf8"),
  );
  if (!validateRegistry(registryValue))
    throw new PlatformError("INVALID_ARGUMENT", "Product registry is invalid.");
  const root = repoUrl("releases/");
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
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
      "RELEASE_METADATA_INVALID",
      "Release metadata is invalid.",
      validation.errors.join("; "),
    );
  return { registry: registryValue, releases: values as ProductRelease[] };
}
function adapter() {
  return new WebOSCliAdapter({
    runner: new NodeProcessRunner(),
    timeoutMs: 15_000,
  });
}
function classify(
  registry: ProductRegistry,
  applications: Awaited<
    ReturnType<WebOSCliAdapter["listInstalledApplications"]>
  >["applications"],
) {
  return applications.map((application) => ({
    application,
    match: matchProduct(registry, application.id, application.vendor),
  }));
}
async function cacheEntries(): Promise<CacheDto[]> {
  try {
    const dirs = await readdir(cacheRoot, { withFileTypes: true });
    const results: CacheDto[] = [];
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      try {
        const value = JSON.parse(
          await readFile(
            join(cacheRoot, dir.name, "verified-metadata.json"),
            "utf8",
          ),
        ) as {
          release: string;
          asset: string;
          signatureKeyId: string;
          verifiedAt: string;
          trustDecision: string;
          manifest: { productId: string };
        };
        results.push({
          digest: dir.name,
          filename: value.asset,
          productId: value.manifest.productId,
          release: value.release,
          trustDecision: value.trustDecision,
          signingKey: value.signatureKeyId,
          verifiedAt: value.verifiedAt,
        });
      } catch {
        continue;
      }
    }
    return results;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
export class WebManagerApi {
  private latestPlanValue: InstallationPlanV2 | null = null;
  constructor(readonly mock = false) {}
  async dashboard(): Promise<DashboardDto> {
    if (this.mock) return mockDashboard;
    const { registry, releases } = await loadCatalog();
    const client = adapter();
    const devices = await client.listDevices();
    const selected = (devices.find((d) => d.isDefault)?.alias ??
      devices[0]?.alias ??
      "tv") as DeviceAlias;
    let inventory: InventorySnapshot = {
      device: selected,
      timestamp: new Date().toISOString(),
      source: "ares-install-listfull" as const,
      applications: [],
    };
    let status: DeveloperModeStatus | null = null;
    try {
      [inventory, status] = await Promise.all([
        client.listInstalledApplications(selected),
        client.status(selected),
      ]);
    } catch {
      /* dashboard remains useful when TV is offline */
    }
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
      applications: classify(registry, inventory.applications),
      products: registry.products.length,
      releases: releases.length,
      verifiedCacheEntries: (await cacheEntries()).length,
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
    const { registry } = await loadCatalog();
    const [detail, inventory, status] = await Promise.all([
      client.inspectDevice(device),
      client.listInstalledApplications(device),
      client.status(device),
    ]);
    return {
      device: detail,
      applications: classify(registry, inventory.applications),
      developerMode: status,
    };
  }
  catalog(): Promise<CatalogDto> {
    return this.mock
      ? Promise.resolve({ registry: mockRegistry, releases: [mockRelease] })
      : loadCatalog();
  }
  cache(): Promise<readonly CacheDto[]> {
    return this.mock
      ? Promise.resolve([
          {
            digest:
              "816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4",
            filename: "com.zui.webos.youtube.staging_0.8.4_all.ipk",
            productId: "zui-youtube-webos",
            release: "zui-staging-0.8.4-acceptance",
            trustDecision: "SIGNED_TRUSTED",
            signingKey: "9A88FF6A…9648",
            verifiedAt: "2026-10-02T20:05:00.000Z",
          },
        ])
      : cacheEntries();
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
    const { registry, releases } = await loadCatalog();
    const manifest =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
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
  async plan(request: PlanRequest) {
    const path = uploadIndex.get(request.inspectionId);
    if (path === undefined)
      throw new PlatformError(
        "PACKAGE_METADATA_INVALID",
        "Package inspection session is missing or expired.",
      );
    const device = validateDeviceAlias(request.device);
    const inspection = await inspectIpk(path);
    const manifest =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    if (manifest === undefined)
      throw new PlatformError(
        "PACKAGE_METADATA_INVALID",
        "Exactly one app manifest is required.",
      );
    const { registry, releases } = await loadCatalog();
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
    this.latestPlanValue = plan;
    return plan;
  }
  latestPlan(): InstallationPlanV2 | null {
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
      } as Record<string, string>
    )[code] ?? null
  );
}
