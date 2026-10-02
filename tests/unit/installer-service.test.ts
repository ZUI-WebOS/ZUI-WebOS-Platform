import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";
import {
  validateRegistry,
  verifyArtifactMetadata,
  type ProductRegistry,
  type ProductRelease,
} from "@zui-webos/catalog-contracts";
import {
  calculatePlanDigest,
  createInstallationPlan,
  validatePlanDigest,
} from "@zui-webos/installation-planner";
import {
  InstallerService,
  type InstallationReceipt,
  type InstallerAdapter,
  type ReceiptStore,
} from "@zui-webos/installer-service";
import { inspectIpk } from "@zui-webos/package-inspector";
import type {
  ApplicationVersion,
  CommandResult,
  DeviceAlias,
  InstalledApplicationId,
  InventorySnapshot,
} from "@zui-webos/shared-types";
import { createIpk, manifest } from "../helpers/ipk-fixture.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

class MemoryReceiptStore implements ReceiptStore {
  readonly receipts: InstallationReceipt[] = [];
  async write(receipt: InstallationReceipt): Promise<string> {
    this.receipts.push(receipt);
    return "memory://receipt.json";
  }
  async list(): Promise<readonly string[]> {
    return this.receipts.map(() => "memory://receipt.json");
  }
  async hasPlanDigest(planDigest: string): Promise<boolean> {
    return this.receipts.some((receipt) => receipt.planDigest === planDigest);
  }
}

function inventory(
  device = "tv",
  stagingVersion: string | null = "0.8.4",
): InventorySnapshot {
  const application = (id: string, version: string) => ({
    id: id as InstalledApplicationId,
    version: version as ApplicationVersion,
    source: "ares-install-listfull" as const,
    metadata: {},
  });
  return {
    device: device as DeviceAlias,
    timestamp: "2026-10-02T00:00:00.000Z",
    source: "ares-install-listfull",
    applications: [
      ...(stagingVersion === null
        ? []
        : [application("com.zui.webos.youtube.staging", stagingVersion)]),
      application("com.zui.player", "1.0.1"),
      application("youtube.leanback.v4", "0.8.3"),
    ],
  };
}

class FakeAdapter implements InstallerAdapter {
  installs = 0;
  constructor(
    public current: InventorySnapshot,
    public after: InventorySnapshot | Error = current,
  ) {}
  async listInstalledApplications(): Promise<InventorySnapshot> {
    if (this.installs === 0) return this.current;
    if (this.after instanceof Error) throw this.after;
    return this.after;
  }
  async installPackage(
    _device: DeviceAlias,
    path: string,
  ): Promise<CommandResult> {
    this.installs += 1;
    return {
      executable: "ares-install",
      args: [path, "--device", "tv"],
      exitCode: 0,
      stdout: "Success",
      stderr: "",
      durationMs: 1,
      timedOut: false,
    };
  }
}

