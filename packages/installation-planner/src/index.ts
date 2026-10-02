import {
  matchProduct,
  type ProductRegistry,
  type RegistryMatch,
} from "@zui-webos/catalog-contracts";
import type {
  AppManifest,
  PackageInspection,
} from "@zui-webos/package-inspector";
import type {
  DeviceConnectionStatus,
  InstalledApplication,
  InventorySnapshot,
} from "@zui-webos/shared-types";

export type VersionRelation =
  "NOT_INSTALLED" | "SAME_VERSION" | "UPGRADE" | "DOWNGRADE" | "UNKNOWN";

export type RiskCode =
  | "PRODUCTION_APP_OVERWRITE"
  | "STAGING_APP"
  | "UNKNOWN_PRODUCT"
  | "UNKNOWN_PACKAGE_PROVENANCE"
  | "DOWNGRADE"
  | "SAME_VERSION_REINSTALL"
  | "APP_ID_COLLISION"
  | "PACKAGE_METADATA_INVALID"
  | "DEVICE_UNREACHABLE";

export type RiskSeverity = "INFO" | "WARNING" | "BLOCK";

export interface InstallationRisk {
  readonly code: RiskCode;
  readonly severity: RiskSeverity;
  readonly explanation: string;
}

export interface PackageDeploymentComparison {
  readonly device: string;
  readonly packageAppId: string | null;
  readonly installedApplication: InstalledApplication | null;
  readonly sameAppId: boolean;
  readonly installedVersion: string | null;
  readonly packageVersion: string | null;
  readonly versionRelation: VersionRelation;
  readonly registryMatch: RegistryMatch;
}

export interface InstallationPlan {
  readonly kind: "READ_ONLY_INSTALLATION_PLAN";
  readonly device: string;
  readonly deviceConnection: DeviceConnectionStatus;
  readonly package: PackageInspection;
  readonly manifest: AppManifest | null;
  readonly comparison: PackageDeploymentComparison;
  readonly risks: readonly InstallationRisk[];
  readonly proposedCommand: {
    readonly executable: "ares-install";
    readonly args: readonly string[];
  };
  readonly wouldOverwriteExistingApp: boolean;
  readonly requiresExplicitApproval: true;
  readonly executable: false;
}

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

export function compareVersions(
  installed: string | undefined,
  candidate: string | undefined,
): VersionRelation {
  if (installed === undefined) return "NOT_INSTALLED";
  if (candidate === undefined) return "UNKNOWN";
  const left = SEMVER.exec(installed);
  const right = SEMVER.exec(candidate);
  if (left === null || right === null) return "UNKNOWN";
  for (let index = 1; index <= 3; index += 1) {
    const a = Number(left[index]);
    const b = Number(right[index]);
    if (b > a) return "UPGRADE";
    if (b < a) return "DOWNGRADE";
  }
  return installed === candidate ? "SAME_VERSION" : "UNKNOWN";
}

function risk(
  code: RiskCode,
  severity: RiskSeverity,
  explanation: string,
): InstallationRisk {
  return { code, severity, explanation };
}

export function createInstallationPlan(input: {
  readonly package: PackageInspection;
  readonly registry: ProductRegistry;
  readonly inventory: InventorySnapshot;
  readonly connectionStatus: DeviceConnectionStatus;
}): InstallationPlan {
  const manifest =
    input.package.manifests.length === 1
      ? (input.package.manifests[0] ?? null)
      : null;
  const registryMatch = matchProduct(
    input.registry,
    manifest?.id ?? "",
    manifest?.vendor,
  );
  const installed = manifest
    ? (input.inventory.applications.find((app) => app.id === manifest.id) ??
      null)
    : null;
  const relation = compareVersions(installed?.version, manifest?.version);
  const risks: InstallationRisk[] = [];

  if (input.connectionStatus !== "reachable") {
    risks.push(
      risk(
        "DEVICE_UNREACHABLE",
        "BLOCK",
        "The target device is not reachable.",
      ),
    );
  }
  if (manifest === null) {
    risks.push(
      risk(
        "PACKAGE_METADATA_INVALID",
        "BLOCK",
        "A plan requires exactly one valid application manifest.",
      ),
    );
  }
  if (registryMatch.classification === "UNKNOWN_PRODUCT") {
    risks.push(
      risk(
        "UNKNOWN_PRODUCT",
        "WARNING",
        "The package app ID is not registered.",
      ),
    );
  }
  risks.push(
    risk(
      "UNKNOWN_PACKAGE_PROVENANCE",
      "WARNING",
      "App ID and metadata matches do not cryptographically authenticate this artifact.",
    ),
  );
  if (registryMatch.deploymentClass === "staging") {
    risks.push(
      risk("STAGING_APP", "INFO", "This app ID is isolated staging identity."),
    );
  }
  if (installed !== null && registryMatch.deploymentClass === "production") {
    risks.push(
      risk(
        "PRODUCTION_APP_OVERWRITE",
        "BLOCK",
        "The plan would replace an installed production application.",
      ),
    );
  }
  if (
    installed !== null &&
    registryMatch.classification === "UNKNOWN_PRODUCT"
  ) {
    risks.push(
      risk(
        "APP_ID_COLLISION",
        "BLOCK",
        "An unregistered package collides with an installed app ID.",
      ),
    );
  }
  if (relation === "DOWNGRADE") {
    risks.push(
      risk(
        "DOWNGRADE",
        "BLOCK",
        "The package version is lower than the installed version.",
      ),
    );
  }
  if (relation === "SAME_VERSION") {
    risks.push(
      risk(
        "SAME_VERSION_REINSTALL",
        "WARNING",
        "The package version equals the installed version.",
      ),
    );
  }

  return {
    kind: "READ_ONLY_INSTALLATION_PLAN",
    device: input.inventory.device,
    deviceConnection: input.connectionStatus,
    package: input.package,
    manifest,
    comparison: {
      device: input.inventory.device,
      packageAppId: manifest?.id ?? null,
      installedApplication: installed,
      sameAppId: installed !== null,
      installedVersion: installed?.version ?? null,
      packageVersion: manifest?.version ?? null,
      versionRelation: relation,
      registryMatch,
    },
    risks,
    proposedCommand: {
      executable: "ares-install",
      args: [input.package.path, "--device", input.inventory.device],
    },
    wouldOverwriteExistingApp: installed !== null,
    requiresExplicitApproval: true,
    executable: false,
  };
}
