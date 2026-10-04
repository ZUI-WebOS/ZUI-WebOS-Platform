import { CatalogService } from "@zui-webos/catalog-service";
import type {
  Catalog,
  CatalogProduct,
  ProductRegistry,
  ProductRelease,
} from "@zui-webos/catalog-contracts";
import type {
  ApplicationVersion,
  InstalledApplication,
  InstalledApplicationId,
} from "@zui-webos/shared-types";
import type { TvStoreCatalogResponse, TvStoreProduct } from "./contracts.js";

const repository = {
  iptv: "https://github.com/ZUI-WebOS/ZUI-IPTV-Player",
  youtube: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
  platform: "https://github.com/ZUI-WebOS/ZUI-WebOS-Platform",
} as const;

export const tvStoreMockRegistry: ProductRegistry = {
  schemaVersion: 1,
  products: [
    {
      id: "zui-iptv-player",
      displayName: "ZUI IPTV Player",
      repository: repository.iptv,
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
      id: "zui-store",
      displayName: "ZUI Store",
      repository: repository.platform,
      appIds: ["com.zui.webos.store.staging"],
      appIdentities: [
        { appId: "com.zui.webos.store.staging", deploymentClass: "staging" },
      ],
      deploymentModel: "developer-mode-ipk",
      releaseSource: "github-releases",
      rootlessCompatible: true,
      sourceModel: "external-product-repository",
    },
    {
      id: "zui-youtube-webos",
      displayName: "ZUI YouTube for webOS",
      repository: repository.youtube,
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

function artifact(input: {
  readonly id: string;
  readonly filename: string;
  readonly appId: string;
  readonly version: string;
  readonly deploymentClass: "production" | "staging";
  readonly repository: (typeof repository)[keyof typeof repository];
}) {
  return {
    artifactId: input.id,
    filename: input.filename,
    appId: input.appId,
    version: input.version,
    deploymentClass: input.deploymentClass,
    size: 1_048_576,
    hash: { algorithm: "sha256" as const, digest: "A".repeat(64) },
    source: { type: "EXTERNAL" as const, repository: input.repository },
  };
}

export const tvStoreMockReleases: readonly ProductRelease[] = [
  {
    schemaVersion: 1,
    productId: "zui-store",
    version: "0.2.0",
    channel: "staging",
    sourceRepository: repository.platform,
    releaseRef: "tv-store-live-catalog-0.2.0",
    artifacts: [
      artifact({
        id: "store-staging-0.2.0",
        filename: "com.zui.webos.store.staging_0.2.0_all.ipk",
        appId: "com.zui.webos.store.staging",
        version: "0.2.0",
        deploymentClass: "staging",
        repository: repository.platform,
      }),
    ],
  },
  {
    schemaVersion: 1,
    productId: "zui-iptv-player",
    version: "1.0.1",
    channel: "stable",
    sourceRepository: repository.iptv,
    releaseRef: "v1.0.1",
    artifacts: [
      artifact({
        id: "iptv-1.0.1",
        filename: "com.zui.player_1.0.1_all.ipk",
        appId: "com.zui.player",
        version: "1.0.1",
        deploymentClass: "production",
        repository: repository.iptv,
      }),
    ],
  },
  {
    schemaVersion: 1,
    productId: "zui-iptv-player",
    version: "1.1.0",
    channel: "stable",
    sourceRepository: repository.iptv,
    releaseRef: "v1.1.0",
    artifacts: [
      artifact({
        id: "iptv-1.1.0",
        filename: "com.zui.player_1.1.0_all.ipk",
        appId: "com.zui.player",
        version: "1.1.0",
        deploymentClass: "production",
        repository: repository.iptv,
      }),
    ],
  },
  {
    schemaVersion: 1,
    productId: "zui-youtube-webos",
    version: "0.8.4",
    channel: "staging",
    sourceRepository: repository.youtube,
    releaseRef: "zui-staging-0.8.4-acceptance",
    sourceCommit: "ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2",
    artifacts: [
      artifact({
        id: "youtube-staging-0.8.4",
        filename: "com.zui.webos.youtube.staging_0.8.4_all.ipk",
        appId: "com.zui.webos.youtube.staging",
        version: "0.8.4",
        deploymentClass: "staging",
        repository: repository.youtube,
      }),
    ],
  },
];

function installedApplication(
  id: string,
  version: string,
  title: string,
): InstalledApplication {
  return {
    id: id as InstalledApplicationId,
    version: version as ApplicationVersion,
    title,
    source: "ares-install-listfull",
    metadata: {},
  };
}
const installed: readonly InstalledApplication[] = [
  installedApplication("com.zui.player", "1.0.1", "ZUI IPTV Player"),
  installedApplication("youtube.leanback.v4", "0.8.3", "ZUI YouTube for webOS"),
  installedApplication(
    "com.zui.webos.youtube.staging",
    "0.8.4",
    "ZUI YouTube STAGING",
  ),
];

function description(productId: string): TvStoreProduct["description"] {
  if (productId === "zui-iptv-player")
    return {
      en: "Live TV and media browsing designed for the big screen.",
      tr: "Büyük ekran için tasarlanmış canlı TV ve medya deneyimi.",
    };
  if (productId === "zui-youtube-webos")
    return {
      en: "A focused, remote-friendly YouTube experience for webOS.",
      tr: "webOS için sade ve kumanda dostu bir YouTube deneyimi.",
    };
  return {
    en: "Discover and understand ZUI apps from your television.",
    tr: "ZUI uygulamalarını televizyonunuzdan keşfedin ve inceleyin.",
  };
}

function icon(productId: string): TvStoreProduct["icon"] {
  if (productId === "zui-iptv-player") return "iptv";
  if (productId === "zui-youtube-webos") return "youtube";
  return "store";
}

export function toTvStoreCatalog(
  catalog: Catalog,
  mode: TvStoreCatalogResponse["mode"],
  inventoryAvailable: boolean,
): TvStoreCatalogResponse {
  const products = catalog.products.flatMap((product: CatalogProduct) =>
    product.appIdentities.map((identity) => {
      const comparison = catalog.comparisons.find(
        (item) =>
          item.productId === product.productId && item.appId === identity.appId,
      );
      if (comparison === undefined)
        throw new Error("Normalized catalog comparison is missing.");
      const release =
        product.releases.find(
          (item) => item.releaseId === comparison.available.releaseId,
        ) ?? null;
      const artifact =
        release?.artifacts.find(
          (item) => item.artifactId === comparison.available.artifactId,
        ) ?? null;
      return {
        productId: `${product.productId}-${identity.deploymentClass}`,
        displayName: product.displayName,
        description: description(product.productId),
        icon: icon(product.productId),
        repository: product.repository,
        appId: identity.appId,
        deploymentClass: identity.deploymentClass,
        channel: comparison.available.channel,
        installed: comparison.installed.installed,
        installedVersion: comparison.installed.version,
        availableVersion: comparison.available.version,
        updateStatus: comparison.versionStatus,
        trustState: comparison.trustStatus,
        rootlessCompatible: product.rootlessCompatible,
        inventoryAvailable,
        release:
          release === null
            ? null
            : {
                releaseId: release.releaseId,
                sourceCommit: release.sourceCommit,
                draft: release.draft,
                prerelease: release.prerelease,
                published: release.published,
              },
        artifact:
          artifact === null
            ? null
            : {
                artifactId: artifact.artifactId,
                appId: artifact.appId,
                version: artifact.version,
                deploymentClass: artifact.deploymentClass,
                trustState: artifact.trustState,
              },
      } satisfies TvStoreProduct;
    }),
  );
  return {
    apiVersion: 1,
    mode,
    generatedAt: catalog.generatedAt,
    inventoryAvailable,
    products,
    summary: {
      products: products.length,
      installed: products.filter((item) => item.installed).length,
      updates: products.filter(
        (item) => item.updateStatus === "UPDATE_AVAILABLE",
      ).length,
    },
  };
}

export function buildMockTvStoreCatalog(): TvStoreCatalogResponse {
  const catalog = new CatalogService().build({
    registry: tvStoreMockRegistry,
    releases: tvStoreMockReleases,
    installedApplications: installed,
    cacheRecords: [
      {
        artifactId: "youtube-staging-0.8.4",
        sha256: "A".repeat(64),
        trustState: "SIGNED",
        signingKeyId: "D0A3CB0C",
        verifiedAt: "2026-10-03T12:00:00.000Z",
        cacheAvailability: "CACHED_VERIFIED",
      },
    ],
    now: new Date("2026-10-04T12:00:00.000Z"),
  });
  return toTvStoreCatalog(catalog, "MOCK", true);
}

export const mockTvStoreCatalog = buildMockTvStoreCatalog();