async function setup(
  options: { appId?: string; version?: string; now?: Date } = {},
) {
  const appId = options.appId ?? "com.zui.webos.youtube.staging";
  const version = options.version ?? "0.8.4";
  const directory = await mkdtemp(join(tmpdir(), "zui-installer-test-"));
  directories.push(directory);
  const filename = `${appId}_${version}_all.ipk`;
  const path = join(directory, filename);
  await writeFile(
    path,
    createIpk([
      { path: "appinfo.json", content: manifest({ id: appId, version }) },
    ]),
  );
  const inspection = await inspectIpk(path);
  const registryValue: unknown = JSON.parse(
    await readFile(
      new URL("../../repository/apps/products.json", import.meta.url),
      "utf8",
    ),
  );
  if (!validateRegistry(registryValue))
    throw new Error("Invalid product registry");
  const registry: ProductRegistry = registryValue;
  const deploymentClass =
    appId === "com.zui.webos.youtube.staging" ? "staging" : "production";
  const release: ProductRelease = {
    schemaVersion: 1,
    productId:
      appId === "com.zui.player" ? "zui-iptv-player" : "zui-youtube-webos",
    version,
    channel: deploymentClass === "staging" ? "staging" : "stable",
    sourceRepository:
      appId === "com.zui.player"
        ? "https://github.com/ZUI-WebOS/ZUI-IPTV-Player"
        : "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
    artifacts: [
      {
        artifactId: `test-${appId}`,
        filename,
        appId,
        version,
        deploymentClass,
        size: inspection.size,
        hash: { algorithm: "sha256", digest: inspection.hash.digest },
        source: {
          type: "LOCAL_VERIFIED",
          repository:
            appId === "com.zui.player"
              ? "https://github.com/ZUI-WebOS/ZUI-IPTV-Player"
              : "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
        },
      },
    ],
  };
  const item = inspection.manifests[0];
  if (item === undefined) throw new Error("Missing manifest");
  const verification = verifyArtifactMetadata([release], {
    filename,
    sha256: inspection.hash.digest,
    size: inspection.size,
    appId: item.id,
    version: item.version,
  });
  const plan = createInstallationPlan({
    package: inspection,
    registry,
    inventory: inventory(),
    connectionStatus: "reachable",
    artifactVerification: verification,
    now: options.now ?? new Date("2026-10-02T00:00:00.000Z"),
  });
  return { path, plan, release, registry };
}

