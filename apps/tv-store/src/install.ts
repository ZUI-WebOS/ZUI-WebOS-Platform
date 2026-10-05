import {
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  ArtifactDistributionService,
  GitHubReleaseProvider,
  type DistributionResult,
} from "@zui-webos/artifact-distribution";
import {
  verifyArtifactMetadata,
  type ProductRelease,
} from "@zui-webos/catalog-contracts";
import {
  createInstallationPlan,
  type InstallationPlanV2,
} from "@zui-webos/installation-planner";
import {
  InstallerService,
  type InstallExecutionResult,
  type InstallationExecutionOptions,
} from "@zui-webos/installer-service";
import { inspectIpk } from "@zui-webos/package-inspector";
import type { PublicTrustStore } from "@zui-webos/signed-release";
import type { DeviceAlias, InventorySnapshot } from "@zui-webos/shared-types";
import {
  NodeProcessRunner,
  PlatformError,
  WebOSCliAdapter,
} from "@zui-webos/webos-client";
import { markTvStoreCatalogStale } from "./catalog-invalidation.js";
import type { TvStoreInstallConfig } from "./install-config.js";
import type {
  InstallIntentState,
  InstallProgressPhase,
  InstallSelection,
  PairResponse,
  PublicInstallIntent,
  PublicInstallStatus,
} from "./install-contracts.js";
import {
  loadPublicTrustStore,
  loadTvStoreCatalogSources,
  ResilientDeviceInventory,
  type CatalogSources,
  type InventoryResilienceEvent,
} from "./live.js";

const MAX_PAIR_ATTEMPTS = 5;
const STORE_APP_ID = "com.zui.webos.store.staging";
const PROTECTED_PRODUCTION_IDS = new Set([
  "com.zui.player",
  "youtube.leanback.v4",
]);

export class InstallServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "InstallServiceError";
  }
}

export interface DistributionAdapter {
  verifyCached(
    digest: string,
    trustStore: PublicTrustStore,
  ): Promise<DistributionResult>;
  fetch(input: {
    repository: string;
    tag: string;
    artifactId: string;
    trustStore: PublicTrustStore;
  }): Promise<DistributionResult>;
}

export interface DeviceInstallerAdapter {
  listInstalledApplications(alias: DeviceAlias): Promise<InventorySnapshot>;
  installPackage: WebOSCliAdapter["installPackage"];
}

export interface InstallerExecutor {
  execute(
    plan: InstallationPlanV2,
    approval: string,
    releases: readonly ProductRelease[],
    options?: InstallationExecutionOptions,
  ): Promise<InstallExecutionResult>;
}

export interface InstallDependencies {
  readonly now?: () => Date;
  readonly loadSources?: () => Promise<CatalogSources>;
  readonly loadTrustStore?: () => Promise<PublicTrustStore>;
  readonly distribution?: DistributionAdapter;
  readonly adapter?: DeviceInstallerAdapter;
  readonly installer?: InstallerExecutor;
  readonly markCatalogStale?: () => Promise<void>;
  readonly sessionToken?: () => string;
  readonly intentId?: () => string;
  readonly inventoryEvent?: (event: InventoryResilienceEvent) => void;
}

interface PairingSession {
  readonly id: string;
  readonly token: string;
  readonly expiresAt: string;
  canMutate: boolean;
}

interface StoredIntent {
  readonly id: string;
  readonly sessionId: string;
  readonly plan: InstallationPlanV2;
  readonly releases: readonly ProductRelease[];
  readonly distribution: DistributionResult;
  readonly displayName: string;
  readonly productId: string;
  readonly releaseId: string;
  readonly artifactId: string;
  state: InstallIntentState;
  phase: InstallProgressPhase;
  result: PublicInstallStatus["result"];
  errorCode: string | null;
}

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function repositoryIdentity(repository: string): string {
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/u.exec(
      repository,
    );
  if (match?.[1] === undefined)
    throw new InstallServiceError(
      "CATALOG_SOURCE_INVALID",
      "The catalog repository identity is invalid.",
    );
  return match[1];
}

function defaultAdapter(): WebOSCliAdapter {
  return new WebOSCliAdapter({
    runner: new NodeProcessRunner(),
    timeoutMs: 30_000,
  });
}

export function createResilientDeviceInstallerAdapter(
  adapter: DeviceInstallerAdapter,
  onEvent?: (event: InventoryResilienceEvent) => void,
): DeviceInstallerAdapter {
  const inventory = new ResilientDeviceInventory(
    adapter,
    onEvent === undefined ? {} : { onEvent },
  );
  return {
    listInstalledApplications: (alias) =>
      inventory.listInstalledApplications(alias),
    installPackage: (alias, packagePath) =>
      adapter.installPackage(alias, packagePath),
  };
}

