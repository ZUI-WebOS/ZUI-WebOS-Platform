import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TvStoreApi,
  MockTvStoreDataProvider,
} from "../../apps/tv-store/src/api.js";
import { loadTvStoreApiConfig } from "../../apps/tv-store/src/config.js";
import { isTvStoreCatalogResponse } from "../../apps/tv-store/src/contracts.js";
import {
  loadLiveCatalog,
  validateLiveApiBase,
} from "../../apps/tv-store/src/client/api-client.js";
import {
  LiveTvStoreDataProvider,
  ResilientDeviceInventory,
} from "../../apps/tv-store/src/live.js";
import {
  tvStoreMockRegistry,
  tvStoreMockReleases,
  mockTvStoreCatalog,
} from "../../apps/tv-store/src/mock.js";
import { createTvStoreServer } from "../../apps/tv-store/src/server.js";
import type {
  ApplicationVersion,
  InstalledApplication,
  InstalledApplicationId,
  InventorySnapshot,
} from "@zui-webos/shared-types";
import { PlatformError, validateDeviceAlias } from "@zui-webos/webos-client";

const servers: ReturnType<typeof createTvStoreServer>[] = [];

function resilientInventory(version = "1.0.1"): InventorySnapshot {
  return {
    device: validateDeviceAlias("tv"),
    timestamp: "2026-10-05T10:00:00.000Z",
    source: "ares-install-listfull",
    applications: [
      {
        id: "com.zui.player" as InstalledApplicationId,
        version: version as ApplicationVersion,
        source: "ares-install-listfull",
        metadata: {},
      },
    ],
  };
}

