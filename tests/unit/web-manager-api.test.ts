import { describe, expect, it } from "vitest";
import {
  WebManagerApi,
  errorAction,
  sanitizeReceipt,
} from "../../apps/web-portal/src/api.js";
import {
  mockFetchResult,
  mockPlanFixtures,
} from "../../apps/web-portal/src/mock.js";

describe("Web Manager API contracts", () => {
  it("provides deterministic online/offline, app, catalog and receipt fixtures", async () => {
    const api = new WebManagerApi(true);
    const dashboard = await api.dashboard();
    expect(dashboard.mode).toBe("MOCK");
    expect(dashboard.devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alias: "tv", connectionStatus: "reachable" }),
        expect.objectContaining({
          alias: "bedroom",
          connectionStatus: "unreachable",
        }),
      ]),
    );
    expect(
      dashboard.applications.map((item) => item.match.deploymentClass),
    ).toEqual(["production", "production", "staging"]);
    const catalog = await api.catalog();
    expect(catalog.summary).toMatchObject({
      managedProducts: 2,
      updatesAvailable: 1,
      verifiedArtifacts: 1,
    });
    expect(catalog.products[1]?.releases[0]?.artifacts[0]?.sha256).toMatch(
      /^[A-F0-9]{64}$/u,
    );
    expect(await api.receipts()).toHaveLength(1);
  });

  it("provides catalog detail, trusted fetch, and read-only plan contracts", async () => {
    const api = new WebManagerApi(true);
    const product = await api.catalogProduct("zui-youtube-webos");
    expect(product.displayName).toContain("YouTube");
    const release = await api.catalogRelease(
      "zui-youtube-webos",
      "zui-staging-0.8.4-acceptance",
    );
    expect(release.channel).toBe("staging");
    expect(
      await api.fetchCatalogArtifact({
        productId: "zui-youtube-webos",
        releaseId: "zui-staging-0.8.4-acceptance",
        artifactId: "zui-youtube-webos-0.8.4-staging",
      }),
    ).toEqual(mockFetchResult);
    const plan = await api.planCatalog({
      productId: "zui-youtube-webos",
      releaseId: "zui-staging-0.8.4-acceptance",
      artifactId: "zui-youtube-webos-0.8.4-staging",
      device: "tv",
    });
    expect(plan.artifact.trustLevel).toBe("SIGNED");
    expect(plan.proposedCommand).toBeNull();
    expect(JSON.stringify(plan)).not.toContain("C:\\");
  });

  it("rejects unknown and path-shaped catalog identifiers", async () => {
    const api = new WebManagerApi(true);
    await expect(api.catalogProduct("missing-product")).rejects.toMatchObject({
      code: "CATALOG_PRODUCT_NOT_FOUND",
    });
    await expect(api.catalogProduct("../../escape")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(
      api.catalogRelease("zui-youtube-webos", "missing-release"),
    ).rejects.toMatchObject({ code: "CATALOG_RELEASE_NOT_FOUND" });
    await expect(
      api.fetchCatalogArtifact({
        productId: "zui-youtube-webos",
        releaseId: "zui-staging-0.8.4-acceptance",
        artifactId: "missing-artifact",
      }),
    ).rejects.toMatchObject({ code: "ARTIFACT_NOT_AVAILABLE" });
  });

  it("sanitizes receipts to the public DTO", () => {
    const value = sanitizeReceipt({
      timestamp: "2026-10-02T00:00:00.000Z",
      deviceAlias: "tv",
      appId: "com.zui.test",
      version: "1.0.0",
      trustLevel: "SIGNED",
      result: "SUCCESS",
      postInstallVerified: true,
      token: "must-not-leak",
      rawCommand: "secret",
    });
    expect(value).toEqual({
      timestamp: "2026-10-02T00:00:00.000Z",
      device: "tv",
      app: "com.zui.test",
      version: "1.0.0",
      trust: "SIGNED",
      result: "SUCCESS",
      postInstallVerified: true,
    });
    expect(JSON.stringify(value)).not.toContain("must-not-leak");
  });

  it("ships deterministic allowed staging and blocked production plan fixtures", () => {
    expect(mockPlanFixtures.allowedStaging).toMatchObject({
      appId: "com.zui.webos.youtube.staging",
      policyDecision: "ALLOW_WITH_APPROVAL",
    });
    expect(mockPlanFixtures.allowedStaging.riskFlags).toContain("STAGING_APP");
    expect(mockPlanFixtures.blockedProduction).toMatchObject({
      appId: "youtube.leanback.v4",
      policyDecision: "BLOCK",
    });
    expect(mockPlanFixtures.blockedProduction.riskFlags).toContain(
      "PRODUCTION_APP_OVERWRITE",
    );
  });

  it("maps structured errors to recovery advice without stack details", () => {
    expect(errorAction("DEVICE_UNREACHABLE")).toMatch(/same network/u);
    expect(errorAction("SIGNING_KEY_REVOKED")).toMatch(/active trusted key/u);
    expect(errorAction("UNKNOWN")).toBeNull();
  });
});