export function generatePairingCode(): string {
  return randomInt(0, 100_000_000).toString().padStart(8, "0");
}

export class StagingInstallCoordinator {
  private readonly now: () => Date;
  private readonly loadSources: () => Promise<CatalogSources>;
  private readonly loadTrustStore: () => Promise<PublicTrustStore>;
  private readonly distribution: DistributionAdapter;
  private readonly adapter: DeviceInstallerAdapter;
  private readonly installer: InstallerExecutor;
  private readonly markCatalogStale: () => Promise<void>;
  private readonly createSessionToken: () => string;
  private readonly createIntentId: () => string;
  private pairAttempts = 0;
  private pairingUsed = false;
  private disarmed = false;
  private session: PairingSession | null = null;
  private readonly intents = new Map<string, StoredIntent>();
  private executionBusy = false;

  constructor(
    readonly config: TvStoreInstallConfig,
    private readonly pairingCode: string,
    dependencies: InstallDependencies = {},
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.loadSources = dependencies.loadSources ?? loadTvStoreCatalogSources;
    this.loadTrustStore = dependencies.loadTrustStore ?? loadPublicTrustStore;
    this.distribution =
      dependencies.distribution ??
      new ArtifactDistributionService(new GitHubReleaseProvider());
    const rawAdapter = dependencies.adapter ?? defaultAdapter();
    const adapter = createResilientDeviceInstallerAdapter(
      rawAdapter,
      dependencies.inventoryEvent ??
        (dependencies.adapter === undefined
          ? (event) =>
              console.log(JSON.stringify({ event: "inventory", ...event }))
          : undefined),
    );
    this.adapter = adapter;
    this.installer = dependencies.installer ?? new InstallerService(adapter);
    this.markCatalogStale =
      dependencies.markCatalogStale ?? markTvStoreCatalogStale;
    this.createSessionToken =
      dependencies.sessionToken ??
      (() => randomBytes(32).toString("base64url"));
    this.createIntentId = dependencies.intentId ?? randomUUID;
  }

  private armActive(): boolean {
    return (
      !this.disarmed && this.now().getTime() < Date.parse(this.config.expiresAt)
    );
  }

  health() {
    return {
      apiVersion: 1,
      armed: this.armActive(),
      stagingOnly: true,
      pairingRequired: this.session === null,
      deviceAlias: this.config.deviceAlias,
      expiresAt: this.config.expiresAt,
    } as const;
  }

  pair(code: string): PairResponse {
    if (!this.armActive())
      throw new InstallServiceError(
        "SERVICE_NOT_ARMED",
        "The staging install service is not armed.",
        403,
      );
    if (
      this.pairingUsed ||
      this.now().getTime() > Date.parse(this.config.pairingExpiresAt)
    )
      throw new InstallServiceError(
        "PAIRING_EXPIRED",
        "The pairing challenge expired; re-arm the service.",
        403,
      );
    if (!/^\d{8}$/u.test(code) || !secureEqual(code, this.pairingCode)) {
      this.pairAttempts += 1;
      if (this.pairAttempts >= MAX_PAIR_ATTEMPTS) this.pairingUsed = true;
      throw new InstallServiceError(
        this.pairingUsed ? "PAIRING_LOCKED" : "PAIRING_INVALID",
        this.pairingUsed
          ? "Pairing is locked; re-arm the service."
          : "The pairing code is invalid.",
        403,
      );
    }
    this.pairingUsed = true;
    const token = this.createSessionToken();
    const expiresAt = new Date(
      Math.min(
        Date.parse(this.config.expiresAt),
        this.now().getTime() + 10 * 60 * 1000,
      ),
    ).toISOString();
    this.session = {
      id: randomUUID(),
      token,
      expiresAt,
      canMutate: true,
    };
    return {
      sessionToken: token,
      expiresAt,
      deviceAlias: this.config.deviceAlias,
      scope: "STAGING_INSTALL",
    };
  }

  private requireSession(token: string, mutation: boolean): PairingSession {
    const session = this.session;
    if (
      session === null ||
      !secureEqual(token, session.token) ||
      this.now().getTime() >= Date.parse(session.expiresAt)
    )
      throw new InstallServiceError(
        "SESSION_INVALID",
        "The install session is invalid or expired.",
        401,
      );
    if (mutation && (!this.armActive() || !session.canMutate))
      throw new InstallServiceError(
        "SESSION_EXPIRED",
        "The install session can no longer authorize a mutation.",
        403,
      );
    return session;
  }

