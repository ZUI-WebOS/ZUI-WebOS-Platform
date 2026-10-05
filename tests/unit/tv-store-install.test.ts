import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DistributionResult } from "@zui-webos/artifact-distribution";
import type {
  ProductRegistry,
  ProductRelease,
} from "@zui-webos/catalog-contracts";
import type { InstallationPhase } from "@zui-webos/installer-service";
import { inspectIpk } from "@zui-webos/package-inspector";
import type {
  ApplicationVersion,
  DeviceAlias,
  InstalledApplicationId,
  InventorySnapshot,
} from "@zui-webos/shared-types";
import { PlatformError, validateDeviceAlias } from "@zui-webos/webos-client";
import { loadTvStoreInstallConfig } from "../../apps/tv-store/src/install-config.js";
import {
  createResilientDeviceInstallerAdapter,
  InstallServiceError,
  StagingInstallCoordinator,
  type InstallerExecutor,
} from "../../apps/tv-store/src/install.js";
import { createTvStoreInstallServer } from "../../apps/tv-store/src/install-server.js";
import type { CatalogSources } from "../../apps/tv-store/src/live.js";
import { createIpk, manifest } from "../helpers/ipk-fixture.js";

const directories: string[] = [];
const servers: ReturnType<typeof createTvStoreInstallServer>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

function inventory(stagingVersion: string | null = null): InventorySnapshot {
  const app = (id: string, version: string) => ({
    id: id as InstalledApplicationId,
    version: version as ApplicationVersion,
    source: "ares-install-listfull" as const,
    metadata: {},
  });
  return {
    device: validateDeviceAlias("tv"),
    timestamp: "2026-10-05T09:00:00.000Z",
    source: "ares-install-listfull",
    applications: [
      app("com.zui.player", "1.0.1"),
      app("youtube.leanback.v4", "0.8.3"),
      ...(stagingVersion === null
        ? []
        : [app("com.zui.webos.youtube.staging", stagingVersion)]),
    ],
  };
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "zui-store-install-"));
  directories.push(directory);
  const filename = "com.zui.webos.youtube.staging_0.8.4_all.ipk";
  const path = join(directory, filename);
  await writeFile(
    path,
    createIpk([
      {
        path: "appinfo.json",
        content: manifest({
          id: "com.zui.webos.youtube.staging",
          version: "0.8.4",
        }),
      },
    ]),
  );
  const inspection = await inspectIpk(path);
  const registry: ProductRegistry = {
    schemaVersion: 1,
    products: [
      {
        id: "zui-youtube-webos",
        displayName: "ZUI YouTube for webOS",
        repository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
        appIds: ["youtube.leanback.v4", "com.zui.webos.youtube.staging"],
        appIdentities: [
          { appId: "youtube.leanback.v4", deploymentClass: "production" },
          {
            appId: "com.zui.webos.youtube.staging",
            deploymentClass: "staging",
          },
        ],
        deploymentModel: "developer-mode-ipk",
        releaseSource: "github-releases",
        rootlessCompatible: true,
        sourceModel: "external-product-repository",
      },
      {
        id: "zui-store",
        displayName: "ZUI Store",
        repository: "https://github.com/ZUI-WebOS/ZUI-WebOS-Platform",
        appIds: ["com.zui.webos.store.staging"],
        appIdentities: [
          {
            appId: "com.zui.webos.store.staging",
            deploymentClass: "staging",
          },
        ],
        deploymentModel: "developer-mode-ipk",
        releaseSource: "github-releases",
        rootlessCompatible: true,
        sourceModel: "external-product-repository",
      },
    ],
  };
  const staging: ProductRelease = {
    schemaVersion: 1,
    productId: "zui-youtube-webos",
    version: "0.8.4",
    channel: "staging",
    sourceRepository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
    releaseRef: "youtube-staging-0.8.4",
    artifacts: [
      {
        artifactId: "youtube-0.8.4-staging",
        filename,
        appId: "com.zui.webos.youtube.staging",
        version: "0.8.4",
        deploymentClass: "staging",
        size: inspection.size,
        hash: { algorithm: "sha256", digest: inspection.hash.digest },
        source: {
          type: "GITHUB_RELEASE",
          repository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
          releaseRef: "youtube-staging-0.8.4",
          assetName: filename,
          canonicalAssetUrl:
            "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS/releases/tag/youtube-staging-0.8.4",
        },
      },
    ],
  };
  const production: ProductRelease = {
    ...staging,
    channel: "stable",
    releaseRef: "youtube-production-0.8.4",
    artifacts: [
      {
        ...staging.artifacts[0]!,
        artifactId: "youtube-0.8.4-production",
        appId: "youtube.leanback.v4",
        deploymentClass: "production",
      },
    ],
  };
  const store: ProductRelease = {
    ...staging,
    productId: "zui-store",
    sourceRepository: "https://github.com/ZUI-WebOS/ZUI-WebOS-Platform",
    releaseRef: "store-staging-0.3.0",
    artifacts: [
      {
        ...staging.artifacts[0]!,
        artifactId: "store-0.3.0-staging",
        appId: "com.zui.webos.store.staging",
        version: "0.3.0",
        source: {
          ...staging.artifacts[0]!.source,
          repository: "https://github.com/ZUI-WebOS/ZUI-WebOS-Platform",
        },
      },
    ],
  };
  const result: DistributionResult = {
    artifactPath: path,
    metadataPath: join(directory, "verified-metadata.json"),
    manifest: {
      schemaVersion: 1,
      repository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
      release: "youtube-staging-0.8.4",
      channel: "staging",
      sourceCommit: "a".repeat(40),
      createdAt: "2026-10-05T09:00:00.000Z",
      artifacts: [
        {
          artifactId: "youtube-0.8.4-staging",
          filename,
          appId: "com.zui.webos.youtube.staging",
          version: "0.8.4",
          deploymentClass: "staging",
          sha256: inspection.hash.digest,
          size: inspection.size,
        },
      ],
    },
    artifactId: "youtube-0.8.4-staging",
    sha256: inspection.hash.digest,
    trustLevel: "SIGNED",
    trustDecision: "SIGNED_TRUSTED",
    keyId: "B".repeat(64),
  };
  return {
    sources: {
      registry,
      releases: [staging, production, store],
    } satisfies CatalogSources,
    result,
  };
}

