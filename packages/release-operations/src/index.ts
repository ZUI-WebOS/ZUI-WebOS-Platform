import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import type {
  ProductRegistry,
  ProductRelease,
  ReleaseArtifact,
} from "@zui-webos/catalog-contracts";
import { inspectIpk } from "@zui-webos/package-inspector";
import { stagingInputRoot, stagingReleaseRoot } from "@zui-webos/runtime-paths";
import {
  keyIdFromPublicKey,
  NodeReleaseSigner,
  validateManifest,
  verifyReleaseManifest,
  type PublicTrustStore,
  type ReleaseManifestPayload,
  type ReleaseSignature,
  type TrustedSigningKey,
} from "@zui-webos/signed-release";
import { PlatformError } from "@zui-webos/webos-client";

const execFileAsync = promisify(execFile);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const SHA = /^[a-f0-9]{40}$/u;

export interface PermissionResult {
  readonly method: "WINDOWS_ACL" | "POSIX_MODE";
  readonly applied: true;
}

export interface PermissionHardener {
  harden(directory: string, privateKeyPath: string): Promise<PermissionResult>;
}

export class PlatformPermissionHardener implements PermissionHardener {
  async harden(
    directory: string,
    privateKeyPath: string,
  ): Promise<PermissionResult> {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("whoami", [], {
        windowsHide: true,
      });
      const identity = stdout.trim();
      if (identity.length === 0)
        throw new PlatformError(
          "SIGNING_KEY_STORAGE_FAILED",
          "Could not identify the current Windows user for key ACLs.",
        );
      await execFileAsync(
        "icacls",
        [directory, "/inheritance:r", "/grant:r", `${identity}:(OI)(CI)F`],
        { windowsHide: true },
      );
      await execFileAsync(
        "icacls",
        [privateKeyPath, "/inheritance:r", "/grant:r", `${identity}:F`],
        { windowsHide: true },
      );
      return { method: "WINDOWS_ACL", applied: true };
    }
    await chmod(directory, 0o700);
    await chmod(privateKeyPath, 0o600);
    return { method: "POSIX_MODE", applied: true };
  }
}

export interface GeneratedStagingKey {
  readonly privateKeyPath: string;
  readonly publicMetadataPath: string;
  readonly trustEntry: TrustedSigningKey;
  readonly permissions: PermissionResult;
}

function defaultKeyRoot(): string {
  return join(
    process.env.LOCALAPPDATA ?? join(homedir(), ".zui-webos"),
    ...(process.env.LOCALAPPDATA === undefined ? [] : ["ZUI-WebOS"]),
    "keys",
  );
}

export class StagingKeyStore {
  constructor(
    private readonly root = defaultKeyRoot(),
    private readonly permissions: PermissionHardener = new PlatformPermissionHardener(),
  ) {}

  privatePath(): string {
    return join(this.root, "staging-release-ed25519.pem");
  }

  publicMetadataPath(): string {
    return join(this.root, "staging-release-ed25519.public.json");
  }

