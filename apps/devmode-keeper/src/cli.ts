#!/usr/bin/env node
import {
  access,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ArtifactDistributionService,
  GitHubReleaseProvider,
} from "@zui-webos/artifact-distribution";

import {
  matchProduct,
  validateReleaseRecords,
  validateRegistry,
  verifyArtifactMetadata,
  type ProductRelease,
  type ProductRegistry,
  type RegistryMatch,
} from "@zui-webos/catalog-contracts";
import {
  createInstallationPlan,
  isInstallationPlanV2,
} from "@zui-webos/installation-planner";
import {
  FileReceiptStore,
  InstallerService,
} from "@zui-webos/installer-service";
import {
  inspectIpk,
  type PackageInspection,
} from "@zui-webos/package-inspector";
import {
  GhCliGitHubReleaseApi,
  GitHubReleasePublisher,
  loadPreparedStagingRelease,
  StagingKeyStore,
  PinnedArtifactStager,
  StagingReleasePipeline,
  summarizePreparedRelease,
} from "@zui-webos/release-operations";
import {
  createEphemeralStagingSigner,
  validateManifest,
  validateTrustStore,
  verifyReleaseManifest,
  type PublicTrustStore,
  type ReleaseManifestPayload,
  type ReleaseSignature,
} from "@zui-webos/signed-release";

import { createLogger } from "./logger.js";
import { loadConfig, type ConfigOverrides } from "./config.js";
import { DevModeKeeperService } from "./service.js";
import {
  NodeProcessRunner,
  PlatformError,
  WebOSCliAdapter,
} from "@zui-webos/webos-client";

interface ParsedArguments {
  readonly command: readonly string[];
  readonly json: boolean;
  readonly dryRun: boolean;
  readonly app?: string;
  readonly save?: string;
  readonly approve?: string;
  readonly planTtlMinutes?: number;
  readonly ephemeralStaging: boolean;
  readonly overrides: ConfigOverrides;
}

const usage = `ZUI webOS Platform CLI

Usage:
  zui-webos devices list [--json]
  zui-webos devices inspect --device <alias> [--json]
  zui-webos apps list --device <alias> [--json]
  zui-webos apps inspect --device <alias> --app <app-id> [--json]
  zui-webos package inspect <path.ipk> [--json]
  zui-webos package verify <path.ipk> [--json]
  zui-webos install plan <path.ipk> --device <alias> [--save <plan.json>] [--plan-ttl-minutes <1-30>] [--json]
  zui-webos install execute <plan.json> --approve <plan-digest> [--json]
  zui-webos install receipts [--json]
  zui-webos release list [--json]
  zui-webos release inspect <artifact-id> [--json]
  zui-webos trust keys list [--json]
  zui-webos trust keys inspect <key-id> [--json]
  zui-webos trust keys lifecycle <key-id> <RETIRED|REVOKED> <output.json>
  zui-webos trust key generate-staging [--json]
  zui-webos release manifest build <artifact-id> <source-commit> <output.json>
  zui-webos release manifest sign <manifest.json> <signature.json> <public-key.json> --ephemeral-staging
  zui-webos release manifest verify <manifest.json> <signature.json> [--json]
  zui-webos artifact fetch <owner/repo> <tag> <artifact-id> [--json]
  zui-webos artifact cache list [--json]
  zui-webos artifact cache verify <sha256> [--json]
  zui-webos release staging prepare <artifact-id> <path.ipk> <source-repository-path> <source-commit> <release-id> [--json]
  zui-webos release staging stage-input <artifact-id> <path.ipk> [--json]
  zui-webos release staging verify <bundle-directory> [--json]
  zui-webos release staging upload <bundle-directory> --approve <release-id> [--json]
  zui-webos release staging resume-upload <bundle-directory> <github-release-id> --approve <release-id> [--json]
  zui-webos devmode status [--device <alias>] [--json]
  zui-webos devmode extend [--device <alias>] [--dry-run] [--json]
  zui-webos devmode ensure [--device <alias>] [--dry-run] [--json]
  zui-webos doctor [--device <alias>] [--json]

Configuration precedence: CLI arguments, environment, local user config, defaults.
Environment: ZUI_WEBOS_DEVICE, ZUI_WEBOS_TIMEOUT_MS,
ZUI_DEVMODE_RENEW_THRESHOLD_HOURS, ZUI_WEBOS_CONFIG.
Secret input: ZUI_WEBOS_STAGING_SIGNING_PASSPHRASE (optional; hidden prompt preferred).`;

