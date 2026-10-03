import { describe, expect, it } from "vitest";

import { CatalogService } from "@zui-webos/catalog-service";
import type { ProductRelease } from "@zui-webos/catalog-contracts";
import type { InstalledApplication } from "@zui-webos/shared-types";
import {
  mockRegistry,
  mockRelease,
  mockStableRelease,
} from "../../apps/web-portal/src/mock.js";

const app = (id: string, version?: string): InstalledApplication => ({
  id: id as InstalledApplication["id"],
  title: id,
  ...(version === undefined
    ? {}
    : { version: version as InstalledApplication["version"] }),
  source: "ares-install-listfull",
  metadata: {},
});
function build(
  installedApplications: readonly InstalledApplication[],
  releases: readonly ProductRelease[] = [mockStableRelease, mockRelease],
) {
  return new CatalogService().build({
    registry: mockRegistry,
    releases,
    installedApplications,
    now: new Date("2026-10-03T00:00:00.000Z"),
  });
}
function comparison(catalog: ReturnType<typeof build>, appId: string) {
  return catalog.comparisons.find((item) => item.appId === appId)!;
}

describe("CatalogService and UpdateEvaluationService", () => {
  it("evaluates same, upgrade, ahead, and not-installed states", () => {
    expect(
      comparison(
        build([app("com.zui.webos.youtube.staging", "0.8.4")]),
        "com.zui.webos.youtube.staging",
      ).versionStatus,
    ).toBe("UP_TO_DATE");
    expect(
      comparison(
        build([app("youtube.leanback.v4", "0.8.3")]),
        "youtube.leanback.v4",
      ).versionStatus,
    ).toBe("UPDATE_AVAILABLE");
    expect(
      comparison(
        build([app("youtube.leanback.v4", "0.9.0")]),
        "youtube.leanback.v4",
      ).versionStatus,
    ).toBe("AHEAD_OF_CATALOG");
    expect(comparison(build([]), "youtube.leanback.v4").versionStatus).toBe(
      "NOT_INSTALLED",
    );
  });

  it("does not invent ordering for invalid SemVer", () => {
    expect(
      comparison(
        build([app("youtube.leanback.v4", "next")]),
        "youtube.leanback.v4",
      ).versionStatus,
    ).toBe("VERSION_UNKNOWN");
  });

  it("keeps production and staging channels and identities separate", () => {
    const catalog = build([app("youtube.leanback.v4", "0.8.3")], [mockRelease]);
    const production = comparison(catalog, "youtube.leanback.v4");
    expect(production.available.channel).toBe("stable");
    expect(production.available.version).toBeNull();
    expect(production.versionStatus).toBe("NO_COMPATIBLE_RELEASE");
  });

  it("selects the greatest compatible release from multiple candidates", () => {
    const newer: ProductRelease = {
      ...mockRelease,
      version: "0.9.0",
      releaseRef: "staging-0.9.0",
      artifacts: mockRelease.artifacts.map((artifact) => ({
        ...artifact,
        version: "0.9.0",
        artifactId: "youtube-staging-0.9.0",
      })),
    };
    expect(
      comparison(
        build(
          [app("com.zui.webos.youtube.staging", "0.8.4")],
          [mockRelease, newer],
        ),
        "com.zui.webos.youtube.staging",
      ).available.version,
    ).toBe("0.9.0");
  });

  it("normalizes trust, remote evidence, and verified-cache state independently", () => {
    const catalog = new CatalogService().build({
      registry: mockRegistry,
      releases: [mockRelease],
      installedApplications: [],
      cacheRecords: [
        {
          artifactId: mockRelease.artifacts[0]!.artifactId,
          sha256: mockRelease.artifacts[0]!.hash.digest,
          trustState: "SIGNED",
          signingKeyId: "KEY",
          verifiedAt: "2026-10-03T00:00:00.000Z",
          cacheAvailability: "CACHED_VERIFIED",
        },
      ],
      remoteEvidence: [
        {
          artifactId: mockRelease.artifacts[0]!.artifactId,
          availability: "REMOTE_AVAILABLE",
          draft: true,
          prerelease: true,
        },
      ],
    });
    const artifact = catalog.products[1]!.releases[0]!.artifacts[0]!;
    expect(artifact).toMatchObject({
      trustState: "SIGNED",
      cacheAvailability: "CACHED_VERIFIED",
      remoteAvailability: "REMOTE_AVAILABLE",
    });
    expect(catalog.products[1]!.releases[0]).toMatchObject({
      draft: true,
      prerelease: true,
      published: false,
    });
  });

  it("keeps provider evidence untrusted without signed cache verification", () => {
    const catalog = build([]);
    const staging = catalog.products[1]!.releases.find(
      (release) => release.channel === "staging",
    )!;
    expect(staging.trustState).toBe("REPOSITORY_PINNED_HASH");
    expect(staging.artifacts[0]!.cacheAvailability).toBe("NOT_CACHED");
  });
});