describe("TV Store device inventory resilience", () => {
  it("retries a transient failure and emits sanitized attempt evidence", async () => {
    let calls = 0;
    const events: {
      result: string;
      errorCode: string | null;
      processExitCode: number | null;
    }[] = [];
    const service = new ResilientDeviceInventory(
      {
        listInstalledApplications: async () => {
          calls += 1;
          if (calls === 1)
            throw new PlatformError(
              "DEVICE_INVENTORY_FAILED",
              "Transient failure.",
              "exitCode=1",
            );
          return resilientInventory();
        },
      },
      {
        retryDelayMs: 0,
        requestId: () => "inventory-request",
        onEvent: (event) => events.push(event),
      },
    );

    await expect(
      service.listInstalledApplications(validateDeviceAlias("tv")),
    ).resolves.toMatchObject({ device: "tv" });
    expect(calls).toBe(2);
    expect(events).toEqual([
      expect.objectContaining({
        result: "RETRY",
        errorCode: "DEVICE_INVENTORY_FAILED",
        processExitCode: 1,
      }),
      expect.objectContaining({
        result: "PASS",
        errorCode: null,
        processExitCode: null,
      }),
    ]);
    expect(JSON.stringify(events)).not.toMatch(/passphrase|token|prisoner/iu);
  });

  it.each(["DEVICE_INVENTORY_FAILED", "COMMAND_TIMEOUT"] as const)(
    "fails closed after bounded retries for permanent %s",
    async (code) => {
      let calls = 0;
      const service = new ResilientDeviceInventory(
        {
          listInstalledApplications: async () => {
            calls += 1;
            throw new PlatformError(code, "Permanent failure.");
          },
        },
        { retryDelayMs: 0 },
      );
      await expect(
        service.listInstalledApplications(validateDeviceAlias("tv")),
      ).rejects.toMatchObject({ code });
      expect(calls).toBe(3);
    },
  );

  it("does not retry malformed inventory", async () => {
    let calls = 0;
    const service = new ResilientDeviceInventory(
      {
        listInstalledApplications: async () => {
          calls += 1;
          throw new PlatformError(
            "MALFORMED_APP_INVENTORY",
            "Malformed inventory.",
          );
        },
      },
      { retryDelayMs: 0 },
    );
    await expect(
      service.listInstalledApplications(validateDeviceAlias("tv")),
    ).rejects.toMatchObject({ code: "MALFORMED_APP_INVENTORY" });
    expect(calls).toBe(1);
  });

  it("coalesces concurrent reads per device but never caches completed data", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = new ResilientDeviceInventory({
      listInstalledApplications: async () => {
        calls += 1;
        if (calls === 1) await gate;
        return resilientInventory(calls === 1 ? "1.0.1" : "1.0.2");
      },
    });
    const alias = validateDeviceAlias("tv");
    const first = service.listInstalledApplications(alias);
    const concurrent = service.listInstalledApplications(alias);
    release();
    await expect(Promise.all([first, concurrent])).resolves.toMatchObject([
      { applications: [{ version: "1.0.1" }] },
      { applications: [{ version: "1.0.1" }] },
    ]);
    expect(calls).toBe(1);
    await expect(
      service.listInstalledApplications(alias),
    ).resolves.toMatchObject({ applications: [{ version: "1.0.2" }] });
    expect(calls).toBe(2);
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

describe("TV Store read-only API", () => {
  it("exposes normalized deterministic catalog and logical product resources", async () => {
    const api = new TvStoreApi(new MockTvStoreDataProvider());
    const catalog = await api.catalog();
    expect(isTvStoreCatalogResponse(catalog)).toBe(true);
    expect(catalog.products.map((item) => item.appId)).toEqual([
      "com.zui.player",
      "com.zui.webos.store.staging",
      "youtube.leanback.v4",
      "com.zui.webos.youtube.staging",
    ]);
    expect(catalog.products.map((item) => item.updateStatus)).toEqual([
      "UPDATE_AVAILABLE",
      "NOT_INSTALLED",
      "NO_COMPATIBLE_RELEASE",
      "UP_TO_DATE",
    ]);
    expect((await api.product("zui-youtube-webos-staging")).trustState).toBe(
      "SIGNED",
    );
  });

  it("rejects path, URL, command-shaped, oversized and missing product IDs", async () => {
    const api = new TvStoreApi(new MockTvStoreDataProvider());
    for (const id of [
      "../../secret",
      "https://example.com",
      "whoami & dir",
      "a".repeat(97),
    ])
      await expect(api.product(id)).rejects.toMatchObject({
        code: "INVALID_PRODUCT_ID",
      });
    await expect(api.product("missing-product")).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("requires an explicit interface and rejects wildcard or invalid ports", () => {
    expect(() => loadTvStoreApiConfig({})).toThrow(/required/u);
    expect(() =>
      loadTvStoreApiConfig({ ZUI_TV_STORE_API_HOST: "0.0.0.0" }),
    ).toThrow(/forbidden/u);
    expect(() =>
      loadTvStoreApiConfig(
        {
          ZUI_TV_STORE_API_HOST: "192.168.1.10",
          ZUI_TV_STORE_API_PORT: "70000",
        },
        ["192.168.1.10"],
      ),
    ).toThrow(/65535/u);
    expect(loadTvStoreApiConfig({ ZUI_TV_STORE_MOCK: "1" })).toEqual({
      host: "127.0.0.1",
      port: 4274,
      mock: true,
      deviceAlias: "tv",
    });
    expect(
      loadTvStoreApiConfig(
        {
          ZUI_TV_STORE_API_HOST: "10.23.45.67",
          ZUI_TV_STORE_DEVICE_ALIAS: "tv",
        },
        ["10.23.45.67"],
      ),
    ).toEqual({
      host: "10.23.45.67",
      port: 4274,
      mock: false,
      deviceAlias: "tv",
    });
    expect(() =>
      loadTvStoreApiConfig({ ZUI_TV_STORE_API_HOST: "10.23.45.68" }, [
        "10.23.45.67",
      ]),
    ).toThrow(/not assigned/u);
  });

  it("accepts only an exact IPv4 and port client endpoint", () => {
    expect(validateLiveApiBase("http://10.23.45.67:4274")).toBe(
      "http://10.23.45.67:4274",
    );
    for (const value of [
      null,
      "https://10.23.45.67:4274",
      "http://127.0.0.1:4274",
      "http://010.23.45.67:4274",
      "http://999.168.0.15:4274",
      "http://10.23.45.67:70000",
      "http://example.com:4274",
      "http://10.23.45.67:4274/path",
      "http://192.0.2.15:4274",
    ])
      expect(() => validateLiveApiBase(value)).toThrow();
  });

  it("rejects malformed/non-live responses and times out without mock fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(loadLiveCatalog("http://10.23.45.67:4274")).rejects.toThrow(
      /invalid/u,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            data: { ...mockTvStoreCatalog, mode: "MOCK" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(loadLiveCatalog("http://10.23.45.67:4274")).rejects.toThrow(
      /non-live/u,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    );
    await expect(
      loadLiveCatalog("http://10.23.45.67:4274", undefined, 5),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("projects actual inventory through CatalogService without merging identities", async () => {
    const application = (
      id: string,
      version: string,
    ): InstalledApplication => ({
      id: id as InstalledApplicationId,
      version: version as ApplicationVersion,
      title: id,
      source: "ares-install-listfull",
      metadata: {},
    });
    let inventoryCalls = 0;
    const provider = new LiveTvStoreDataProvider(validateDeviceAlias("tv"), {
      inventory: {
        listInstalledApplications: async (device) => {
          inventoryCalls += 1;
          if (inventoryCalls < 3)
            throw new PlatformError(
              "DEVICE_INVENTORY_FAILED",
              "Transient inventory failure.",
            );
          return {
            device,
            timestamp: "2026-10-04T12:00:00.000Z",
            source: "ares-install-listfull",
            applications: [
              application("com.zui.player", "1.0.1"),
              application("youtube.leanback.v4", "0.8.3"),
              application("com.zui.webos.store.staging", "0.2.0"),
            ],
          };
        },
      },
      loadSources: async () => ({
        registry: tvStoreMockRegistry,
        releases: tvStoreMockReleases,
      }),
      loadCacheRecords: async () => [],
      now: () => new Date("2026-10-04T12:00:00.000Z"),
      retryDelayMs: 0,
    });
    const [catalog, concurrentCatalog] = await Promise.all([
      provider.catalog(),
      provider.catalog(),
    ]);
    expect(concurrentCatalog).toBe(catalog);
    expect(inventoryCalls).toBe(3);
    expect(catalog.mode).toBe("LIVE");
    expect(catalog.inventoryAvailable).toBe(true);
    expect(
      catalog.products.find(
        (item) => item.appId === "com.zui.webos.store.staging",
      ),
    ).toMatchObject({
      installed: true,
      installedVersion: "0.2.0",
      updateStatus: "UP_TO_DATE",
      deploymentClass: "staging",
    });
    expect(
      catalog.products.find(
        (item) => item.appId === "com.zui.webos.youtube.staging",
      ),
    ).toMatchObject({ installed: false, deploymentClass: "staging" });
    expect(
      catalog.products.find((item) => item.appId === "youtube.leanback.v4"),
    ).toMatchObject({ installed: true, deploymentClass: "production" });
    await expect(provider.catalog()).resolves.toBe(catalog);
    expect(inventoryCalls).toBe(3);
  });

  it("invalidates the read-only catalog cache after a successful install signal", async () => {
    let signal = "before";
    let installed = false;
    let inventoryCalls = 0;
    const provider = new LiveTvStoreDataProvider(validateDeviceAlias("tv"), {
      inventory: {
        listInstalledApplications: async (device) => {
          inventoryCalls += 1;
          return {
            device,
            timestamp: "2026-10-05T09:00:00.000Z",
            source: "ares-install-listfull",
            applications: installed
              ? [
                  {
                    id: "com.zui.webos.youtube.staging" as InstalledApplicationId,
                    version: "0.8.4" as ApplicationVersion,
                    source: "ares-install-listfull",
                    metadata: {},
                  },
                ]
              : [],
          };
        },
      },
      loadSources: async () => ({
        registry: tvStoreMockRegistry,
        releases: tvStoreMockReleases,
      }),
      loadCacheRecords: async () => [],
      readInvalidationSignal: async () => signal,
      now: () => new Date("2026-10-05T09:00:00.000Z"),
    });
    const before = await provider.catalog();
    expect(
      before.products.find(
        (item) => item.appId === "com.zui.webos.youtube.staging",
      )?.installed,
    ).toBe(false);
    installed = true;
    signal = "after";
    const after = await provider.catalog();
    expect(
      after.products.find(
        (item) => item.appId === "com.zui.webos.youtube.staging",
      ),
    ).toMatchObject({ installed: true, installedVersion: "0.8.4" });
    expect(inventoryCalls).toBe(2);
  });

  it("serves only GET/HEAD/OPTIONS and has no mutation, query, or private-data surface", async () => {
    const server = createTvStoreServer({
      host: "127.0.0.1",
      port: 4274,
      mock: true,
      deviceAlias: validateDeviceAlias("tv"),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${String(address.port)}/api/tv-store/v1`;
    const catalog = await fetch(`${base}/catalog`);
    const raw = await catalog.text();
    expect(catalog.status).toBe(200);
    expect(raw).not.toMatch(
      /C:\\|private.?key|approval.?digest|cache.?director|command/iu,
    );
    for (const method of ["POST", "PUT", "PATCH", "DELETE"])
      expect((await fetch(`${base}/catalog`, { method })).status).toBe(405);
    expect((await fetch(`${base}/catalog?path=C:%5Csecret`)).status).toBe(400);
    expect((await fetch(`${base}/products/..%2F..%2Fsecret`)).status).toBe(400);
    expect((await fetch(`${base}/install`, { method: "POST" })).status).toBe(
      405,
    );
    const allowed = await fetch(`${base}/catalog`, {
      headers: { Origin: "null" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("null");
    const denied = await fetch(`${base}/catalog`, {
      headers: { Origin: "https://example.com" },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});
