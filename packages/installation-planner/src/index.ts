import { createHash } from "node:crypto";

import {
  matchProduct,
  type ArtifactVerificationResult,
  type DeploymentClass,
  type ProductRegistry,
  type RegistryMatch,
  type TrustLevel,
} from "@zui-webos/catalog-contracts";
import type { PackageInspection } from "@zui-webos/package-inspector";
import type {
  DeviceConnectionStatus,
  InstalledApplication,
  InventorySnapshot,
} from "@zui-webos/shared-types";

export type VersionRelation =
  "NOT_INSTALLED" | "SAME_VERSION" | "UPGRADE" | "DOWNGRADE" | "UNKNOWN";
export type RiskCode =
  | "PRODUCTION_APP_OVERWRITE"
  | "PRODUCTION_DEPLOYMENT_BLOCK"
  | "STAGING_APP"
  | "UNKNOWN_PRODUCT"
  | "UNKNOWN_PACKAGE_PROVENANCE"
  | "DOWNGRADE"
  | "SAME_VERSION_REINSTALL"
  | "APP_ID_COLLISION"
  | "PACKAGE_METADATA_INVALID"
  | "DEVICE_UNREACHABLE"
  | "ARTIFACT_VERIFICATION_FAILED"
  | "ARTIFACT_TRUST_BLOCK"
  | "UNKNOWN_VERSION_RELATION";
export type RiskSeverity = "INFO" | "WARNING" | "BLOCK";
export type PolicyDecision = "ALLOW_WITH_APPROVAL" | "BLOCK";

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
export interface InstallationPlanV2 {
  readonly schemaVersion: 2;
  readonly kind: "APPROVAL_GATED_INSTALLATION_PLAN";
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly deviceAlias: string;
  readonly artifact: {
    readonly path: string;
    readonly filename: string;
    readonly sha256: string;
    readonly size: number;
    readonly appId: string;
    readonly title: string;
    readonly version: string;
    readonly deploymentClass: DeploymentClass | null;
    readonly trustLevel: TrustLevel;
  };
  readonly installedState: {
    readonly installed: boolean;
    readonly appId: string;
    readonly version: string | null;
    readonly protectedApplications: readonly {
      readonly appId: string;
      readonly version: string | null;
    }[];
  };
  readonly comparison: PackageDeploymentComparison;
  readonly artifactVerification: ArtifactVerificationResult;
  readonly riskFlags: readonly InstallationRisk[];
  readonly policyDecision: PolicyDecision;
  readonly proposedCommand: {
    readonly executable: "ares-install";
    readonly args: readonly string[];
  };
  readonly requiresExplicitApproval: true;
  readonly executable: boolean;
  readonly planDigest: string;
}
export type InstallationPlan = InstallationPlanV2;

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
export const DEFAULT_PLAN_TTL_MS = 10 * 60 * 1000;
export const MIN_PLAN_TTL_MS = 60 * 1000;
export const MAX_PLAN_TTL_MS = 30 * 60 * 1000;
const PROTECTED_PRODUCTION_IDS = [
  "com.zui.player",
  "youtube.leanback.v4",
] as const;

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
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "planDigest")
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}
export function canonicalPlanJson(
  plan: Omit<InstallationPlanV2, "planDigest"> | InstallationPlanV2,
): string {
  return JSON.stringify(canonicalize(plan));
}
export function calculatePlanDigest(
  plan: Omit<InstallationPlanV2, "planDigest"> | InstallationPlanV2,
): string {
  return createHash("sha256")
    .update(canonicalPlanJson(plan), "utf8")
    .digest("hex")
    .toUpperCase();
}
export function validatePlanDigest(plan: InstallationPlanV2): boolean {
  return (
    /^[A-F0-9]{64}$/u.test(plan.planDigest) &&
    calculatePlanDigest(plan) === plan.planDigest
  );
}

export function isInstallationPlanV2(
  value: unknown,
): value is InstallationPlanV2 {
  if (typeof value !== "object" || value === null) return false;
  const plan = value as Partial<InstallationPlanV2>;
  return (
    plan.schemaVersion === 2 &&
    plan.kind === "APPROVAL_GATED_INSTALLATION_PLAN" &&
    typeof plan.createdAt === "string" &&
    typeof plan.expiresAt === "string" &&
    typeof plan.deviceAlias === "string" &&
    typeof plan.planDigest === "string" &&
    typeof plan.artifact === "object" &&
    plan.artifact !== null &&
    typeof plan.artifact.path === "string" &&
    typeof plan.artifact.sha256 === "string" &&
    typeof plan.artifact.appId === "string" &&
    typeof plan.artifact.version === "string" &&
    typeof plan.installedState === "object" &&
    plan.installedState !== null &&
    Array.isArray(plan.installedState.protectedApplications) &&
    Array.isArray(plan.riskFlags) &&
    (plan.policyDecision === "ALLOW_WITH_APPROVAL" ||
      plan.policyDecision === "BLOCK") &&
    typeof plan.executable === "boolean"
  );
}

const noMetadata: ArtifactVerificationResult = {
  status: "NO_RELEASE_METADATA",
  trustLevel: "REGISTRY_MATCH",
  expectedSha256: null,
  hashMatches: null,
  expectedSize: null,
  sizeMatches: null,
  expectedAppId: null,
  appIdMatches: null,
  expectedVersion: null,
  versionMatches: null,
  deploymentClass: null,
  artifactRecord: null,
};