  private publicIntent(intent: StoredIntent): PublicInstallIntent {
    const relation = intent.plan.comparison.versionRelation;
    return {
      intentId: intent.id,
      expiresAt: intent.plan.expiresAt,
      deviceAlias: intent.plan.deviceAlias,
      productId: intent.productId,
      releaseId: intent.releaseId,
      artifactId: intent.artifactId,
      displayName: intent.displayName,
      appId: intent.plan.artifact.appId,
      currentVersion: intent.plan.installedState.version,
      targetVersion: intent.plan.artifact.version,
      action: relation === "UPGRADE" ? "UPDATE" : "INSTALL",
      channel: "staging",
      trustDecision: "SIGNED_TRUSTED",
      signingKeyId: intent.distribution.keyId,
      state: intent.state,
      phase: intent.phase,
    };
  }

  private publicStatus(intent: StoredIntent): PublicInstallStatus {
    return {
      ...this.publicIntent(intent),
      result: intent.result,
      errorCode: intent.errorCode,
    };
  }

  async createIntent(
    token: string,
    selection: InstallSelection,
  ): Promise<PublicInstallIntent> {
    this.requireSession(token, false);
    if (this.executionBusy)
      throw new InstallServiceError(
        "INSTALL_BUSY",
        "An installation is already running.",
        409,
      );
    const session = this.requireSession(token, true);
    if (
      [...this.intents.values()].some(
        (item) =>
          item.state === "AWAITING_APPROVAL" || item.state === "RUNNING",
      )
    )
      throw new InstallServiceError(
        "INSTALL_BUSY",
        "Another install intent is still active.",
        409,
      );
    const remaining = Date.parse(session.expiresAt) - this.now().getTime();
    if (remaining < 60_000)
      throw new InstallServiceError(
        "SESSION_EXPIRING",
        "The session is too close to expiry; re-arm and pair again.",
        409,
      );
    const sources = await this.loadSources();
    const product = sources.registry.products.find(
      (item) => item.id === selection.productId,
    );
    if (product === undefined)
      throw new InstallServiceError(
        "UNKNOWN_PRODUCT",
        "The requested catalog product is unknown.",
        404,
      );
    const release = sources.releases.find(
      (item) =>
        item.productId === selection.productId &&
        item.releaseRef === selection.releaseId,
    );
    if (release === undefined)
      throw new InstallServiceError(
        "UNKNOWN_RELEASE",
        "The requested catalog release is unknown.",
        404,
      );
    const artifact = release.artifacts.find(
      (item) => item.artifactId === selection.artifactId,
    );
    if (artifact === undefined)
      throw new InstallServiceError(
        "UNKNOWN_ARTIFACT",
        "The requested catalog artifact is unknown.",
        404,
      );
    if (
      release.channel !== "staging" ||
      artifact.deploymentClass !== "staging" ||
      PROTECTED_PRODUCTION_IDS.has(artifact.appId)
    )
      throw new InstallServiceError(
        "PRODUCTION_INSTALL_BLOCKED",
        "Production installation is impossible through this service.",
        403,
      );
    if (artifact.appId === STORE_APP_ID || product.id === "zui-store")
      throw new InstallServiceError(
        "STORE_SELF_UPDATE_BLOCKED",
        "ZUI Store cannot update itself through the catalog flow.",
        403,
      );
    if (
      artifact.source.type !== "GITHUB_RELEASE" ||
      release.releaseRef === undefined
    )
      throw new InstallServiceError(
        "ARTIFACT_NOT_AVAILABLE",
        "The staging artifact has no trusted distribution source.",
      );
    const trustStore = await this.loadTrustStore();
    let distributed: DistributionResult;
    try {
      distributed = await this.distribution.verifyCached(
        artifact.hash.digest,
        trustStore,
      );
    } catch {
      distributed = await this.distribution.fetch({
        repository: repositoryIdentity(product.repository),
        tag: release.releaseRef,
        artifactId: artifact.artifactId,
        trustStore,
      });
    }
    if (
      distributed.trustDecision !== "SIGNED_TRUSTED" ||
      distributed.artifactId !== artifact.artifactId ||
      distributed.sha256 !== artifact.hash.digest.toUpperCase()
    )
      throw new InstallServiceError(
        "ARTIFACT_TRUST_BLOCKED",
        "The artifact does not have the exact required signed trust decision.",
        403,
      );
    const inspection = await inspectIpk(distributed.artifactPath);
    const manifest = inspection.manifests[0];
    if (
      inspection.manifests.length !== 1 ||
      manifest === undefined ||
      manifest.id !== artifact.appId ||
      manifest.version !== artifact.version
    )
      throw new InstallServiceError(
        "ARTIFACT_IDENTITY_MISMATCH",
        "The verified package identity does not match the catalog selection.",
        403,
      );
    const inventory = await this.adapter.listInstalledApplications(
      this.config.deviceAlias,
    );
    const plan = createInstallationPlan({
      package: inspection,
      registry: sources.registry,
      inventory,
      connectionStatus: "reachable",
      artifactVerification: verifyArtifactMetadata(sources.releases, {
        filename: artifact.filename,
        sha256: inspection.hash.digest,
        size: inspection.size,
        appId: manifest.id,
        version: manifest.version,
      }),
      signedDistributionTrusted: true,
      now: this.now(),
      ttlMs: Math.min(10 * 60 * 1000, remaining),
    });
    if (
      plan.policyDecision !== "ALLOW_WITH_APPROVAL" ||
      !plan.executable ||
      (plan.comparison.versionRelation !== "NOT_INSTALLED" &&
        plan.comparison.versionRelation !== "UPGRADE")
    )
      throw new InstallServiceError(
        "INSTALL_POLICY_BLOCKED",
        "The staging selection does not satisfy installation policy.",
        403,
      );
    const intent: StoredIntent = {
      id: this.createIntentId(),
      sessionId: session.id,
      plan,
      releases: sources.releases,
      distribution: distributed,
      displayName: product.displayName,
      productId: product.id,
      releaseId: release.releaseRef,
      artifactId: artifact.artifactId,
      state: "AWAITING_APPROVAL",
      phase: "PREPARING",
      result: null,
      errorCode: null,
    };
    this.intents.set(intent.id, intent);
    return this.publicIntent(intent);
  }