function config() {
  return loadTvStoreInstallConfig(
    { ZUI_TV_STORE_INSTALL_HOST: "10.23.45.67" },
    ["--device", "tv"],
    ["10.23.45.67"],
    new Date("2026-10-05T09:00:00.000Z"),
  );
}

function selection() {
  return {
    productId: "zui-youtube-webos",
    releaseId: "youtube-staging-0.8.4",
    artifactId: "youtube-0.8.4-staging",
  };
}

async function coordinator(
  options: {
    readonly now?: () => Date;
    readonly installer?: InstallerExecutor;
    readonly inventory?: InventorySnapshot;
    readonly changedTrustOnExecution?: boolean;
  } = {},
) {
  const item = await fixture();
  let verificationCalls = 0;
  let staleSignals = 0;
  const installs: InstallationPhase[][] = [];
  const installer: InstallerExecutor =
    options.installer ??
    ({
      execute: async (_plan, _approval, _releases, executionOptions) => {
        const phases: InstallationPhase[] = [];
        installs.push(phases);
        for (const phase of [
          "VERIFYING_PACKAGE",
          "CHECKING_TV",
          "INSTALLING",
          "VERIFYING_INSTALLATION",
          "COMPLETE",
        ] as const) {
          phases.push(phase);
          executionOptions?.onPhase?.(phase);
        }
        return {
          commandAccepted: true,
          postInstallVerified: true,
          installedAppId: "com.zui.webos.youtube.staging",
          installedVersion: "0.8.4",
          expectedVersion: "0.8.4",
          verificationWarnings: [],
          rollback: "ROLLBACK_NOT_REQUIRED",
          receiptPath: "memory://receipt.json",
        };
      },
    } satisfies InstallerExecutor);
  const service = new StagingInstallCoordinator(config(), "12345678", {
    now: options.now ?? (() => new Date("2026-10-05T09:01:00.000Z")),
    loadSources: async () => item.sources,
    loadTrustStore: async () => ({ schemaVersion: 1, keys: [] }) as never,
    distribution: {
      verifyCached: async () => {
        verificationCalls += 1;
        return options.changedTrustOnExecution && verificationCalls > 1
          ? { ...item.result, keyId: "C".repeat(64) }
          : item.result;
      },
      fetch: async () => item.result,
    },
    adapter: {
      listInstalledApplications: async () => options.inventory ?? inventory(),
      installPackage: async (_device: DeviceAlias, path: string) => ({
        executable: "ares-install",
        args: [path],
        exitCode: 0,
        stdout: "Success",
        stderr: "",
        durationMs: 1,
        timedOut: false,
      }),
    },
    installer,
    markCatalogStale: async () => {
      staleSignals += 1;
    },
    sessionToken: () => "s".repeat(43),
    intentId: () => "11111111-1111-4111-8111-111111111111",
  });
  return { service, installs, staleSignals: () => staleSignals };
}