export function createInstallationPlan(input: {
  readonly package: PackageInspection;
  readonly registry: ProductRegistry;
  readonly inventory: InventorySnapshot;
  readonly connectionStatus: DeviceConnectionStatus;
  readonly artifactVerification?: ArtifactVerificationResult;
  readonly now?: Date;
  readonly ttlMs?: number;
  readonly signedDistributionTrusted?: boolean;
}): InstallationPlanV2 {
  const manifest =
    input.package.manifests.length === 1
      ? input.package.manifests[0]
      : undefined;
  if (manifest === undefined)
    throw new Error("A plan requires exactly one package manifest.");
  const ttlMs = input.ttlMs ?? DEFAULT_PLAN_TTL_MS;
  if (
    !Number.isSafeInteger(ttlMs) ||
    ttlMs < MIN_PLAN_TTL_MS ||
    ttlMs > MAX_PLAN_TTL_MS
  )
    throw new Error("Plan TTL is outside the permitted range.");
  const verification = input.artifactVerification ?? noMetadata;
  const registryMatch = matchProduct(
    input.registry,
    manifest.id,
    manifest.vendor,
  );
  const installed =
    input.inventory.applications.find((app) => app.id === manifest.id) ?? null;
  const relation = compareVersions(installed?.version, manifest.version);
  const risks: InstallationRisk[] = [];
  if (input.connectionStatus !== "reachable")
    risks.push(
      risk(
        "DEVICE_UNREACHABLE",
        "BLOCK",
        "The target device is not reachable.",
      ),
    );
  if (registryMatch.classification === "UNKNOWN_PRODUCT")
    risks.push(
      risk("UNKNOWN_PRODUCT", "BLOCK", "The package app ID is not registered."),
    );
  if (verification.status !== "VERIFIED_PINNED_ARTIFACT") {
    risks.push(
      risk(
        "UNKNOWN_PACKAGE_PROVENANCE",
        "BLOCK",
        "The artifact is not pinned by matching repository metadata.",
      ),
    );
    risks.push(
      risk(
        "ARTIFACT_VERIFICATION_FAILED",
        "BLOCK",
        `Artifact verification result: ${verification.status}.`,
      ),
    );
  }
  if (registryMatch.deploymentClass === "staging")
    risks.push(
      risk("STAGING_APP", "INFO", "This is an isolated staging identity."),
    );
  if (registryMatch.deploymentClass === "production") {
    risks.push(
      risk(
        "PRODUCTION_DEPLOYMENT_BLOCK",
        "BLOCK",
        "Production deployment is forbidden in this milestone.",
      ),
    );
    if (installed !== null)
      risks.push(
        risk(
          "PRODUCTION_APP_OVERWRITE",
          "BLOCK",
          "The plan would replace an installed production application.",
        ),
      );
  }
  if (installed !== null && registryMatch.classification === "UNKNOWN_PRODUCT")
    risks.push(
      risk(
        "APP_ID_COLLISION",
        "BLOCK",
        "An unregistered package collides with an installed app ID.",
      ),
    );
  if (relation === "DOWNGRADE")
    risks.push(risk("DOWNGRADE", "BLOCK", "Downgrades are forbidden."));
  if (relation === "SAME_VERSION")
    risks.push(
      risk(
        "SAME_VERSION_REINSTALL",
        "BLOCK",
        "Same-version reinstallation is forbidden.",
      ),
    );
  if (relation === "UNKNOWN")
    risks.push(
      risk(
        "UNKNOWN_VERSION_RELATION",
        "BLOCK",
        "The installed and candidate versions cannot be compared safely.",
      ),
    );
  if (input.signedDistributionTrusted !== true)
    risks.push(
      risk(
        "ARTIFACT_TRUST_BLOCK",
        "BLOCK",
        "A current SIGNED_TRUSTED distribution decision is required.",
      ),
    );
  const policyDecision: PolicyDecision =
    registryMatch.deploymentClass === "staging" &&
    verification.status === "VERIFIED_PINNED_ARTIFACT" &&
    input.signedDistributionTrusted === true &&
    input.connectionStatus === "reachable" &&
    (relation === "NOT_INSTALLED" || relation === "UPGRADE") &&
    !risks.some((item) => item.severity === "BLOCK")
      ? "ALLOW_WITH_APPROVAL"
      : "BLOCK";
  const now = input.now ?? new Date();
  const base: Omit<InstallationPlanV2, "planDigest"> = {
    schemaVersion: 2,
    kind: "APPROVAL_GATED_INSTALLATION_PLAN",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    deviceAlias: input.inventory.device,
    artifact: {
      path: input.package.path,
      filename: input.package.filename,
      sha256: input.package.hash.digest,
      size: input.package.size,
      appId: manifest.id,
      title: manifest.title,
      version: manifest.version,
      deploymentClass:
        verification.deploymentClass ?? registryMatch.deploymentClass,
      trustLevel: input.signedDistributionTrusted
        ? "SIGNED"
        : verification.trustLevel,
    },
    installedState: {
      installed: installed !== null,
      appId: manifest.id,
      version: installed?.version ?? null,
      protectedApplications: PROTECTED_PRODUCTION_IDS.map((appId) => ({
        appId,
        version:
          input.inventory.applications.find((app) => app.id === appId)
            ?.version ?? null,
      })),
    },
    comparison: {
      device: input.inventory.device,
      packageAppId: manifest.id,
      installedApplication: installed,
      sameAppId: installed !== null,
      installedVersion: installed?.version ?? null,
      packageVersion: manifest.version,
      versionRelation: relation,
      registryMatch,
    },
    artifactVerification: verification,
    riskFlags: risks,
    policyDecision,
    proposedCommand: {
      executable: "ares-install",
      args: [input.package.path, "--device", input.inventory.device],
    },
    requiresExplicitApproval: true,
    executable: policyDecision === "ALLOW_WITH_APPROVAL",
  };
  return { ...base, planDigest: calculatePlanDigest(base) };
}