  private requireIntent(
    token: string,
    intentId: string,
    mutation: boolean,
  ): StoredIntent {
    const session = this.requireSession(token, mutation);
    const intent = this.intents.get(intentId);
    if (intent === undefined || intent.sessionId !== session.id)
      throw new InstallServiceError(
        "INTENT_NOT_FOUND",
        "The install intent was not found for this session.",
        404,
      );
    if (
      intent.state === "AWAITING_APPROVAL" &&
      this.now().getTime() > Date.parse(intent.plan.expiresAt)
    ) {
      intent.state = "EXPIRED";
      intent.errorCode = "PLAN_EXPIRED";
    }
    return intent;
  }

  cancel(token: string, intentId: string): PublicInstallStatus {
    const intent = this.requireIntent(token, intentId, true);
    if (intent.state !== "AWAITING_APPROVAL")
      throw new InstallServiceError(
        "INTENT_NOT_ACTIONABLE",
        "The install intent can no longer be cancelled.",
        409,
      );
    intent.state = "CANCELLED";
    intent.errorCode = "CANCELLED";
    return this.publicStatus(intent);
  }

  status(token: string, intentId: string): PublicInstallStatus {
    return this.publicStatus(this.requireIntent(token, intentId, false));
  }

  approve(token: string, intentId: string): PublicInstallStatus {
    this.requireSession(token, false);
    if (this.executionBusy)
      throw new InstallServiceError(
        "INSTALL_BUSY",
        "An installation is already running.",
        409,
      );
    const session = this.requireSession(token, true);
    const intent = this.requireIntent(token, intentId, true);
    if (intent.state !== "AWAITING_APPROVAL")
      throw new InstallServiceError(
        "INTENT_NOT_ACTIONABLE",
        "The install intent is expired, used, cancelled, or already running.",
        409,
      );
    intent.state = "RUNNING";
    intent.phase = "VERIFYING_PACKAGE";
    session.canMutate = false;
    this.executionBusy = true;
    void this.executeIntent(intent);
    return this.publicStatus(intent);
  }

  private async executeIntent(intent: StoredIntent): Promise<void> {
    try {
      const current = await this.distribution.verifyCached(
        intent.plan.artifact.sha256,
        await this.loadTrustStore(),
      );
      if (
        current.trustDecision !== "SIGNED_TRUSTED" ||
        current.artifactId !== intent.artifactId ||
        current.sha256 !== intent.plan.artifact.sha256 ||
        current.keyId !== intent.distribution.keyId
      )
        throw new InstallServiceError(
          "PLAN_CHANGED",
          "The signed artifact state changed; review a new plan.",
          409,
        );
      const result = await this.installer.execute(
        intent.plan,
        intent.plan.planDigest,
        intent.releases,
        {
          origin: "TV_STORE",
          onPhase: (phase) => {
            intent.phase = phase;
          },
        },
      );
      intent.state = "SUCCEEDED";
      intent.phase = "COMPLETE";
      intent.result = {
        installedAppId: result.installedAppId,
        installedVersion: result.installedVersion ?? result.expectedVersion,
        postInstallVerified: true,
      };
      this.disarmed = true;
      await this.markCatalogStale();
    } catch (error: unknown) {
      intent.state = "FAILED";
      intent.errorCode =
        error instanceof InstallServiceError || error instanceof PlatformError
          ? error.code
          : "INSTALL_FAILED";
    } finally {
      this.executionBusy = false;
    }
  }
}
