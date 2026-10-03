import type { DashboardDto, DeviceDetailDto, ReceiptDto } from "./contracts.js";
import type {
  ProductRegistry,
  ProductRelease,
} from "@zui-webos/catalog-contracts";
import type {
  ApplicationVersion,
  DeviceAlias,
  InstalledApplicationId,
} from "@zui-webos/shared-types";

const deviceAlias = (value: string) => value as DeviceAlias;
const appId = (value: string) => value as InstalledApplicationId;
const appVersion = (value: string) => value as ApplicationVersion;

export const mockRegistry: ProductRegistry = {
  schemaVersion: 1,
  products: [
    {
      id: "zui-iptv-player",
      displayName: "ZUI IPTV Player",
      repository: "https://github.com/ZUI-WebOS/ZUI-IPTV-Player",
      appIds: ["com.zui.player"],
      appIdentities: [
        { appId: "com.zui.player", deploymentClass: "production" },
      ],
      deploymentModel: "developer-mode-ipk",
      releaseSource: "github-releases",
      rootlessCompatible: true,
      sourceModel: "external-product-repository",
    },
    {
      id: "zui-youtube-webos",
      displayName: "ZUI YouTube for webOS",
      repository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
      appIds: ["youtube.leanback.v4", "com.zui.webos.youtube.staging"],
      appIdentities: [
        { appId: "youtube.leanback.v4", deploymentClass: "production" },
        { appId: "com.zui.webos.youtube.staging", deploymentClass: "staging" },
      ],
      deploymentModel: "developer-mode-ipk",
      releaseSource: "github-releases",
      rootlessCompatible: true,
      sourceModel: "external-product-repository",
    },
  ],
};
const apps = [
  {
    id: appId("com.zui.player"),
    title: "ZUI IPTV Player",
    version: appVersion("1.0.1"),
    source: "ares-install-listfull" as const,
    metadata: {},
  },
  {
    id: appId("youtube.leanback.v4"),
    title: "YouTube",
    version: appVersion("0.8.3"),
    source: "ares-install-listfull" as const,
    metadata: {},
  },
  {
    id: appId("com.zui.webos.youtube.staging"),
    title: "ZUI YouTube STAGING",
    version: appVersion("0.8.4"),
    source: "ares-install-listfull" as const,
    metadata: {},
  },
];
function classified() {
  return apps.map((application, index) => ({
    application,
    match: {
      classification:
        index === 2
          ? ("KNOWN_STAGING_PRODUCT" as const)
          : ("KNOWN_PRODUCT" as const),
      product: mockRegistry.products[index === 0 ? 0 : 1]!,
      deploymentClass:
        index === 2 ? ("staging" as const) : ("production" as const),
      identityMatched: true,
      expectedPublisher: null,
      publisherMatched: null,
      authenticityVerified: false as const,
      explanation: "Mock registry identity.",
    },
  }));
}
export const mockRelease: ProductRelease = {
  schemaVersion: 1,
  productId: "zui-youtube-webos",
  version: "0.8.4",
  channel: "staging",
  sourceRepository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
  releaseRef: "zui-staging-0.8.4-acceptance",
  artifacts: [
    {
      artifactId: "zui-youtube-webos-0.8.4-staging",
      filename: "com.zui.webos.youtube.staging_0.8.4_all.ipk",
      appId: "com.zui.webos.youtube.staging",
      version: "0.8.4",
      deploymentClass: "staging",
      size: 94208,
      hash: {
        algorithm: "sha256",
        digest:
          "816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4",
      },
      source: {
        type: "GITHUB_RELEASE",
        repository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
        releaseRef: "zui-staging-0.8.4-acceptance",
        assetName: "com.zui.webos.youtube.staging_0.8.4_all.ipk",
        canonicalAssetUrl: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
      },
    },
  ],
};
export const mockDashboard: DashboardDto = {
  mode: "MOCK",
  devices: [
    {
      alias: deviceAlias("tv"),
      isDefault: true,
      connectionStatus: "reachable",
    },
    {
      alias: deviceAlias("bedroom"),
      isDefault: false,
      connectionStatus: "unreachable",
    },
  ],
  selectedDevice: "tv",
  applications: classified(),
  products: 2,
  releases: 1,
  verifiedCacheEntries: 1,
  receiptCount: 1,
  developerMode: {
    device: deviceAlias("tv"),
    connectionStatus: "reachable",
    appAvailability: "available",
    expiresAt: null,
    remainingSeconds: null,
    observedAt: "2026-10-02T20:00:00.000Z",
    detail: "Mock Developer Mode status.",
  },
  generatedAt: "2026-10-02T20:00:00.000Z",
};
export const mockDevice: DeviceDetailDto = {
  device: {
    alias: deviceAlias("tv"),
    isDefault: true,
    connectionStatus: "reachable",
    health: {
      connectionStatus: "reachable",
      checkedAt: "2026-10-02T20:00:00.000Z",
    },
    capabilities: ["connectivity", "installed-application-inventory"],
  },
  applications: classified(),
  developerMode: mockDashboard.developerMode!,
};
export const mockReceipts: readonly ReceiptDto[] = [
  {
    timestamp: "2026-10-02T18:00:00.000Z",
    device: "tv",
    app: "com.zui.webos.youtube.staging",
    version: "0.8.4",
    trust: "REPOSITORY_PINNED_HASH",
    result: "SUCCESS",
    postInstallVerified: true,
  },
];

/** Deterministic policy examples for UI development without a TV or package. */
export const mockPlanFixtures = {
  allowedStaging: {
    appId: "com.zui.webos.youtube.staging",
    version: "0.8.4",
    trust: "SIGNED",
    policyDecision: "ALLOW_WITH_APPROVAL",
    riskFlags: ["STAGING_APP", "SAME_VERSION_REINSTALL"],
  },
  blockedProduction: {
    appId: "youtube.leanback.v4",
    version: "0.8.4",
    trust: "SIGNED",
    policyDecision: "BLOCK",
    riskFlags: ["PRODUCTION_APP_OVERWRITE", "PRODUCTION_DEPLOYMENT_BLOCK"],
  },
} as const;
