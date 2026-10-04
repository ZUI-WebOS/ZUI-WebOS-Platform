import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  verifyArtifactMetadata,
  type ProductRelease,
  type TrustLevel,
} from "@zui-webos/catalog-contracts";
import {
  validatePlanDigest,
  type InstallationPlanV2,
  type InstallationRisk,
} from "@zui-webos/installation-planner";
import { inspectIpk } from "@zui-webos/package-inspector";
import { platformDataRoot } from "@zui-webos/runtime-paths";
import type {
  CommandResult,
  DeviceAlias,
  InventorySnapshot,
} from "@zui-webos/shared-types";
import { PlatformError } from "@zui-webos/webos-client";

export type RollbackAvailability =
  "ROLLBACK_AVAILABLE" | "ROLLBACK_UNAVAILABLE" | "ROLLBACK_NOT_REQUIRED";
export interface RollbackPlan {
  readonly availability: RollbackAvailability;
  readonly appId: string;
  readonly previousVersion: string | null;
  readonly previousArtifactSha256: string | null;
  readonly previousArtifactPath: string | null;
  readonly executable: false;
  readonly explanation: string;
}
export interface InstallationReceipt {
  readonly receiptVersion: 1;
  readonly timestamp: string;
  readonly deviceAlias: string;
  readonly planDigest: string;
  readonly artifactSha256: string;
  readonly appId: string;
  readonly version: string;
  readonly deploymentClass: "staging";
  readonly trustLevel: TrustLevel;
  readonly risks: readonly InstallationRisk[];
  readonly approvalValidated: boolean;
  readonly commandExitCode: number | null;
  readonly postInstallVerified: boolean;
  readonly result: "SUCCESS" | "FAILED";
  readonly rollback: RollbackAvailability;
}
export interface InstallExecutionResult {
  readonly commandAccepted: boolean;
  readonly postInstallVerified: boolean;
  readonly installedAppId: string;
  readonly installedVersion: string | null;
  readonly expectedVersion: string;
  readonly verificationWarnings: readonly string[];
  readonly rollback: RollbackAvailability;
  readonly receiptPath: string;
}
export interface InstallerAdapter {
  listInstalledApplications(device: DeviceAlias): Promise<InventorySnapshot>;
  installPackage(
    device: DeviceAlias,
    packagePath: string,
  ): Promise<CommandResult>;
}
export interface ReceiptStore {
  write(receipt: InstallationReceipt): Promise<string>;
  list(): Promise<readonly string[]>;
  hasPlanDigest(planDigest: string): Promise<boolean>;
}