  async generate(
    passphrase: Buffer,
    now = new Date(),
  ): Promise<GeneratedStagingKey> {
    if (passphrase.length < 16)
      throw new PlatformError(
        "SIGNING_KEY_PASSPHRASE_INVALID",
        "Staging signing passphrase must contain at least 16 bytes.",
      );
    await mkdir(this.root, { recursive: true });
    const privateKeyPath = this.privatePath();
    const publicMetadataPath = this.publicMetadataPath();
    for (const path of [privateKeyPath, publicMetadataPath]) {
      try {
        await access(path);
        throw new PlatformError(
          "SIGNING_KEY_EXISTS",
          "A staging signing key already exists; generation never overwrites it.",
        );
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const pair = generateKeyPairSync("ed25519");
    const publicDer = pair.publicKey.export({
      format: "der",
      type: "spki",
    }) as Buffer;
    const trustEntry: TrustedSigningKey = {
      keyId: keyIdFromPublicKey(publicDer),
      algorithm: "Ed25519",
      publicKeySpkiDerBase64: publicDer.toString("base64"),
      status: "ACTIVE",
      scopes: ["STAGING_RELEASE"],
      notBefore: now.toISOString(),
      description: "Operational encrypted staging release signing key.",
    };
    const encrypted = pair.privateKey.export({
      format: "pem",
      type: "pkcs8",
      cipher: "aes-256-cbc",
      passphrase,
    });
    await writeFile(privateKeyPath, encrypted, { flag: "wx", mode: 0o600 });
    await writeFile(
      publicMetadataPath,
      `${JSON.stringify(trustEntry, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    const permissions = await this.permissions.harden(
      this.root,
      privateKeyPath,
    );
    return {
      privateKeyPath,
      publicMetadataPath,
      trustEntry,
      permissions,
    };
  }

  async unlock(passphrase: Buffer): Promise<NodeReleaseSigner> {
    try {
      const pem = await readFile(this.privatePath());
      const privateKey = createPrivateKey({
        key: pem,
        format: "pem",
        passphrase,
      });
      if (privateKey.asymmetricKeyType !== "ed25519")
        throw new Error("wrong key type");
      const publicDer = createPublicKey(privateKey).export({
        format: "der",
        type: "spki",
      }) as Buffer;
      return new NodeReleaseSigner(privateKey, keyIdFromPublicKey(publicDer));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new PlatformError(
          "SIGNING_KEY_NOT_FOUND",
          "The operational staging signing key does not exist.",
        );
      throw new PlatformError(
        "SIGNING_KEY_UNLOCK_FAILED",
        "The staging signing key could not be unlocked. Check the passphrase and key integrity.",
      );
    }
  }
}

export interface SourceRepositoryVerifier {
  verify(input: {
    readonly path: string;
    readonly expectedRepository: string;
    readonly sourceCommit: string;
    readonly expectedRef?: string;
  }): Promise<void>;
}

function normalizedGitUrl(value: string): string {
  return value
    .trim()
    .replace(/\.git$/u, "")
    .replace(/^git@github\.com:/u, "https://github.com/");
}

export class GitSourceRepositoryVerifier implements SourceRepositoryVerifier {
  async verify(input: {
    readonly path: string;
    readonly expectedRepository: string;
    readonly sourceCommit: string;
    readonly expectedRef?: string;
  }): Promise<void> {
    if (!SHA.test(input.sourceCommit))
      throw new PlatformError(
        "SOURCE_COMMIT_INVALID",
        "Source commit must be an explicit lowercase 40-character SHA.",
      );
    const options = { cwd: input.path, windowsHide: true } as const;
    const [{ stdout: status }, { stdout: head }, { stdout: remote }] =
      await Promise.all([
        execFileAsync("git", ["status", "--porcelain"], options),
        execFileAsync("git", ["rev-parse", "HEAD"], options),
        execFileAsync("git", ["remote", "get-url", "origin"], options),
      ]);
    if (status.trim().length !== 0)
      throw new PlatformError(
        "SOURCE_REPOSITORY_DIRTY",
        "Source repository has uncommitted or untracked changes.",
      );
    if (head.trim() !== input.sourceCommit)
      throw new PlatformError(
        "SOURCE_COMMIT_INVALID",
        "Explicit source commit does not equal the clean source checkout HEAD.",
      );
    if (normalizedGitUrl(remote) !== normalizedGitUrl(input.expectedRepository))
      throw new PlatformError(
        "SOURCE_REPOSITORY_MISMATCH",
        "Source origin does not match the registered product repository.",
      );
    try {
      await execFileAsync(
        "git",
        [
          "merge-base",
          "--is-ancestor",
          input.sourceCommit,
          input.expectedRef ?? "origin/main",
        ],
        options,
      );
    } catch {
      throw new PlatformError(
        "SOURCE_COMMIT_INVALID",
        "Source commit is not reachable from the expected repository ref.",
      );
    }
  }
}

export interface StagingReleaseVerificationReport {
  readonly productId: string;
  readonly releaseId: string;
  readonly repository: string;
  readonly sourceCommit: string;
  readonly appId: string;
  readonly version: string;
  readonly deploymentClass: "staging";
  readonly channel: "staging";
  readonly filename: string;
  readonly size: number;
  readonly sha256: string;
  readonly signingKeyId: string;
  readonly signatureValid: true;
  readonly trustDecision: "SIGNED_TRUSTED";
  readonly verifiedAt: string;
}

export interface PreparedStagingRelease {
  readonly directory: string;
  readonly manifestPath: string;
  readonly signaturePath: string;
  readonly artifactPath: string;
  readonly reportPath: string;
  readonly catalogRecordPath: string;
  readonly manifest: ReleaseManifestPayload;
  readonly signature: ReleaseSignature;
  readonly report: StagingReleaseVerificationReport;
}

export interface StagedReleaseInput {
  readonly artifactId: string;
  readonly artifactPath: string;
  readonly sha256: string;
  readonly size: number;
  readonly appId: string;
  readonly version: string;
}

function defaultBundleRoot(): string {
  return stagingReleaseRoot();
}

function findStagingArtifact(
  releases: readonly ProductRelease[],
  artifactId: string,
): { release: ProductRelease; artifact: ReleaseArtifact } {
  for (const release of releases) {
    const artifact = release.artifacts.find(
      (candidate) => candidate.artifactId === artifactId,
    );
    if (artifact !== undefined) return { release, artifact };
  }
  throw new PlatformError(
    "ARTIFACT_METADATA_INVALID",
    "Staging artifact metadata was not found.",
  );
}

/**
 * Imports a repository-pinned staging package into a process-neutral input
 * location. This is intentionally separate from the signed distribution cache:
 * preparing a new release does not claim that an old release is currently
 * trusted.
 */
export class PinnedArtifactStager {
  constructor(private readonly root = stagingInputRoot()) {}

  async stage(input: {
    readonly releases: readonly ProductRelease[];
    readonly artifactId: string;
    readonly sourcePath: string;
  }): Promise<StagedReleaseInput> {
    const { release, artifact } = findStagingArtifact(
      input.releases,
      input.artifactId,
    );
    if (artifact.deploymentClass !== "staging" || release.channel !== "staging")
      throw new PlatformError(
        "RELEASE_POLICY_BLOCKED",
        "Only repository-pinned staging artifacts may be staged as release inputs.",
      );
    const inspection = await inspectIpk(input.sourcePath);
    const app =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    const digest = artifact.hash.digest.toUpperCase();
    if (
      inspection.hash.digest !== digest ||
      inspection.size !== artifact.size ||
      app?.id !== artifact.appId ||
      app.version !== artifact.version
    )
      throw new PlatformError(
        "ARTIFACT_IDENTITY_MISMATCH",
        "Release input does not exactly match repository-pinned staging metadata.",
      );
    const directory = join(this.root, digest);
    const target = join(directory, artifact.filename);
    await mkdir(directory, { recursive: true });
    try {
      await copyFile(input.sourcePath, target, constants.COPYFILE_EXCL);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    let copied;
    try {
      copied = await inspectIpk(target);
    } catch {
      throw new PlatformError(
        "ARTIFACT_IDENTITY_MISMATCH",
        "Existing staged release input is inconsistent and was not overwritten.",
      );
    }
    const copiedApp =
      copied.manifests.length === 1 ? copied.manifests[0] : undefined;
    if (
      copied.hash.digest !== digest ||
      copied.size !== artifact.size ||
      copiedApp?.id !== artifact.appId ||
      copiedApp.version !== artifact.version
    )
      throw new PlatformError(
        "ARTIFACT_IDENTITY_MISMATCH",
        "Existing staged release input is inconsistent and was not overwritten.",
      );
    return {
      artifactId: artifact.artifactId,
      artifactPath: target,
      sha256: digest,
      size: artifact.size,
      appId: artifact.appId,
      version: artifact.version,
    };
  }
}

export class StagingReleasePipeline {
  constructor(
    private readonly sourceVerifier: SourceRepositoryVerifier = new GitSourceRepositoryVerifier(),
    private readonly bundleRoot = defaultBundleRoot(),
  ) {}

  async prepare(input: {
    readonly registry: ProductRegistry;
    readonly releases: readonly ProductRelease[];
    readonly trustStore: PublicTrustStore;
    readonly artifactId: string;
    readonly artifactPath: string;
    readonly sourceRepositoryPath: string;
    readonly sourceCommit: string;
    readonly releaseId: string;
    readonly signer: NodeReleaseSigner;
    readonly now?: Date;
  }): Promise<PreparedStagingRelease> {
    if (
      !ID.test(input.releaseId) ||
      !input.releaseId.startsWith("zui-staging-")
    )
      throw new PlatformError(
        "RELEASE_ID_INVALID",
        "Staging release ID must use the zui-staging- prefix and safe characters.",
      );
    const { release, artifact } = findStagingArtifact(
      input.releases,
      input.artifactId,
    );
    if (artifact.deploymentClass !== "staging" || release.channel !== "staging")
      throw new PlatformError(
        "RELEASE_POLICY_BLOCKED",
        "Operational release preparation permits staging artifacts only.",
      );
    const product = input.registry.products.find(
      (candidate) => candidate.id === release.productId,
    );
    if (
      product === undefined ||
      product.repository !== release.sourceRepository
    )
      throw new PlatformError(
        "SOURCE_REPOSITORY_MISMATCH",
        "Release and registered product repository do not agree.",
      );
    await this.sourceVerifier.verify({
      path: input.sourceRepositoryPath,
      expectedRepository: product.repository,
      sourceCommit: input.sourceCommit,
    });
    const inspection = await inspectIpk(input.artifactPath);
    const app =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    if (
      app?.id !== artifact.appId ||
      app.version !== artifact.version ||
      inspection.hash.digest !== artifact.hash.digest.toUpperCase() ||
      inspection.size !== artifact.size
    )
      throw new PlatformError(
        "ARTIFACT_IDENTITY_MISMATCH",
        "Selected IPK does not exactly match pinned staging metadata.",
      );
    const now = input.now ?? new Date();
    const manifest: ReleaseManifestPayload = {
      schemaVersion: 1,
      productId: product.id,
      releaseId: input.releaseId,
      version: artifact.version,
      channel: "staging",
      repository: product.repository,
      sourceCommit: input.sourceCommit,
      issuedAt: now.toISOString(),
      artifacts: [
        {
          artifactId: artifact.artifactId,
          filename: artifact.filename,
          appId: artifact.appId,
          version: artifact.version,
          deploymentClass: "staging",
          size: artifact.size,
          sha256: artifact.hash.digest.toUpperCase(),
          contentType: "application/vnd.webos.ipk",
          source: {
            provider: "GITHUB_RELEASE",
            repository: product.repository,
            releaseTag: input.releaseId,
            assetName: artifact.filename,
          },
        },
      ],
    };
    const signature = input.signer.sign(manifest);
    const verification = verifyReleaseManifest(
      manifest,
      signature,
      input.trustStore,
      now,
    );
    if (
      signature.keyId !== input.signer.keyId ||
      verification.trustDecision !== "SIGNED_TRUSTED"
    )
      throw new PlatformError(
        "RELEASE_POLICY_BLOCKED",
        `Operational signer is not an active trusted staging key: ${verification.trustDecision}.`,
      );
    const directory = join(this.bundleRoot, input.releaseId);
    await mkdir(this.bundleRoot, { recursive: true });
    try {
      await mkdir(directory, { recursive: false });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new PlatformError(
          "RELEASE_ID_EXISTS",
          "Local staging release bundle already exists; it was not overwritten.",
        );
      throw error;
    }
    const artifactPath = join(directory, artifact.filename);
    const manifestPath = join(directory, "release-manifest.json");
    const signaturePath = join(directory, "release-manifest.sig");
    const reportPath = join(directory, "verification-report.json");
    const catalogRecordPath = join(directory, "catalog-release-record.json");
    await copyFile(input.artifactPath, artifactPath, constants.COPYFILE_EXCL);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
    });
    await writeFile(signaturePath, `${JSON.stringify(signature, null, 2)}\n`, {
      flag: "wx",
    });
    const report: StagingReleaseVerificationReport = {
      productId: product.id,
      releaseId: input.releaseId,
      repository: product.repository,
      sourceCommit: input.sourceCommit,
      appId: artifact.appId,
      version: artifact.version,
      deploymentClass: "staging",
      channel: "staging",
      filename: artifact.filename,
      size: artifact.size,
      sha256: artifact.hash.digest.toUpperCase(),
      signingKeyId: signature.keyId,
      signatureValid: true,
      trustDecision: "SIGNED_TRUSTED",
      verifiedAt: now.toISOString(),
    };
    const catalogRecord: ProductRelease = {
      schemaVersion: 1,
      productId: product.id,
      version: artifact.version,
      channel: "staging",
      sourceRepository: product.repository,
      releaseRef: input.releaseId,
      sourceCommit: input.sourceCommit,
      artifacts: [
        {
          ...artifact,
          source: {
            type: "GITHUB_RELEASE",
            repository: product.repository,
            releaseRef: input.releaseId,
            assetName: artifact.filename,
            canonicalAssetUrl: `${product.repository}/releases/tag/${input.releaseId}`,
          },
        },
      ],
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      flag: "wx",
    });
    await writeFile(
      catalogRecordPath,
      `${JSON.stringify(catalogRecord, null, 2)}\n`,
      { flag: "wx" },
    );
    return {
      directory,
      manifestPath,
      signaturePath,
      artifactPath,
      reportPath,
      catalogRecordPath,
      manifest,
      signature,
      report,
    };
  }

  async verifyBundle(
    directory: string,
    trustStore: PublicTrustStore,
    now = new Date(),
  ): Promise<StagingReleaseVerificationReport> {
    const manifestValue: unknown = JSON.parse(
      await readFile(join(directory, "release-manifest.json"), "utf8"),
    );
    const signature = JSON.parse(
      await readFile(join(directory, "release-manifest.sig"), "utf8"),
    ) as ReleaseSignature;
    const verification = verifyReleaseManifest(
      manifestValue,
      signature,
      trustStore,
      now,
    );
    if (
      !validateManifest(manifestValue) ||
      manifestValue.channel !== "staging" ||
      manifestValue.artifacts.some(
        (artifact) => artifact.deploymentClass !== "staging",
      ) ||
      verification.trustDecision !== "SIGNED_TRUSTED"
    )
      throw new PlatformError(
        "RELEASE_VERIFICATION_FAILED",
        `Local bundle trust decision: ${verification.trustDecision}.`,
      );
    const artifact = manifestValue.artifacts[0];
    if (artifact === undefined || manifestValue.artifacts.length !== 1)
      throw new PlatformError(
        "RELEASE_VERIFICATION_FAILED",
        "Operational staging bundle must contain exactly one artifact.",
      );
    const inspection = await inspectIpk(join(directory, artifact.filename));
    const app =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    if (
      inspection.hash.digest !== artifact.sha256.toUpperCase() ||
      inspection.size !== artifact.size ||
      app?.id !== artifact.appId ||
      app.version !== artifact.version
    )
      throw new PlatformError(
        "RELEASE_VERIFICATION_FAILED",
        "Local bundle artifact bytes or identity do not match the signed manifest.",
      );
    return {
      productId: manifestValue.productId,
      releaseId: manifestValue.releaseId,
      repository: manifestValue.repository,
      sourceCommit: manifestValue.sourceCommit,
      appId: artifact.appId,
      version: artifact.version,
      deploymentClass: "staging",
      channel: "staging",
      filename: artifact.filename,
      size: artifact.size,
      sha256: artifact.sha256.toUpperCase(),
      signingKeyId: signature.keyId,
      signatureValid: true,
      trustDecision: "SIGNED_TRUSTED",
      verifiedAt: now.toISOString(),
    };
  }
}

export async function loadPreparedStagingRelease(
  directory: string,
  trustStore: PublicTrustStore,
  now = new Date(),
): Promise<PreparedStagingRelease> {
  const pipeline = new StagingReleasePipeline();
  const report = await pipeline.verifyBundle(directory, trustStore, now);
  const manifestPath = join(directory, "release-manifest.json");
  const signaturePath = join(directory, "release-manifest.sig");
  const manifestValue: unknown = JSON.parse(
    await readFile(manifestPath, "utf8"),
  );
  if (!validateManifest(manifestValue))
    throw new PlatformError(
      "RELEASE_VERIFICATION_FAILED",
      "Prepared manifest is invalid.",
    );
  const signature = JSON.parse(
    await readFile(signaturePath, "utf8"),
  ) as ReleaseSignature;
  return {
    directory,
    manifestPath,
    signaturePath,
    artifactPath: join(directory, report.filename),
    reportPath: join(directory, "verification-report.json"),
    catalogRecordPath: join(directory, "catalog-release-record.json"),
    manifest: manifestValue,
    signature,
    report,
  };
}

export interface PublishedReleaseAsset {
  readonly name: string;
  readonly size: number;
}
export interface PublishedDraftRelease {
  readonly id: number;
  readonly repository: string;
  readonly tag: string;
  readonly targetCommitish: string;
  readonly draft: boolean;
  readonly prerelease: boolean;
  readonly htmlUrl: string;
  readonly assets: readonly PublishedReleaseAsset[];
}
export interface GitHubReleaseApi {
  findByTag(
    repository: string,
    tag: string,
  ): Promise<PublishedDraftRelease | null>;
  createDraft(input: {
    readonly repository: string;
    readonly tag: string;
    readonly title: string;
    readonly targetCommitish: string;
  }): Promise<PublishedDraftRelease>;
  uploadAsset(input: {
    readonly repository: string;
    readonly releaseId: number;
    readonly tag: string;
    readonly name: string;
    readonly path: string;
    readonly contentType: string;
  }): Promise<void>;
  getById(
    repository: string,
    releaseId: number,
  ): Promise<PublishedDraftRelease>;
}

interface GhReleaseJson {
  readonly id?: unknown;
  readonly tag_name?: unknown;
  readonly target_commitish?: unknown;
  readonly draft?: unknown;
  readonly prerelease?: unknown;
  readonly html_url?: unknown;
  readonly assets?: readonly {
    readonly name?: unknown;
    readonly size?: unknown;
  }[];
}

function parseGhRelease(
  repository: string,
  value: GhReleaseJson,
): PublishedDraftRelease {
  const rawAssets: unknown = value.assets;
  if (
    typeof value.id !== "number" ||
    typeof value.tag_name !== "string" ||
    typeof value.target_commitish !== "string" ||
    typeof value.html_url !== "string" ||
    !Array.isArray(rawAssets)
  )
    throw new PlatformError(
      "RELEASE_UPLOAD_FAILED",
      "GitHub returned malformed release metadata.",
    );
  const assets = rawAssets.map((asset: unknown) => {
    if (
      typeof asset !== "object" ||
      asset === null ||
      !("name" in asset) ||
      !("size" in asset) ||
      typeof asset.name !== "string" ||
      typeof asset.size !== "number"
    )
      throw new PlatformError(
        "RELEASE_UPLOAD_FAILED",
        "GitHub returned malformed asset metadata.",
      );
    return { name: asset.name, size: asset.size };
  });
  return {
    id: value.id,
    repository: `https://github.com/${repository}`,
    tag: value.tag_name,
    targetCommitish: value.target_commitish,
    draft: value.draft === true,
    prerelease: value.prerelease === true,
    htmlUrl: value.html_url,
    assets,
  };
}

export class GhCliGitHubReleaseApi implements GitHubReleaseApi {
  constructor(
    private readonly execute: (
      executable: string,
      args: readonly string[],
      options: { readonly windowsHide: true; readonly maxBuffer: number },
    ) => Promise<{ stdout: string; stderr: string }> = async (
      executable,
      args,
      options,
    ) => execFileAsync(executable, [...args], options),
  ) {}

  async findByTag(
    repository: string,
    tag: string,
  ): Promise<PublishedDraftRelease | null> {
    const { stdout } = await this.execute(
      "gh",
      ["api", `repos/${repository}/releases?per_page=100`],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    const values = JSON.parse(stdout) as GhReleaseJson[];
    const matches = values.filter((value) => value.tag_name === tag);
    if (matches.length > 1)
      throw new PlatformError(
        "RELEASE_ID_EXISTS",
        "More than one GitHub release uses the requested identity.",
      );
    return matches[0] === undefined
      ? null
      : parseGhRelease(repository, matches[0]);
  }

  async createDraft(input: {
    readonly repository: string;
    readonly tag: string;
    readonly title: string;
    readonly targetCommitish: string;
  }): Promise<PublishedDraftRelease> {
    const { stdout } = await this.execute(
      "gh",
      [
        "api",
        "--method",
        "POST",
        `repos/${input.repository}/releases`,
        "-f",
        `tag_name=${input.tag}`,
        "-f",
        `target_commitish=${input.targetCommitish}`,
        "-f",
        `name=${input.title}`,
        "-F",
        "draft=true",
        "-F",
        "prerelease=true",
      ],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    return parseGhRelease(
      input.repository,
      JSON.parse(stdout) as GhReleaseJson,
    );
  }

  async uploadAsset(input: {
    readonly repository: string;
    readonly releaseId: number;
    readonly tag: string;
    readonly name: string;
    readonly path: string;
    readonly contentType: string;
  }): Promise<void> {
    try {
      await this.execute(
        "gh",
        [
          "release",
          "upload",
          input.tag,
          input.path,
          "--repo",
          input.repository,
        ],
        { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      );
    } catch (error: unknown) {
      throw new PlatformError(
        "RELEASE_UPLOAD_FAILED",
        `GitHub rejected asset '${input.name}'. No existing asset was overwritten.`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async getById(
    repository: string,
    releaseId: number,
  ): Promise<PublishedDraftRelease> {
    const { stdout } = await this.execute(
      "gh",
      ["api", `repos/${repository}/releases/${String(releaseId)}`],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    return parseGhRelease(repository, JSON.parse(stdout) as GhReleaseJson);
  }
}

function repositoryIdentity(repository: string): string {
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/u.exec(
      repository,
    );
  if (match?.[1] === undefined)
    throw new PlatformError(
      "SOURCE_REPOSITORY_MISMATCH",
      "Registered repository is not a supported GitHub identity.",
    );
  return match[1];
}

export class GitHubReleasePublisher {
  constructor(private readonly api: GitHubReleaseApi) {}

  async upload(input: {
    readonly prepared: PreparedStagingRelease;
    readonly registry: ProductRegistry;
  }): Promise<PublishedDraftRelease> {
    const manifest = input.prepared.manifest;
    const product = input.registry.products.find(
      (candidate) => candidate.id === manifest.productId,
    );
    if (
      product === undefined ||
      product.repository !== manifest.repository ||
      manifest.channel !== "staging" ||
      manifest.artifacts.some(
        (artifact) => artifact.deploymentClass !== "staging",
      )
    )
      throw new PlatformError(
        "RELEASE_POLICY_BLOCKED",
        "Publisher target is not a registered staging release.",
      );
    const repository = repositoryIdentity(product.repository);
    if ((await this.api.findByTag(repository, manifest.releaseId)) !== null)
      throw new PlatformError(
        "RELEASE_ID_EXISTS",
        "GitHub release identity already exists; no existing release was modified.",
      );
    const created = await this.api.createDraft({
      repository,
      tag: manifest.releaseId,
      title: `STAGING — ${product.displayName} ${manifest.version}`,
      targetCommitish: manifest.sourceCommit,
    });
    if (!created.draft || !created.prerelease)
      throw new PlatformError(
        "RELEASE_UPLOAD_FAILED",
        "GitHub did not create a draft prerelease; upload stopped.",
      );
    const artifact = manifest.artifacts[0];
    if (artifact === undefined || manifest.artifacts.length !== 1)
      throw new PlatformError(
        "RELEASE_POLICY_BLOCKED",
        "Publisher requires exactly one staging artifact.",
      );
    const assets = [
      {
        name: artifact.filename,
        path: input.prepared.artifactPath,
        contentType: "application/vnd.webos.ipk",
      },
      {
        name: "release-manifest.json",
        path: input.prepared.manifestPath,
        contentType: "application/json",
      },
      {
        name: "release-manifest.sig",
        path: input.prepared.signaturePath,
        contentType: "application/json",
      },
    ] as const;
    for (const asset of assets)
      await this.api.uploadAsset({
        repository,
        releaseId: created.id,
        tag: manifest.releaseId,
        ...asset,
      });
    const observed = await this.api.getById(repository, created.id);
    const expectedSizes = new Map<string, number>([
      [artifact.filename, artifact.size],
      [
        "release-manifest.json",
        (await readFile(input.prepared.manifestPath)).length,
      ],
      [
        "release-manifest.sig",
        (await readFile(input.prepared.signaturePath)).length,
      ],
    ]);
    const validAssets =
      observed.assets.length === expectedSizes.size &&
      observed.assets.every(
        (asset) => expectedSizes.get(asset.name) === asset.size,
      );
    if (
      observed.repository !== product.repository ||
      observed.tag !== manifest.releaseId ||
      observed.targetCommitish !== manifest.sourceCommit ||
      !observed.draft ||
      !observed.prerelease ||
      !validAssets
    )
      throw new PlatformError(
        "RELEASE_READBACK_FAILED",
        "GitHub draft read-back does not match the signed release bundle.",
      );
    return observed;
  }

  async resumeUpload(input: {
    readonly prepared: PreparedStagingRelease;
    readonly registry: ProductRegistry;
    readonly releaseId: number;
  }): Promise<PublishedDraftRelease> {
    const manifest = input.prepared.manifest;
    const product = input.registry.products.find(
      (candidate) => candidate.id === manifest.productId,
    );
    if (
      product === undefined ||
      product.repository !== manifest.repository ||
      manifest.channel !== "staging" ||
      manifest.artifacts.some(
        (artifact) => artifact.deploymentClass !== "staging",
      )
    )
      throw new PlatformError(
        "RELEASE_POLICY_BLOCKED",
        "Publisher recovery target is not a registered staging release.",
      );
    const repository = repositoryIdentity(product.repository);
    const existing = await this.api.findByTag(repository, manifest.releaseId);
    if (
      existing === null ||
      existing.id !== input.releaseId ||
      existing.repository !== product.repository ||
      existing.tag !== manifest.releaseId ||
      existing.targetCommitish !== manifest.sourceCommit ||
      !existing.draft ||
      !existing.prerelease
    )
      throw new PlatformError(
        "RELEASE_READBACK_FAILED",
        "Existing GitHub draft does not exactly match the approved recovery target.",
      );
    const artifact = manifest.artifacts[0];
    if (artifact === undefined || manifest.artifacts.length !== 1)
      throw new PlatformError(
        "RELEASE_POLICY_BLOCKED",
        "Publisher recovery requires exactly one staging artifact.",
      );
    const assets = [
      {
        name: artifact.filename,
        path: input.prepared.artifactPath,
        contentType: "application/vnd.webos.ipk",
        size: artifact.size,
      },
      {
        name: "release-manifest.json",
        path: input.prepared.manifestPath,
        contentType: "application/json",
        size: (await readFile(input.prepared.manifestPath)).length,
      },
      {
        name: "release-manifest.sig",
        path: input.prepared.signaturePath,
        contentType: "application/json",
        size: (await readFile(input.prepared.signaturePath)).length,
      },
    ] as const;
    const expectedSizes = new Map(
      assets.map((asset) => [asset.name, asset.size] as const),
    );
    if (
      existing.assets.some(
        (asset) => expectedSizes.get(asset.name) !== asset.size,
      )
    )
      throw new PlatformError(
        "RELEASE_READBACK_FAILED",
        "Existing draft contains an unexpected or inconsistent asset; recovery stopped.",
      );
    const existingNames = new Set(existing.assets.map((asset) => asset.name));
    for (const asset of assets)
      if (!existingNames.has(asset.name))
        await this.api.uploadAsset({
          repository,
          releaseId: existing.id,
          tag: manifest.releaseId,
          name: asset.name,
          path: asset.path,
          contentType: asset.contentType,
        });
    const observed = await this.api.getById(repository, existing.id);
    const validAssets =
      observed.assets.length === expectedSizes.size &&
      observed.assets.every(
        (asset) => expectedSizes.get(asset.name) === asset.size,
      );
    if (
      observed.repository !== product.repository ||
      observed.tag !== manifest.releaseId ||
      observed.targetCommitish !== manifest.sourceCommit ||
      !observed.draft ||
      !observed.prerelease ||
      !validAssets
    )
      throw new PlatformError(
        "RELEASE_READBACK_FAILED",
        "Recovered GitHub draft read-back does not match the signed release bundle.",
      );
    return observed;
  }
}

export function summarizePreparedRelease(
  value: PreparedStagingRelease,
): string {
  return [
    `Repository: ${value.manifest.repository}`,
    `Release: ${value.manifest.releaseId}`,
    "State: DRAFT / PRERELEASE / STAGING",
    `Target commit: ${value.manifest.sourceCommit}`,
    `Assets: ${value.manifest.artifacts[0]?.filename ?? "invalid"}, release-manifest.json, release-manifest.sig`,
    `Signing key: ${value.signature.keyId}`,
  ].join("\n");
}

export function safeBasename(path: string): string {
  return basename(path);
}