function optionValue(
  args: readonly string[],
  index: number,
  option: string,
): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new PlatformError("INVALID_ARGUMENT", `${option} requires a value.`);
  }
  return value;
}

export function parseArguments(args: readonly string[]): ParsedArguments {
  const command: string[] = [];
  let json = false;
  let dryRun = false;
  let app: string | undefined;
  let save: string | undefined;
  let approve: string | undefined;
  let planTtlMinutes: number | undefined;
  let ephemeralStaging = false;
  let device: string | undefined;
  let timeoutMs: number | undefined;
  let thresholdHours: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === undefined) continue;
    switch (value) {
      case "--":
        break;
      case "--json":
        json = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--device":
        device = optionValue(args, index, value);
        index += 1;
        break;
      case "--app":
        app = optionValue(args, index, value);
        index += 1;
        break;
      case "--save":
        save = optionValue(args, index, value);
        index += 1;
        break;
      case "--approve":
        approve = optionValue(args, index, value);
        index += 1;
        break;
      case "--plan-ttl-minutes":
        planTtlMinutes = Number(optionValue(args, index, value));
        if (
          !Number.isFinite(planTtlMinutes) ||
          planTtlMinutes < 1 ||
          planTtlMinutes > 30
        )
          throw new PlatformError(
            "INVALID_ARGUMENT",
            "--plan-ttl-minutes requires a number.",
          );
        index += 1;
        break;
      case "--ephemeral-staging":
        ephemeralStaging = true;
        break;
      case "--timeout-ms":
        timeoutMs = Number(optionValue(args, index, value));
        index += 1;
        break;
      case "--threshold-hours":
        thresholdHours = Number(optionValue(args, index, value));
        index += 1;
        break;
      case "--help":
      case "-h":
        command.push("help");
        break;
      default:
        if (value.startsWith("--")) {
          throw new PlatformError(
            "INVALID_ARGUMENT",
            `Unknown option '${value}'.`,
          );
        }
        command.push(value);
    }
  }

  return {
    command,
    json,
    dryRun,
    ...(app === undefined ? {} : { app }),
    ...(save === undefined ? {} : { save }),
    ...(approve === undefined ? {} : { approve }),
    ...(planTtlMinutes === undefined ? {} : { planTtlMinutes }),
    ephemeralStaging,
    overrides: {
      ...(device === undefined ? {} : { device }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(thresholdHours === undefined ? {} : { thresholdHours }),
    },
  };
}

async function loadReleaseRecords(
  registry: ProductRegistry,
): Promise<ProductRelease[]> {
  const root = new URL("../../../repository/releases/", import.meta.url);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const records: unknown[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    records.push(
      JSON.parse(
        await readFile(join(entry.parentPath, entry.name), "utf8"),
      ) as unknown,
    );
  }
  const validation = validateReleaseRecords(records, registry);
  if (!validation.valid)
    throw new PlatformError(
      "RELEASE_METADATA_INVALID",
      "Release metadata validation failed.",
      validation.errors.join("; "),
    );
  return records as ProductRelease[];
}

async function loadTrustStore(): Promise<PublicTrustStore> {
  const value: unknown = JSON.parse(
    await readFile(
      new URL("../../../repository/trust/keys.json", import.meta.url),
      "utf8",
    ),
  );
  if (!validateTrustStore(value))
    throw new PlatformError(
      "MANIFEST_INVALID",
      "Public trust store is invalid.",
    );
  return value;
}