describe("approval-gated installer", () => {
  it("allows an exact current pinned staging plan and writes a verified receipt", async () => {
    const { plan, release } = await setup();
    const adapter = new FakeAdapter(inventory());
    const receipts = new MemoryReceiptStore();
    const result = await new InstallerService(
      adapter,
      receipts,
      () => new Date("2026-10-02T00:01:00.000Z"),
    ).execute(plan, plan.planDigest, [release]);
    expect(result).toMatchObject({
      commandAccepted: true,
      postInstallVerified: true,
      installedAppId: "com.zui.webos.youtube.staging",
    });
    expect(adapter.installs).toBe(1);
    expect(receipts.receipts[0]).toMatchObject({
      approvalValidated: true,
      postInstallVerified: true,
      artifactSha256: plan.artifact.sha256,
    });
    await expect(
      new InstallerService(
        adapter,
        receipts,
        () => new Date("2026-10-02T00:02:00.000Z"),
      ).execute(plan, plan.planDigest, [release]),
    ).rejects.toMatchObject({ code: "PLAN_STALE" });
    expect(adapter.installs).toBe(1);
  });

  it.each(["youtube.leanback.v4", "com.zui.player"])(
    "independently blocks production %s",
    async (appId) => {
      const { plan, release } = await setup({ appId });
      const adapter = new FakeAdapter(inventory());
      await expect(
        new InstallerService(
          adapter,
          new MemoryReceiptStore(),
          () => new Date("2026-10-02T00:01:00.000Z"),
        ).execute(plan, plan.planDigest, [release]),
      ).rejects.toMatchObject({ code: "INSTALL_POLICY_BLOCKED" });
      expect(plan.executable).toBe(false);
      expect(adapter.installs).toBe(0);
      const forgedBase = { ...plan, executable: true };
      const forged = {
        ...forgedBase,
        planDigest: calculatePlanDigest(forgedBase),
      };
      await expect(
        new InstallerService(
          adapter,
          new MemoryReceiptStore(),
          () => new Date("2026-10-02T00:01:00.000Z"),
        ).execute(forged, forged.planDigest, [release]),
      ).rejects.toMatchObject({ code: "INSTALL_POLICY_BLOCKED" });
      expect(adapter.installs).toBe(0);
    },
  );

  it("rejects wrong approval, expiry, and changed installed state before mutation", async () => {
    const { plan, release } = await setup();
    for (const [approval, now, state, code] of [
      [
        "0".repeat(64),
        "2026-10-02T00:01:00.000Z",
        inventory(),
        "APPROVAL_REQUIRED",
      ],
      [
        plan.planDigest,
        "2026-10-02T00:20:00.000Z",
        inventory(),
        "PLAN_EXPIRED",
      ],
      [
        plan.planDigest,
        "2026-10-02T00:01:00.000Z",
        inventory("tv", "0.8.3"),
        "PLAN_STALE",
      ],
      [
        plan.planDigest,
        "2026-10-02T00:01:00.000Z",
        inventory("other"),
        "PLAN_STALE",
      ],
    ] as const) {
      const adapter = new FakeAdapter(state);
      await expect(
        new InstallerService(
          adapter,
          new MemoryReceiptStore(),
          () => new Date(now),
        ).execute(plan, approval, [release]),
      ).rejects.toMatchObject({ code });
      expect(adapter.installs).toBe(0);
    }
  });

  it("rejects semantic plan edits regardless of JSON key order", async () => {
    const { plan, release } = await setup();
    expect(
      validatePlanDigest({ ...plan, comparison: { ...plan.comparison } }),
    ).toBe(true);
    for (const changed of [
      { ...plan, deviceAlias: "other" },
      { ...plan, executable: false },
      { ...plan, expiresAt: "2099-01-01T00:00:00.000Z" },
      { ...plan, artifact: { ...plan.artifact, path: "C:\\substitute.ipk" } },
      { ...plan, artifact: { ...plan.artifact, sha256: "0".repeat(64) } },
      { ...plan, riskFlags: [] },
      { ...plan, policyDecision: "BLOCK" as const },
    ]) {
      const adapter = new FakeAdapter(inventory());
      await expect(
        new InstallerService(
          adapter,
          new MemoryReceiptStore(),
          () => new Date("2026-10-02T00:01:00.000Z"),
        ).execute(changed, plan.planDigest, [release]),
      ).rejects.toMatchObject({ code: "PLAN_TAMPERED" });
      expect(adapter.installs).toBe(0);
    }
    expect(calculatePlanDigest(plan)).toBe(plan.planDigest);
  });

  it("rehashes and rejects a same-size package replacement before mutation", async () => {
    const { path, plan, release } = await setup();
    const bytes = await readFile(path);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    await writeFile(path, bytes);
    const adapter = new FakeAdapter(inventory());
    await expect(
      new InstallerService(
        adapter,
        new MemoryReceiptStore(),
        () => new Date("2026-10-02T00:01:00.000Z"),
      ).execute(plan, plan.planDigest, [release]),
    ).rejects.toBeDefined();
    expect(adapter.installs).toBe(0);
  });

  it("writes a failure receipt when post-install inventory cannot be read", async () => {
    const { plan, release } = await setup();
    const receipts = new MemoryReceiptStore();
    const adapter = new FakeAdapter(inventory(), new Error("offline"));
    await expect(
      new InstallerService(
        adapter,
        receipts,
        () => new Date("2026-10-02T00:01:00.000Z"),
      ).execute(plan, plan.planDigest, [release]),
    ).rejects.toMatchObject({ code: "INSTALL_VERIFICATION_FAILED" });
    expect(receipts.receipts[0]).toMatchObject({
      result: "FAILED",
      postInstallVerified: false,
    });
  });

  it("blocks unpinned staging metadata and identity/hash mismatches at planning", async () => {
    const { plan, path, registry } = await setup();
    const inspection = await inspectIpk(path);
    const manifestValue = inspection.manifests[0];
    if (manifestValue === undefined) throw new Error("Missing manifest");
    const mismatch = verifyArtifactMetadata([], {
      filename: inspection.filename,
      sha256: inspection.hash.digest,
      size: inspection.size,
      appId: manifestValue.id,
      version: manifestValue.version,
    });
    const blocked = createInstallationPlan({
      package: inspection,
      registry,
      inventory: inventory(),
      connectionStatus: "reachable",
      artifactVerification: mismatch,
    });
    expect(blocked).toMatchObject({
      executable: false,
      policyDecision: "BLOCK",
    });
    expect(plan.executable).toBe(true);
  });
});