describe("TV Store staging install coordinator", () => {
  it.each(["com.zui.player", "youtube.leanback.v4"])(
    "hard-blocks protected production identity %s even when metadata claims staging",
    async (appId) => {
      const item = await fixture();
      const target = item.sources.releases[0]!;
      const installer = { execute: vi.fn() };
      const verifyCached = vi.fn();
      const service = new StagingInstallCoordinator(config(), "12345678", {
        now: () => new Date("2026-10-05T09:01:00.000Z"),
        loadSources: async () => ({
          ...item.sources,
          releases: [
            {
              ...target,
              artifacts: [{ ...target.artifacts[0]!, appId }],
            },
          ],
        }),
        distribution: { verifyCached, fetch: vi.fn() },
        installer,
      });
      const session = service.pair("12345678");
      await expect(
        service.createIntent(session.sessionToken, selection()),
      ).rejects.toMatchObject({ code: "PRODUCTION_INSTALL_BLOCKED" });
      expect(verifyCached).not.toHaveBeenCalled();
      expect(installer.execute).not.toHaveBeenCalled();
    },
  );

  it("uses fresh bounded inventory resilience without retrying a mutation", async () => {
    let reads = 0;
    let installs = 0;
    const adapter = createResilientDeviceInstallerAdapter({
      listInstalledApplications: async () => {
        reads += 1;
        if (reads === 1)
          throw new PlatformError(
            "DEVICE_INVENTORY_FAILED",
            "Transient inventory failure.",
          );
        return inventory();
      },
      installPackage: async () => {
        installs += 1;
        throw new Error("Install must not be called by inventory acquisition.");
      },
    });
    await expect(
      adapter.listInstalledApplications(validateDeviceAlias("tv")),
    ).resolves.toMatchObject({ device: "tv" });
    expect(reads).toBe(2);
    expect(installs).toBe(0);
  });

  it("requires explicit private bind and explicit device alias", () => {
    expect(() => loadTvStoreInstallConfig({}, ["--device", "tv"], [])).toThrow(
      /required/u,
    );
    expect(() =>
      loadTvStoreInstallConfig(
        { ZUI_TV_STORE_INSTALL_HOST: "0.0.0.0" },
        ["--device", "tv"],
        ["10.23.45.67"],
      ),
    ).toThrow(/Wildcard/u);
    expect(() =>
      loadTvStoreInstallConfig(
        { ZUI_TV_STORE_INSTALL_HOST: "10.23.45.67" },
        [],
        ["10.23.45.67"],
      ),
    ).toThrow(/--device/u);
    expect(config()).toMatchObject({
      host: "10.23.45.67",
      port: 4275,
      deviceAlias: "tv",
    });
  });

  it("rate-limits wrong pairing codes and never issues a session", async () => {
    const { service } = await coordinator();
    for (let attempt = 1; attempt <= 5; attempt += 1)
      expect(() => service.pair("00000000")).toThrow(
        attempt === 5 ? /locked/u : /invalid/u,
      );
    expect(() => service.pair("12345678")).toThrow(/expired|locked/u);
  });

  it("expires pairing challenges and sessions fail closed", async () => {
    let current = new Date("2026-10-05T09:03:01.000Z");
    const { service } = await coordinator({ now: () => current });
    expect(() => service.pair("12345678")).toThrowError(
      expect.objectContaining({ code: "PAIRING_EXPIRED" }),
    );

    current = new Date("2026-10-05T09:01:00.000Z");
    const fresh = await coordinator({ now: () => current });
    const session = fresh.service.pair("12345678");
    current = new Date("2026-10-05T09:10:01.000Z");
    await expect(
      fresh.service.createIntent(session.sessionToken, selection()),
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
    expect(() =>
      fresh.service.status("x".repeat(43), "missing-id"),
    ).toThrowError(expect.objectContaining({ code: "SESSION_INVALID" }));
  });

  it("rejects unknown logical catalog identities without touching the installer", async () => {
    for (const [field, value, code] of [
      ["productId", "missing-product", "UNKNOWN_PRODUCT"],
      ["releaseId", "missing-release", "UNKNOWN_RELEASE"],
      ["artifactId", "missing-artifact", "UNKNOWN_ARTIFACT"],
    ] as const) {
      const { service, installs } = await coordinator();
      const session = service.pair("12345678");
      await expect(
        service.createIntent(session.sessionToken, {
          ...selection(),
          [field]: value,
        }),
      ).rejects.toMatchObject({ code });
      expect(installs).toHaveLength(0);
    }
  });

  it("creates an exact signed staging intent and makes cancellation single-use", async () => {
    const { service, installs } = await coordinator();
    const session = service.pair("12345678");
    const intent = await service.createIntent(
      session.sessionToken,
      selection(),
    );
    expect(intent).toMatchObject({
      appId: "com.zui.webos.youtube.staging",
      targetVersion: "0.8.4",
      action: "INSTALL",
      trustDecision: "SIGNED_TRUSTED",
      state: "AWAITING_APPROVAL",
    });
    expect(service.cancel(session.sessionToken, intent.intentId).state).toBe(
      "CANCELLED",
    );
    expect(() =>
      service.approve(session.sessionToken, intent.intentId),
    ).toThrow(/no longer|expired|used|cancelled/iu);
    expect(installs).toHaveLength(0);
  });

  it("executes once, reports real phases, disarms, and rejects replay", async () => {
    const { service, installs, staleSignals } = await coordinator();
    const session = service.pair("12345678");
    const intent = await service.createIntent(
      session.sessionToken,
      selection(),
    );
    expect(service.approve(session.sessionToken, intent.intentId).state).toBe(
      "RUNNING",
    );
    await vi.waitFor(() =>
      expect(
        service.status(session.sessionToken, intent.intentId),
      ).toMatchObject({
        state: "SUCCEEDED",
        phase: "COMPLETE",
        result: {
          installedAppId: "com.zui.webos.youtube.staging",
          installedVersion: "0.8.4",
          postInstallVerified: true,
        },
      }),
    );
    expect(installs[0]).toEqual([
      "VERIFYING_PACKAGE",
      "CHECKING_TV",
      "INSTALLING",
      "VERIFYING_INSTALLATION",
      "COMPLETE",
    ]);
    expect(staleSignals()).toBe(1);
    expect(service.health().armed).toBe(false);
    expect(() =>
      service.approve(session.sessionToken, intent.intentId),
    ).toThrow();
  });

  it("blocks production, Store self-update, same-version and changed trust", async () => {
    const production = await coordinator();
    const productionSession = production.service.pair("12345678");
    await expect(
      production.service.createIntent(productionSession.sessionToken, {
        productId: "zui-youtube-webos",
        releaseId: "youtube-production-0.8.4",
        artifactId: "youtube-0.8.4-production",
      }),
    ).rejects.toMatchObject({ code: "PRODUCTION_INSTALL_BLOCKED" });

    const self = await coordinator();
    const selfSession = self.service.pair("12345678");
    await expect(
      self.service.createIntent(selfSession.sessionToken, {
        productId: "zui-store",
        releaseId: "store-staging-0.3.0",
        artifactId: "store-0.3.0-staging",
      }),
    ).rejects.toMatchObject({ code: "STORE_SELF_UPDATE_BLOCKED" });

    const same = await coordinator({ inventory: inventory("0.8.4") });
    const sameSession = same.service.pair("12345678");
    await expect(
      same.service.createIntent(sameSession.sessionToken, selection()),
    ).rejects.toMatchObject({ code: "INSTALL_POLICY_BLOCKED" });

    const changed = await coordinator({ changedTrustOnExecution: true });
    const changedSession = changed.service.pair("12345678");
    const changedIntent = await changed.service.createIntent(
      changedSession.sessionToken,
      selection(),
    );
    changed.service.approve(
      changedSession.sessionToken,
      changedIntent.intentId,
    );
    await vi.waitFor(() =>
      expect(
        changed.service.status(
          changedSession.sessionToken,
          changedIntent.intentId,
        ),
      ).toMatchObject({ state: "FAILED", errorCode: "PLAN_CHANGED" }),
    );
    expect(() =>
      changed.service.approve(
        changedSession.sessionToken,
        changedIntent.intentId,
      ),
    ).toThrow();
  });

  it("returns a typed busy result for concurrent execution", async () => {
    let releaseExecution!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });
    const installer: InstallerExecutor = {
      execute: async () => {
        await gate;
        return {
          commandAccepted: true,
          postInstallVerified: true,
          installedAppId: "com.zui.webos.youtube.staging",
          installedVersion: "0.8.4",
          expectedVersion: "0.8.4",
          verificationWarnings: [],
          rollback: "ROLLBACK_NOT_REQUIRED",
          receiptPath: "memory://receipt.json",
        };
      },
    };
    const { service } = await coordinator({ installer });
    const session = service.pair("12345678");
    const intent = await service.createIntent(
      session.sessionToken,
      selection(),
    );
    service.approve(session.sessionToken, intent.intentId);
    expect(() =>
      service.approve(session.sessionToken, intent.intentId),
    ).toThrow(InstallServiceError);
    try {
      service.approve(session.sessionToken, intent.intentId);
    } catch (error) {
      expect(error).toMatchObject({ code: "INSTALL_BUSY" });
    }
    releaseExecution();
  });
});

