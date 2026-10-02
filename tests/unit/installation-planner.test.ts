import { describe, expect, it } from "vitest";

import type {
  ArtifactVerificationResult,
  ProductRegistry,
} from "@zui-webos/catalog-contracts";
import {
  compareVersions,
  createInstallationPlan,
} from "@zui-webos/installation-planner";
import type { PackageInspection } from "@zui-webos/package-inspector";
import type {
  ApplicationVersion,
  DeviceAlias,
  InstalledApplicationId,
  InventorySnapshot,
} from "@zui-webos/shared-types";

const registry: ProductRegistry = {
  schemaVersion: 1,
  products: [
    {
      id: "youtube",
      displayName: "YouTube",
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

function packageInspection(id: string, version = "1.0.0"): PackageInspection {
  return {
    filename: "candidate.ipk",
    path: "C:\\candidate.ipk",
    size: 100,
    hash: { algorithm: "sha256", digest: "A".repeat(64), size: 100 },
    format: "debian-ar+tar.gz",
    archiveEntries: 4,
    unpackedBytes: 50,
    manifests: [
      {
        archivePath: "appinfo.json",
        id,
        title: "Test",
        version,
        raw: { id, version },
      },
    ],
  };
}

function inventory(id?: string, version = "1.0.0"): InventorySnapshot {
  return {
    device: "tv" as DeviceAlias,
    timestamp: "2026-10-02T00:00:00.000Z",
    source: "ares-install-listfull",
    applications:
      id === undefined
        ? []
        : [
            {
              id: id as InstalledApplicationId,
              version: version as ApplicationVersion,
              source: "ares-install-listfull",
              metadata: {},
            },
          ],
  };
}

function plan(id: string, candidate: string, installed?: string) {
  return createInstallationPlan({
    package: packageInspection(id, candidate),
    registry,
    inventory: inventory(installed === undefined ? undefined : id, installed),
    connectionStatus: "reachable",
  });
}

function pinned(
  deploymentClass: "staging" | "production",
): ArtifactVerificationResult {
  return {
    status: "VERIFIED_PINNED_ARTIFACT",
    trustLevel: "REPOSITORY_PINNED_HASH",
    expectedSha256: "A".repeat(64),
    hashMatches: true,
    expectedSize: 100,
    sizeMatches: true,
    expectedAppId:
      deploymentClass === "staging"
        ? "com.zui.webos.youtube.staging"
        : "youtube.leanback.v4",
    appIdMatches: true,
    expectedVersion: "1.0.0",
    versionMatches: true,
    deploymentClass,
    artifactRecord: null,
  };
}

describe("installation planner", () => {
  it("compares strict semantic versions deterministically", () => {
    expect(compareVersions("1.2.3", "1.3.0")).toBe("UPGRADE");
    expect(compareVersions("2.0.0", "1.9.9")).toBe("DOWNGRADE");
    expect(compareVersions("1.0", "1.0.1")).toBe("UNKNOWN");
  });

  it("reports a package as not installed", () => {
    expect(
      plan("com.zui.webos.youtube.staging", "0.8.4").comparison.versionRelation,
    ).toBe("NOT_INSTALLED");
  });

  it("blocks production overwrite and downgrade without executing anything", () => {
    const result = plan("youtube.leanback.v4", "0.8.4", "0.9.0");
    expect(result.executable).toBe(false);
    expect(result.riskFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PRODUCTION_APP_OVERWRITE",
          severity: "BLOCK",
        }),
        expect.objectContaining({ code: "DOWNGRADE", severity: "BLOCK" }),
        expect.objectContaining({
          code: "UNKNOWN_PACKAGE_PROVENANCE",
          severity: "BLOCK",
        }),
      ]),
    );
  });

  it("classifies isolated staging identity", () => {
    const result = plan("com.zui.webos.youtube.staging", "0.8.4");
    expect(result.comparison.registryMatch.classification).toBe(
      "KNOWN_STAGING_PRODUCT",
    );
    expect(result.riskFlags).toContainEqual(
      expect.objectContaining({ code: "STAGING_APP", severity: "INFO" }),
    );
  });

  it("warns and blocks an unknown app-id collision", () => {
    const result = plan("com.unknown.app", "1.0.0", "1.0.0");
    expect(result.riskFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_PRODUCT" }),
        expect.objectContaining({
          code: "APP_ID_COLLISION",
          severity: "BLOCK",
        }),
        expect.objectContaining({ code: "SAME_VERSION_REINSTALL" }),
      ]),
    );
  });

  it("blocks plans for unreachable devices", () => {
    const result = createInstallationPlan({
      package: packageInspection("com.zui.webos.youtube.staging"),
      registry,
      inventory: inventory(),
      connectionStatus: "unreachable",
    });
    expect(result.riskFlags).toContainEqual(
      expect.objectContaining({
        code: "DEVICE_UNREACHABLE",
        severity: "BLOCK",
      }),
    );
  });

  it("allows signed staging planning while retaining explicit approval", () => {
    const result = createInstallationPlan({
      package: packageInspection("com.zui.webos.youtube.staging"),
      registry,
      inventory: inventory(),
      connectionStatus: "reachable",
      artifactVerification: pinned("staging"),
      signedDistributionTrusted: true,
    });
    expect(result.artifact.trustLevel).toBe("SIGNED");
    expect(result.policyDecision).toBe("ALLOW_WITH_APPROVAL");
    expect(result.requiresExplicitApproval).toBe(true);
  });

  it("keeps signed production artifacts hard-blocked", () => {
    const result = createInstallationPlan({
      package: packageInspection("youtube.leanback.v4"),
      registry,
      inventory: inventory(),
      connectionStatus: "reachable",
      artifactVerification: pinned("production"),
      signedDistributionTrusted: true,
    });
    expect(result.artifact.trustLevel).toBe("SIGNED");
    expect(result.policyDecision).toBe("BLOCK");
    expect(result.executable).toBe(false);
  });

  it("preserves the accepted unsigned pinned staging behavior", () => {
    const result = createInstallationPlan({
      package: packageInspection("com.zui.webos.youtube.staging"),
      registry,
      inventory: inventory(),
      connectionStatus: "reachable",
      artifactVerification: pinned("staging"),
    });
    expect(result.artifact.trustLevel).toBe("REPOSITORY_PINNED_HASH");
    expect(result.policyDecision).toBe("ALLOW_WITH_APPROVAL");
  });
});