async function verifySignedCacheArtifact(
  inspection: PackageInspection,
): Promise<boolean> {
  const metadataPath = join(dirname(inspection.path), "verified-metadata.json");
  try {
    await access(metadataPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  const result = await new ArtifactDistributionService(
    new GitHubReleaseProvider(),
  ).verifyCached(inspection.hash.digest, await loadTrustStore());
  const expectedPath = resolve(await realpath(result.artifactPath));
  const selectedPath = resolve(await realpath(inspection.path));
  const samePath =
    process.platform === "win32"
      ? expectedPath.toLocaleLowerCase("en-US") ===
        selectedPath.toLocaleLowerCase("en-US")
      : expectedPath === selectedPath;
  if (!samePath)
    throw new PlatformError(
      "CACHE_VERIFICATION_FAILED",
      "Signed cache metadata does not bind the selected artifact path.",
    );
  return true;
}

function validateAppId(value: string | undefined): string {
  if (
    value === undefined ||
    value.length > 255 ||
    !/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/u.test(value)
  ) {
    throw new PlatformError(
      "INVALID_ARGUMENT",
      "--app requires a valid application ID.",
    );
  }
  return value;
}

async function loadProductRegistry(): Promise<ProductRegistry> {
  const url = new URL(
    "../../../repository/apps/products.json",
    import.meta.url,
  );
  const value: unknown = JSON.parse(await readFile(url, "utf8"));
  if (!validateRegistry(value)) {
    throw new PlatformError(
      "INVALID_ARGUMENT",
      "The product registry is invalid.",
    );
  }
  return value;
}

function packageSummary(
  inspection: PackageInspection,
  matches: readonly (RegistryMatch & { readonly appId: string })[],
): string {
  const manifests = inspection.manifests
    .map(
      (manifest) =>
        `${manifest.id} ${manifest.version} (${manifest.archivePath})`,
    )
    .join(", ");
  return [
    `Package: ${inspection.filename}`,
    `SHA256: ${inspection.hash.digest}`,
    `Size: ${inspection.size} bytes`,
    `Manifest: ${manifests}`,
    `Registry: ${matches.map((match) => `${match.product?.displayName ?? "unknown"} ${match.classification}`).join(", ")}`,
    "Authenticity verified: no",
  ].join("\n");
}

async function hiddenPassphrase(prompt: string): Promise<Buffer> {
  const fromEnvironment = process.env.ZUI_WEBOS_STAGING_SIGNING_PASSPHRASE;
  if (fromEnvironment !== undefined) {
    delete process.env.ZUI_WEBOS_STAGING_SIGNING_PASSPHRASE;
    return Buffer.from(fromEnvironment, "utf8");
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new PlatformError(
      "SIGNING_KEY_PASSPHRASE_INVALID",
      "A TTY hidden prompt or ZUI_WEBOS_STAGING_SIGNING_PASSPHRASE is required.",
    );
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const bytes: number[] = [];
  try {
    return await new Promise<Buffer>((resolveSecret, rejectSecret) => {
      const onData = (chunk: Buffer): void => {
        for (const byte of chunk) {
          if (byte === 3) {
            process.stdin.off("data", onData);
            rejectSecret(
              new PlatformError(
                "SIGNING_KEY_PASSPHRASE_INVALID",
                "Passphrase entry was cancelled.",
              ),
            );
            return;
          }
          if (byte === 13 || byte === 10) {
            process.stdin.off("data", onData);
            process.stdout.write("\n");
            resolveSecret(Buffer.from(bytes));
            return;
          }
          if (byte === 8 || byte === 127) bytes.pop();
          else bytes.push(byte);
        }
      };
      process.stdin.on("data", onData);
    });
  } finally {
    bytes.fill(0);
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}

async function generationPassphrase(): Promise<Buffer> {
  const environmentProvided =
    process.env.ZUI_WEBOS_STAGING_SIGNING_PASSPHRASE !== undefined;
  const first = await hiddenPassphrase(
    "New staging signing passphrase (hidden): ",
  );
  if (environmentProvided) return first;
  const second = await hiddenPassphrase("Confirm passphrase (hidden): ");
  if (!first.equals(second)) {
    first.fill(0);
    second.fill(0);
    throw new PlatformError(
      "SIGNING_KEY_PASSPHRASE_INVALID",
      "Passphrase confirmation did not match.",
    );
  }
  second.fill(0);
  return first;
}

async function execute(args: readonly string[]): Promise<number> {
  const parsed = parseArguments(args);
  const logger = createLogger(parsed.json);
  if (parsed.command.length === 0 || parsed.command[0] === "help") {
    logger.result(usage);
    return 0;
  }

  const config = await loadConfig(parsed.overrides);
  const adapter = new WebOSCliAdapter({
    runner: new NodeProcessRunner(),
    timeoutMs: config.timeoutMs,
  });
  const service = new DevModeKeeperService(adapter);
  const route = parsed.command.join(" ");
  const commandGroup = parsed.command[0];
  const commandAction = parsed.command[1];
  const positionalPath = parsed.command[2];
  const emit = (value: unknown, human: string): void => {
    logger.result(parsed.json ? value : human);
  };

  if (route === "trust key generate-staging") {
    const passphrase = await generationPassphrase();
    try {
      const result = await new StagingKeyStore().generate(passphrase);
      emit(
        {
          keyId: result.trustEntry.keyId,
          algorithm: result.trustEntry.algorithm,
          scopes: result.trustEntry.scopes,
          status: result.trustEntry.status,
          publicMetadataPath: result.publicMetadataPath,
          permissions: result.permissions,
        },
        `Encrypted staging key created.\nKey ID: ${result.trustEntry.keyId}\nPublic metadata: ${result.publicMetadataPath}\nPermissions: ${result.permissions.method}`,
      );
      return 0;
    } finally {
      passphrase.fill(0);
    }
  }

  if (route === "trust keys list") {
    const store = await loadTrustStore();
    emit(
      store,
      store.keys
        .map((key) => `${key.keyId} ${key.status} ${key.scopes.join(",")}`)
        .join("\n"),
    );
    return 0;
  }

  if (commandGroup === "trust" && commandAction === "keys") {
    const operation = parsed.command[2];
    const keyId = parsed.command[3];
    const store = await loadTrustStore();
    const key = store.keys.find((candidate) => candidate.keyId === keyId);
    if (operation === "inspect") {
      const inspected = store.keys.find(
        (candidate) => candidate.keyId === keyId,
      );
      if (inspected === undefined)
        throw new PlatformError(
          "SIGNING_KEY_UNKNOWN",
          "Signing key was not found in the public trust store.",
        );
      emit(
        inspected,
        `${inspected.keyId} ${inspected.status} ${inspected.scopes.join(",")}`,
      );
      return 0;
    }
    if (operation === "lifecycle") {
      const status = parsed.command[4];
      const output = parsed.command[5];
      if (
        key === undefined ||
        (status !== "RETIRED" && status !== "REVOKED") ||
        output === undefined
      )
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "trust keys lifecycle requires key ID, RETIRED or REVOKED, and a new output path.",
        );
      const updated: PublicTrustStore = {
        ...store,
        keys: store.keys.map((candidate) =>
          candidate.keyId === keyId ? { ...candidate, status } : candidate,
        ),
      };
      await writeFile(output, `${JSON.stringify(updated, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      emit(
        updated,
        `Proposed trust store written without overwriting current state: ${output}`,
      );
      return 0;
    }
  }

  if (commandGroup === "release" && commandAction === "staging") {
    const operation = parsed.command[2];
    if (operation === "stage-input") {
      const [artifactId, sourcePath] = parsed.command.slice(3);
      if (artifactId === undefined || sourcePath === undefined)
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "release staging stage-input requires artifact ID and IPK path.",
        );
      const registry = await loadProductRegistry();
      const staged = await new PinnedArtifactStager().stage({
        releases: await loadReleaseRecords(registry),
        artifactId,
        sourcePath,
      });
      emit(
        staged,
        `Pinned staging input verified.\nArtifact: ${staged.artifactPath}\nSHA256: ${staged.sha256}`,
      );
      return 0;
    }
    if (operation === "prepare") {
      const [
        artifactId,
        artifactPath,
        sourceRepositoryPath,
        sourceCommit,
        releaseId,
      ] = parsed.command.slice(3);
      if (
        artifactId === undefined ||
        artifactPath === undefined ||
        sourceRepositoryPath === undefined ||
        sourceCommit === undefined ||
        releaseId === undefined
      )
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "release staging prepare requires artifact ID, IPK path, source repository path, source commit, and release ID.",
        );
      const passphrase = await hiddenPassphrase(
        "Staging signing passphrase (hidden): ",
      );
      try {
        const registry = await loadProductRegistry();
        const prepared = await new StagingReleasePipeline().prepare({
          registry,
          releases: await loadReleaseRecords(registry),
          trustStore: await loadTrustStore(),
          artifactId,
          artifactPath,
          sourceRepositoryPath,
          sourceCommit,
          releaseId,
          signer: await new StagingKeyStore().unlock(passphrase),
        });
        emit(
          prepared.report,
          `${summarizePreparedRelease(prepared)}\nBundle: ${prepared.directory}\nLocal verification: PASS`,
        );
        return 0;
      } finally {
        passphrase.fill(0);
      }
    }
    if (operation === "verify") {
      const directory = parsed.command[3];
      if (directory === undefined)
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "release staging verify requires a bundle directory.",
        );
      const report = await new StagingReleasePipeline().verifyBundle(
        directory,
        await loadTrustStore(),
      );
      emit(report, `SIGNED_TRUSTED\nRelease: ${report.releaseId}`);
      return 0;
    }
    if (operation === "upload") {
      const directory = parsed.command[3];
      if (directory === undefined)
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "release staging upload requires a verified bundle directory.",
        );
      const store = await loadTrustStore();
      const prepared = await loadPreparedStagingRelease(directory, store);
      if (parsed.approve !== prepared.manifest.releaseId)
        throw new PlatformError(
          "APPROVAL_REQUIRED",
          `Upload requires --approve ${prepared.manifest.releaseId}.`,
        );
      logger.error({
        mutationPreview: summarizePreparedRelease(prepared),
        action: "CREATE_ONE_DRAFT_PRERELEASE_AND_UPLOAD_THREE_ASSETS",
      });
      const observed = await new GitHubReleasePublisher(
        new GhCliGitHubReleaseApi(),
      ).upload({
        prepared,
        registry: await loadProductRegistry(),
      });
      emit(
        observed,
        `Draft staging prerelease verified after upload.\n${observed.htmlUrl}`,
      );
      return 0;
    }
    if (operation === "resume-upload") {
      const directory = parsed.command[3];
      const releaseIdText = parsed.command[4];
      const releaseId = Number(releaseIdText);
      if (
        directory === undefined ||
        releaseIdText === undefined ||
        !Number.isSafeInteger(releaseId) ||
        releaseId <= 0
      )
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "release staging resume-upload requires a verified bundle directory and positive GitHub release ID.",
        );
      const store = await loadTrustStore();
      const prepared = await loadPreparedStagingRelease(directory, store);
      if (parsed.approve !== prepared.manifest.releaseId)
        throw new PlatformError(
          "APPROVAL_REQUIRED",
          `Recovery requires --approve ${prepared.manifest.releaseId}.`,
        );
      logger.error({
        mutationPreview: summarizePreparedRelease(prepared),
        githubReleaseId: releaseId,
        action: "RESUME_EXACT_EXISTING_DRAFT_WITH_MISSING_WHITELIST_ASSETS",
      });
      const observed = await new GitHubReleasePublisher(
        new GhCliGitHubReleaseApi(),
      ).resumeUpload({
        prepared,
        registry: await loadProductRegistry(),
        releaseId,
      });
      emit(
        observed,
        `Recovered draft staging prerelease verified after upload.\n${observed.htmlUrl}`,
      );
      return 0;
    }
  }

  if (commandGroup === "release" && commandAction === "manifest") {
    const operation = parsed.command[2];
    if (operation === "build") {
      const [artifactId, sourceCommit, output] = parsed.command.slice(3);
      if (
        artifactId === undefined ||
        sourceCommit === undefined ||
        output === undefined ||
        !/^[a-f0-9]{40}$/u.test(sourceCommit)
      )
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "manifest build requires artifact ID, source commit, and output path.",
        );
      const registry = await loadProductRegistry();
      const releases = await loadReleaseRecords(registry);
      const release = releases.find((item) =>
        item.artifacts.some((artifact) => artifact.artifactId === artifactId),
      );
      const artifact = release?.artifacts.find(
        (item) => item.artifactId === artifactId,
      );
      const product = registry.products.find(
        (item) => item.id === release?.productId,
      );
      if (
        release === undefined ||
        artifact === undefined ||
        product === undefined
      )
        throw new PlatformError(
          "ARTIFACT_METADATA_INVALID",
          "Artifact metadata was not found.",
        );
      const payload: ReleaseManifestPayload = {
        schemaVersion: 1,
        productId: release.productId,
        releaseId: `zui-staging-${release.version}-acceptance`,
        version: release.version,
        channel: artifact.deploymentClass === "staging" ? "staging" : "stable",
        repository: product.repository,
        sourceCommit,
        issuedAt: new Date().toISOString(),
        artifacts: [
          {
            artifactId: artifact.artifactId,
            filename: artifact.filename,
            appId: artifact.appId,
            version: artifact.version,
            deploymentClass: artifact.deploymentClass,
            size: artifact.size,
            sha256: artifact.hash.digest,
            contentType: "application/vnd.webos.ipk",
            source: {
              provider: "GITHUB_RELEASE",
              repository: product.repository,
              releaseTag: `zui-staging-${release.version}-acceptance`,
              assetName: artifact.filename,
            },
          },
        ],
      };
      await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      emit(payload, `Manifest written: ${output}`);
      return 0;
    }
    if (operation === "sign") {
      const [manifestPath, signaturePath, publicKeyPath] =
        parsed.command.slice(3);
      if (
        !parsed.ephemeralStaging ||
        manifestPath === undefined ||
        signaturePath === undefined ||
        publicKeyPath === undefined
      )
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "manifest sign requires paths and --ephemeral-staging.",
        );
      const payload: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
      if (!validateManifest(payload))
        throw new PlatformError(
          "MANIFEST_INVALID",
          "Manifest validation failed.",
        );
      const generated = createEphemeralStagingSigner();
      const signature = generated.signer.sign(payload);
      await writeFile(
        signaturePath,
        `${JSON.stringify(signature, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
      await writeFile(
        publicKeyPath,
        `${JSON.stringify(generated.trustEntry, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
      emit(
        { signature, trustEntry: generated.trustEntry },
        `Ephemeral staging signature written. Key ID: ${generated.trustEntry.keyId}`,
      );
      return 0;
    }
    if (operation === "verify") {
      const [manifestPath, signaturePath] = parsed.command.slice(3);
      if (manifestPath === undefined || signaturePath === undefined)
        throw new PlatformError(
          "INVALID_ARGUMENT",
          "manifest verify requires manifest and signature paths.",
        );
      const payload: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
      const signature = JSON.parse(
        await readFile(signaturePath, "utf8"),
      ) as ReleaseSignature;
      const result = verifyReleaseManifest(
        payload,
        signature,
        await loadTrustStore(),
      );
      emit(result, `${result.trustDecision}\nKey: ${result.keyId}`);
      return result.trustDecision === "SIGNED_TRUSTED" ? 0 : 60;
    }
  }

  if (commandGroup === "artifact" && commandAction === "fetch") {
    const [repository, tag, artifactId] = parsed.command.slice(2);
    if (
      repository === undefined ||
      tag === undefined ||
      artifactId === undefined
    )
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "artifact fetch requires repository, tag, and artifact ID.",
      );
    const registry = await loadProductRegistry();
    const allowed = registry.products.some(
      (product) => product.repository === `https://github.com/${repository}`,
    );
    if (!allowed)
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        "Repository is not in the product registry.",
      );
    const result = await new ArtifactDistributionService(
      new GitHubReleaseProvider(),
    ).fetch({
      repository,
      tag,
      artifactId,
      trustStore: await loadTrustStore(),
    });
    emit(
      result,
      `SIGNED_TRUSTED\nArtifact: ${result.artifactPath}\nSHA256: ${result.sha256}`,
    );
    return 0;
  }
  if (route === "artifact cache list") {
    const items = await new ArtifactDistributionService(
      new GitHubReleaseProvider(),
    ).list();
    emit({ digests: items }, items.join("\n"));
    return 0;
  }
  if (
    commandGroup === "artifact" &&
    commandAction === "cache" &&
    parsed.command[2] === "verify"
  ) {
    const digest = parsed.command[3];
    if (digest === undefined)
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "cache verify requires a digest.",
      );
    const result = await new ArtifactDistributionService(
      new GitHubReleaseProvider(),
    ).verifyCached(digest, await loadTrustStore());
    emit(result, `${result.trustDecision}\n${result.artifactPath}`);
    return 0;
  }

  if (
    commandGroup === "release" &&
    (commandAction === "list" || commandAction === "inspect")
  ) {
    const registry = await loadProductRegistry();
    const releases = await loadReleaseRecords(registry);
    if (commandAction === "list") {
      emit(
        releases,
        releases
          .map(
            (release) =>
              `${release.productId} ${release.version} (${release.artifacts.length} artifacts)`,
          )
          .join("\n"),
      );
      return 0;
    }
    const artifactId = parsed.command[2];
    if (artifactId === undefined)
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "release inspect requires an artifact ID.",
      );
    const artifact = releases
      .flatMap((release) => release.artifacts)
      .find((item) => item.artifactId === artifactId);
    if (artifact === undefined)
      throw new PlatformError(
        "ARTIFACT_METADATA_INVALID",
        `Artifact '${artifactId}' was not found.`,
      );
    emit(
      artifact,
      `${artifact.artifactId}\n${artifact.appId} ${artifact.version}\n${artifact.deploymentClass}\n${artifact.hash.digest}`,
    );
    return 0;
  }

  if (
    commandGroup === "package" &&
    (commandAction === "inspect" || commandAction === "verify")
  ) {
    if (positionalPath === undefined || parsed.command.length !== 3) {
      throw new PlatformError(
        "INVALID_ARGUMENT",
        `package ${commandAction} requires one IPK path.`,
      );
    }
    const inspection = await inspectIpk(positionalPath);
    const registry = await loadProductRegistry();
    const releases = await loadReleaseRecords(registry);
    const registryMatches = inspection.manifests.map((manifest) => ({
      appId: manifest.id,
      ...matchProduct(registry, manifest.id, manifest.vendor),
    }));
    const manifest =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    const artifactVerification =
      manifest === undefined
        ? null
        : verifyArtifactMetadata(releases, {
            filename: inspection.filename,
            sha256: inspection.hash.digest,
            size: inspection.size,
            appId: manifest.id,
            version: manifest.version,
          });
    const result =
      commandAction === "verify"
        ? {
            verified: true,
            authenticityVerified: false,
            inspection,
            registryMatches,
            artifactVerification,
          }
        : { inspection, registryMatches, artifactVerification };
    emit(
      result,
      `${commandAction === "verify" ? "Structure and hash verified\n" : ""}${packageSummary(inspection, registryMatches)}`,
    );
    return 0;
  }

  if (commandGroup === "install" && commandAction === "plan") {
    if (positionalPath === undefined || parsed.command.length !== 3) {
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "install plan requires one IPK path.",
      );
    }
    const registry = await loadProductRegistry();
    const releases = await loadReleaseRecords(registry);
    const [inspection, device, inventory] = await Promise.all([
      inspectIpk(positionalPath),
      service.inspectDevice(config.device),
      service.listInstalledApplications(config.device),
    ]);
    const manifest =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    if (manifest === undefined)
      throw new PlatformError(
        "PACKAGE_METADATA_INVALID",
        "A plan requires exactly one manifest.",
      );
    const artifactVerification = verifyArtifactMetadata(releases, {
      filename: inspection.filename,
      sha256: inspection.hash.digest,
      size: inspection.size,
      appId: manifest.id,
      version: manifest.version,
    });
    const signedDistributionTrusted =
      await verifySignedCacheArtifact(inspection);
    const plan = createInstallationPlan({
      package: inspection,
      registry,
      inventory,
      connectionStatus: device.health.connectionStatus,
      artifactVerification,
      signedDistributionTrusted,
      ...(parsed.planTtlMinutes === undefined
        ? {}
        : { ttlMs: parsed.planTtlMinutes * 60 * 1000 }),
    });
    if (parsed.save !== undefined)
      await writeFile(parsed.save, `${JSON.stringify(plan, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
    const riskText = plan.riskFlags
      .map((item) => `${item.severity} ${item.code}`)
      .join(", ");
    emit(
      plan,
      [
        "READ-ONLY installation plan (not executed)",
        `Artifact: ${plan.artifact.title} ${plan.artifact.version}`,
        `Trust: ${plan.artifact.trustLevel}`,
        `Device: ${plan.deviceAlias}`,
        `App: ${plan.artifact.appId}`,
        `SHA256: ${plan.artifact.sha256}`,
        `Registry: ${plan.comparison.registryMatch.classification}`,
        `Installed: ${plan.comparison.installedApplication === null ? "no" : `yes / ${plan.comparison.installedVersion ?? "unknown"}`}`,
        `Version relation: ${plan.comparison.versionRelation}`,
        `Risks: ${riskText}`,
        `Policy: ${plan.policyDecision}`,
        `Plan digest: ${plan.planDigest}`,
        `Executable: ${String(plan.executable)}`,
        ...(parsed.save === undefined ? [] : [`Saved: ${parsed.save}`]),
      ].join("\n"),
    );
    return 0;
  }

  if (commandGroup === "install" && commandAction === "execute") {
    if (positionalPath === undefined || parsed.approve === undefined)
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "install execute requires a plan path and --approve digest.",
      );
    const raw: unknown = JSON.parse(await readFile(positionalPath, "utf8"));
    if (!isInstallationPlanV2(raw))
      throw new PlatformError(
        "PLAN_TAMPERED",
        "Plan file does not match schema version 2.",
      );
    const registry = await loadProductRegistry();
    const releases = await loadReleaseRecords(registry);
    const result = await new InstallerService(adapter).execute(
      raw,
      parsed.approve,
      releases,
    );
    emit(
      result,
      `Install verified\n${result.installedAppId} ${result.installedVersion ?? "unknown"}\nReceipt: ${result.receiptPath}`,
    );
    return 0;
  }

  if (route === "install receipts") {
    const receipts = await new FileReceiptStore().list();
    emit({ receipts }, receipts.join("\n"));
    return 0;
  }

  switch (route) {
    case "devices list": {
      const devices = await service.listDevices();
      const result = {
        devices: devices.map(({ alias, isDefault, profile }) => ({
          alias,
          isDefault,
          ...(profile === undefined ? {} : { profile }),
        })),
      };
      emit(
        result,
        devices
          .map(
            (device) =>
              `${device.alias}${device.isDefault ? " (default)" : ""}`,
          )
          .join("\n"),
      );
      return 0;
    }
    case "devices inspect": {
      const device = await service.inspectDevice(config.device);
      emit(
        device,
        `${device.alias}: ${device.health.connectionStatus}\nCapabilities: ${device.capabilities.join(", ")}`,
      );
      return 0;
    }
    case "apps list": {
      const inventory = await service.listInstalledApplications(config.device);
      emit(
        inventory,
        inventory.applications
          .map(
            (app) =>
              `${app.id}${app.version === undefined ? "" : ` ${app.version}`}${app.title === undefined ? "" : ` - ${app.title}`}`,
          )
          .join("\n"),
      );
      return 0;
    }
    case "apps inspect": {
      const appId = validateAppId(parsed.app);
      const [app, registry] = await Promise.all([
        service.inspectInstalledApplication(config.device, appId),
        loadProductRegistry(),
      ]);
      const result = {
        device: config.device,
        installed: app !== null,
        appId,
        application: app,
        registryMatch: matchProduct(registry, appId, app?.vendor),
      };
      emit(
        result,
        app === null
          ? `${appId}: not installed`
          : `${app.id}${app.version === undefined ? "" : ` ${app.version}`}\n${app.title ?? "Untitled"}\n${result.registryMatch.classification}`,
      );
      return 0;
    }
    case "devmode status":
      logger.result(await service.status(config.device));
      return 0;
    case "devmode extend":
      logger.result(
        await service.extend(config.device, { dryRun: parsed.dryRun }),
      );
      return 0;
    case "devmode ensure":
      logger.result(
        await service.ensure(config.device, { dryRun: parsed.dryRun }),
      );
      return 0;
    case "doctor": {
      const [devices, registry] = await Promise.all([
        service.listDevices(),
        loadProductRegistry(),
      ]);
      const releases = await loadReleaseRecords(registry);
      const status =
        parsed.overrides.device === undefined
          ? null
          : await service.status(config.device);
      const result = {
        ok: true,
        node: process.version,
        registeredDeviceCount: devices.length,
        webOSCli: "available" as const,
        deviceRegistry: "readable" as const,
        packageInspection: "available" as const,
        productRegistryValid: validateRegistry(registry),
        releaseMetadataValid: true,
        releaseCount: releases.length,
        ...(status === null
          ? { deviceCheck: "not-requested" as const }
          : {
              configuredDevice: config.device,
              deviceCheck: "completed" as const,
              connectionStatus: status.connectionStatus,
            }),
        rootless: true,
      };
      emit(
        result,
        `Platform doctor: OK\nRegistered devices: ${devices.length}\nDevice check: ${result.deviceCheck}`,
      );
      return 0;
    }
    default:
      throw new PlatformError(
        "INVALID_ARGUMENT",
        `Unknown command '${route}'.`,
      );
  }
}

export async function main(
  args: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const json = args.includes("--json");
  const logger = createLogger(json);
  try {
    process.exitCode = await execute(args);
  } catch (error: unknown) {
    if (error instanceof PlatformError) {
      logger.error({ ok: false, error: error.toJSON() });
      process.exitCode = error.exitCode;
      return;
    }

    logger.error({
      ok: false,
      error: {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(await realpath(process.argv[1])) ===
    resolve(await realpath(fileURLToPath(import.meta.url)))
) {
  await main();
}
