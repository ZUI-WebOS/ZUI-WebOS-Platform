import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  TvStoreApi,
  MockTvStoreDataProvider,
} from "../../apps/tv-store/src/api.js";
import { loadTvStoreApiConfig } from "../../apps/tv-store/src/config.js";
import { isTvStoreCatalogResponse } from "../../apps/tv-store/src/contracts.js";
import { createTvStoreServer } from "../../apps/tv-store/src/server.js";

const servers: ReturnType<typeof createTvStoreServer>[] = [];
afterEach(async () => {
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
      loadTvStoreApiConfig({
        ZUI_TV_STORE_API_HOST: "192.168.1.10",
        ZUI_TV_STORE_API_PORT: "70000",
      }),
    ).toThrow(/65535/u);
    expect(loadTvStoreApiConfig({ ZUI_TV_STORE_MOCK: "1" })).toEqual({
      host: "127.0.0.1",
      port: 4274,
      mock: true,
    });
  });

  it("serves only GET/HEAD/OPTIONS and has no mutation, query, or private-data surface", async () => {
    const server = createTvStoreServer({
      host: "127.0.0.1",
      port: 4274,
      mock: true,
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
  });
});