export class FileReceiptStore implements ReceiptStore {
  constructor(
    private readonly directory = join(platformDataRoot(), "receipts"),
  ) {}
  async write(receipt: InstallationReceipt): Promise<string> {
    try {
      await mkdir(this.directory, { recursive: true });
      const path = join(
        this.directory,
        `${receipt.timestamp.replace(/[:.]/gu, "-")}-${receipt.planDigest.slice(0, 16)}.json`,
      );
      await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      return path;
    } catch (error: unknown) {
      throw new PlatformError(
        "RECEIPT_WRITE_FAILED",
        "Unable to persist installation receipt.",
        error instanceof Error ? error.message : undefined,
      );
    }
  }
  async list(): Promise<readonly string[]> {
    try {
      return (await readdir(this.directory))
        .filter((name) => name.endsWith(".json"))
        .map((name) => join(this.directory, name));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async hasPlanDigest(planDigest: string): Promise<boolean> {
    for (const path of await this.list()) {
      try {
        const value: unknown = JSON.parse(await readFile(path, "utf8"));
        if (
          typeof value === "object" &&
          value !== null &&
          (value as { planDigest?: unknown }).planDigest === planDigest
        )
          return true;
      } catch {
        continue;
      }
    }
    return false;
  }
}

function stateMatches(
  plan: InstallationPlanV2,
  inventory: InventorySnapshot,
): boolean {
  if (inventory.device !== plan.deviceAlias) return false;
  const target = inventory.applications.find(
    (app) => app.id === plan.artifact.appId,
  );
  if (
    (target?.version ?? null) !== plan.installedState.version ||
    (target !== undefined) !== plan.installedState.installed
  )
    return false;
  return plan.installedState.protectedApplications.every(
    (expected) =>
      (inventory.applications.find((app) => app.id === expected.appId)
        ?.version ?? null) === expected.version,
  );
}

export class InstallerService {
  constructor(
    private readonly adapter: InstallerAdapter,
    private readonly receipts: ReceiptStore = new FileReceiptStore(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    plan: InstallationPlanV2,
    approval: string,
    releases: readonly ProductRelease[],
  ): Promise<InstallExecutionResult> {
    if (!validatePlanDigest(plan))
      throw new PlatformError(
        "PLAN_TAMPERED",
        "Plan digest does not match canonical plan content.",
      );
    if (approval !== plan.planDigest)
      throw new PlatformError(
        "APPROVAL_REQUIRED",
        "Approval must equal the exact plan digest.",
      );
    if (await this.receipts.hasPlanDigest(plan.planDigest))
      throw new PlatformError(
        "PLAN_STALE",
        "This approval-bound plan already has an execution receipt.",
      );
    if (this.now().getTime() > Date.parse(plan.expiresAt))
      throw new PlatformError("PLAN_EXPIRED", "Installation plan has expired.");
    if (this.now().getTime() < Date.parse(plan.createdAt))
      throw new PlatformError(
        "PLAN_STALE",
        "Installation plan creation time is in the future.",
      );
    if (
      plan.artifact.deploymentClass !== "staging" ||
      plan.artifact.appId === "com.zui.player" ||
      plan.artifact.appId === "youtube.leanback.v4" ||
      plan.policyDecision !== "ALLOW_WITH_APPROVAL" ||
      !plan.executable
    )
      throw new PlatformError(
        "INSTALL_POLICY_BLOCKED",
        "Only approved, policy-allowed staging plans can execute.",
      );

    const inspection = await inspectIpk(plan.artifact.path);
    const manifest =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    if (
      manifest === undefined ||
      inspection.hash.digest !== plan.artifact.sha256 ||
      inspection.size !== plan.artifact.size ||
      manifest.id !== plan.artifact.appId ||
      manifest.version !== plan.artifact.version
    )
      throw new PlatformError(
        "PLAN_STALE",
        "Artifact bytes or identity changed after planning.",
      );
    const verification = verifyArtifactMetadata(releases, {
      filename: inspection.filename,
      sha256: inspection.hash.digest,
      size: inspection.size,
      appId: manifest.id,
      version: manifest.version,
    });
    if (
      verification.status !== "VERIFIED_PINNED_ARTIFACT" ||
      verification.deploymentClass !== "staging"
    )
      throw new PlatformError(
        "UNTRUSTED_ARTIFACT",
        "Artifact no longer matches pinned staging metadata.",
      );
    const before = await this.adapter.listInstalledApplications(
      plan.deviceAlias as DeviceAlias,
    );
    if (!stateMatches(plan, before))
      throw new PlatformError(
        "PLAN_STALE",
        "Installed application state changed after planning.",
      );

    const command = await this.adapter.installPackage(
      plan.deviceAlias as DeviceAlias,
      plan.artifact.path,
    );
    const commandAccepted = !command.timedOut && command.exitCode === 0;
    if (!commandAccepted) {
      const failedReceipt: InstallationReceipt = {
        receiptVersion: 1,
        timestamp: this.now().toISOString(),
        deviceAlias: plan.deviceAlias,
        planDigest: plan.planDigest,
        artifactSha256: plan.artifact.sha256,
        appId: plan.artifact.appId,
        version: plan.artifact.version,
        deploymentClass: "staging",
        trustLevel: plan.artifact.trustLevel,
        risks: plan.riskFlags,
        approvalValidated: true,
        commandExitCode: command.exitCode,
        postInstallVerified: false,
        result: "FAILED",
        rollback: "ROLLBACK_UNAVAILABLE",
      };
      const receiptPath = await this.receipts.write(failedReceipt);
      throw new PlatformError(
        "INSTALL_FAILED",
        "The public webOS install command failed.",
        receiptPath,
      );
    }
    let after: InventorySnapshot;
    try {
      after = await this.adapter.listInstalledApplications(
        plan.deviceAlias as DeviceAlias,
      );
    } catch {
      const receiptPath = await this.receipts.write({
        receiptVersion: 1,
        timestamp: this.now().toISOString(),
        deviceAlias: plan.deviceAlias,
        planDigest: plan.planDigest,
        artifactSha256: plan.artifact.sha256,
        appId: plan.artifact.appId,
        version: plan.artifact.version,
        deploymentClass: "staging",
        trustLevel: plan.artifact.trustLevel,
        risks: plan.riskFlags,
        approvalValidated: true,
        commandExitCode: command.exitCode,
        postInstallVerified: false,
        result: "FAILED",
        rollback: "ROLLBACK_UNAVAILABLE",
      });
      throw new PlatformError(
        "INSTALL_VERIFICATION_FAILED",
        "Post-install inventory could not be read.",
        receiptPath,
      );
    }
    const installed = after.applications.find(
      (app) => app.id === plan.artifact.appId,
    );
    const protectedUnchanged = plan.installedState.protectedApplications.every(
      (expected) =>
        (after.applications.find((app) => app.id === expected.appId)?.version ??
          null) === expected.version,
    );
    const postInstallVerified =
      installed?.version === plan.artifact.version && protectedUnchanged;
    const rollback: RollbackAvailability = postInstallVerified
      ? "ROLLBACK_NOT_REQUIRED"
      : "ROLLBACK_UNAVAILABLE";
    const receipt: InstallationReceipt = {
      receiptVersion: 1,
      timestamp: this.now().toISOString(),
      deviceAlias: plan.deviceAlias,
      planDigest: plan.planDigest,
      artifactSha256: plan.artifact.sha256,
      appId: plan.artifact.appId,
      version: plan.artifact.version,
      deploymentClass: "staging",
      trustLevel: plan.artifact.trustLevel,
      risks: plan.riskFlags,
      approvalValidated: true,
      commandExitCode: command.exitCode,
      postInstallVerified,
      result: postInstallVerified ? "SUCCESS" : "FAILED",
      rollback,
    };
    const receiptPath = await this.receipts.write(receipt);
    if (!postInstallVerified)
      throw new PlatformError(
        "INSTALL_VERIFICATION_FAILED",
        "Post-install inventory verification failed.",
        receiptPath,
      );
    return {
      commandAccepted,
      postInstallVerified,
      installedAppId: installed.id,
      installedVersion: installed.version ?? null,
      expectedVersion: plan.artifact.version,
      verificationWarnings: [],
      rollback,
      receiptPath,
    };
  }
}