describe("TV Store install HTTP boundary", () => {
  it("blocks unpaired, foreign-origin, broad methods and client-controlled fields", async () => {
    const { service } = await coordinator();
    const server = createTvStoreInstallServer(config(), service);
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${String(address.port)}/api/tv-store-install/v1`;
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect(
      (
        await fetch(`${base}/health`, {
          headers: { Origin: "https://example.com" },
        })
      ).status,
    ).toBe(403);
    expect((await fetch(`${base}/health?device=other`)).status).toBe(400);
    for (const method of ["PUT", "PATCH", "DELETE"])
      expect((await fetch(`${base}/health`, { method })).status).toBe(405);
    expect(
      (
        await fetch(`${base}/intents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selection()),
        })
      ).status,
    ).toBe(401);
    const paired = await fetch(`${base}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "null" },
      body: JSON.stringify({ code: "12345678" }),
    });
    const pairEnvelope = (await paired.json()) as {
      data: { sessionToken: string };
    };
    const denied = await fetch(`${base}/intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pairEnvelope.data.sessionToken}`,
      },
      body: JSON.stringify({
        ...selection(),
        path: "C:\\secret.ipk",
        url: "https://example.com/payload.ipk",
        command: "ares-install",
        device: "other",
      }),
    });
    expect(denied.status).toBe(400);
    expect(await denied.text()).not.toMatch(
      /C:\\secret|ares-install|example\.com\/payload/iu,
    );
    const unknownSession = await fetch(`${base}/intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${"x".repeat(43)}`,
      },
      body: JSON.stringify(selection()),
    });
    expect(unknownSession.status).toBe(401);

    const created = await fetch(`${base}/intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pairEnvelope.data.sessionToken}`,
      },
      body: JSON.stringify(selection()),
    });
    const intentEnvelope = (await created.json()) as {
      data: { intentId: string };
    };
    const spoofedApproval = await fetch(
      `${base}/intents/${intentEnvelope.data.intentId}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pairEnvelope.data.sessionToken}`,
        },
        body: JSON.stringify({ planDigest: "A".repeat(64) }),
      },
    );
    expect(spoofedApproval.status).toBe(400);
    expect(await spoofedApproval.text()).not.toContain("A".repeat(64));
  });
});
