import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";

import { inspectIpk } from "@zui-webos/package-inspector";
import { artifactCacheRoot } from "@zui-webos/runtime-paths";
import {
  validateManifest,
  verifyReleaseManifest,
  type PublicTrustStore,
  type ReleaseManifestPayload,
  type ReleaseSignature,
} from "@zui-webos/signed-release";
import { PlatformError } from "@zui-webos/webos-client";

export interface RemoteAsset {
  readonly name: string;
  readonly size: number;
  readonly apiUrl: string;
}
export interface RemoteRelease {
  readonly repository: string;
  readonly tag: string;
  readonly draft: boolean;
  readonly prerelease: boolean;
  readonly assets: readonly RemoteAsset[];
}
export interface ReleaseProvider {
  getRelease(repository: string, tag: string): Promise<RemoteRelease>;
  openAsset(asset: RemoteAsset): Promise<Readable>;
}

const execFileAsync = promisify(execFile);
export class GitHubReleaseProvider implements ReleaseProvider {
  async getRelease(repository: string, tag: string): Promise<RemoteRelease> {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository))
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        "Invalid GitHub repository identity.",
      );
    const { stdout } = await execFileAsync(
      "gh",
      ["api", `repos/${repository}/releases?per_page=100`],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    const releases = JSON.parse(stdout) as Array<{
      tag_name?: unknown;
      draft?: unknown;
      prerelease?: unknown;
      assets?: Array<{ name?: unknown; size?: unknown; url?: unknown }>;
    }>;
    if (!Array.isArray(releases))
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        "GitHub releases response is invalid.",
      );
    const matches = releases.filter((release) => release.tag_name === tag);
    if (matches.length !== 1)
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        `Expected exactly one GitHub release for tag '${tag}'.`,
      );
    const raw = matches[0] as (typeof releases)[number];
    if (!Array.isArray(raw.assets))
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        "GitHub release response has no assets.",
      );
    return {
      repository: `https://github.com/${repository}`,
      tag,
      draft: raw.draft === true,
      prerelease: raw.prerelease === true,
      assets: raw.assets.map((asset) => {
        if (
          typeof asset.name !== "string" ||
          typeof asset.size !== "number" ||
          typeof asset.url !== "string" ||
          !asset.url.startsWith("https://api.github.com/")
        )
          throw new PlatformError(
            "DISTRIBUTION_FAILED",
            "Unexpected GitHub asset metadata.",
          );
        return { name: asset.name, size: asset.size, apiUrl: asset.url };
      }),
    };
  }
  openAsset(asset: RemoteAsset): Promise<Readable> {
    const child = spawn(
      "gh",
      ["api", "-H", "Accept: application/octet-stream", asset.apiUrl],
      { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    const output = new PassThrough();
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < 4096) stderr += chunk;
    });
    child.stdout.pipe(output, { end: false });
    child.once("error", (error) => output.destroy(error));
    child.once("close", (code) => {
      if (code === 0) output.end();
      else
        output.destroy(
          new PlatformError(
            "DISTRIBUTION_FAILED",
            `GitHub asset download failed with exit code ${String(code)}.`,
            stderr.trim().slice(0, 4096),
          ),
        );
    });
    return Promise.resolve(output);
  }
}

export interface VerifiedCacheMetadata {
  readonly schemaVersion: 1;
  readonly sourceRepository: string;
  readonly release: string;
  readonly asset: string;
  readonly manifestDigest: string;
  readonly signatureKeyId: string;
  readonly artifactSha256: string;
  readonly verifiedAt: string;
  readonly trustDecision: "SIGNED_TRUSTED";
  readonly manifest: ReleaseManifestPayload;
  readonly signature: ReleaseSignature;
}
export interface DistributionResult {
  readonly artifactPath: string;
  readonly metadataPath: string;
  readonly manifest: ReleaseManifestPayload;
  readonly artifactId: string;
  readonly sha256: string;
  readonly trustLevel: "SIGNED";
  readonly trustDecision: "SIGNED_TRUSTED";
  readonly keyId: string;
}

async function readBounded(stream: Readable, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const data = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    total += data.length;
    if (total > limit)
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        "Remote metadata exceeds its size limit.",
      );
    chunks.push(data);
  }
  return Buffer.concat(chunks);
}
function oneAsset(release: RemoteRelease, name: string): RemoteAsset {
  const matches = release.assets.filter((asset) => asset.name === name);
  if (matches.length !== 1)
    throw new PlatformError(
      "DISTRIBUTION_FAILED",
      `Expected exactly one '${name}' asset.`,
    );
  return matches[0] as RemoteAsset;
}

export class ArtifactDistributionService {
  constructor(
    private readonly provider: ReleaseProvider,
    private readonly cacheRoot = artifactCacheRoot(),
    private readonly maxArtifactBytes = 512 * 1024 * 1024,
  ) {}
  async fetch(input: {
    repository: string;
    tag: string;
    artifactId: string;
    trustStore: PublicTrustStore;
  }): Promise<DistributionResult> {
    const release = await this.provider.getRelease(input.repository, input.tag);
    if (
      release.repository !== `https://github.com/${input.repository}` ||
      !release.draft ||
      !release.prerelease
    )
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        "Acceptance release/provider identity or state is invalid.",
      );
    const manifestAsset = oneAsset(release, "release-manifest.json");
    const signatureAsset = oneAsset(release, "release-manifest.sig");
    const manifestBytes = await readBounded(
      await this.provider.openAsset(manifestAsset),
      1024 * 1024,
    );
    const signatureBytes = await readBounded(
      await this.provider.openAsset(signatureAsset),
      64 * 1024,
    );
    const manifestValue: unknown = JSON.parse(manifestBytes.toString("utf8"));
    const signature = JSON.parse(
      signatureBytes.toString("utf8"),
    ) as ReleaseSignature;
    const verification = verifyReleaseManifest(
      manifestValue,
      signature,
      input.trustStore,
    );
    if (
      verification.trustDecision !== "SIGNED_TRUSTED" ||
      !validateManifest(manifestValue) ||
      manifestValue.repository !== release.repository
    )
      throw new PlatformError(
        "SIGNATURE_INVALID",
        `Manifest trust decision: ${verification.trustDecision}.`,
      );
    const artifact = manifestValue.artifacts.find(
      (item) => item.artifactId === input.artifactId,
    );
    if (artifact === undefined)
      throw new PlatformError(
        "DISTRIBUTION_FAILED",
        "Signed manifest does not contain the requested artifact.",
      );
    const remote = oneAsset(release, artifact.filename);
    if (remote.size !== artifact.size || artifact.size > this.maxArtifactBytes)
      throw new PlatformError(
        "ARTIFACT_SIZE_MISMATCH",
        "Remote artifact size does not match the signed manifest.",
      );
    const targetDir = join(this.cacheRoot, artifact.sha256.toUpperCase());
    await mkdir(targetDir, { recursive: true });
    const partPath = join(
      targetDir,
      `${artifact.filename}.${randomBytes(6).toString("hex")}.part.ipk`,
    );
    const finalPath = join(targetDir, artifact.filename);
    let measured = 0;
    const hash = createHash("sha256");
    try {
      const output = createWriteStream(partPath, { flags: "wx" });
      for await (const chunk of await this.provider.openAsset(remote)) {
        const data = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
        measured += data.length;
        if (measured > this.maxArtifactBytes || measured > artifact.size)
          throw new PlatformError(
            "PACKAGE_TOO_LARGE",
            "Artifact download exceeded its signed size.",
          );
        hash.update(data);
        if (!output.write(data))
          await new Promise<void>((resolve) => output.once("drain", resolve));
      }
      await new Promise<void>((resolve, reject) => {
        output.end(resolve);
        output.once("error", reject);
      });
      const digest = hash.digest("hex").toUpperCase();
      if (measured !== artifact.size)
        throw new PlatformError(
          "ARTIFACT_SIZE_MISMATCH",
          "Downloaded artifact is truncated.",
        );
      if (digest !== artifact.sha256.toUpperCase())
        throw new PlatformError(
          "ARTIFACT_HASH_MISMATCH",
          "Downloaded artifact hash mismatch.",
        );
      const inspection = await inspectIpk(partPath);
      const app =
        inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
      if (app?.id !== artifact.appId || app.version !== artifact.version)
        throw new PlatformError(
          "ARTIFACT_IDENTITY_MISMATCH",
          "Downloaded IPK identity does not match the signed manifest.",
        );
      let finalExists = true;
      try {
        await access(finalPath);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          finalExists = false;
        else throw error;
      }
      if (finalExists) {
        const existing = await inspectIpk(finalPath);
        const existingApp =
          existing.manifests.length === 1 ? existing.manifests[0] : undefined;
        if (
          existing.hash.digest !== digest ||
          existing.size !== artifact.size ||
          existingApp?.id !== artifact.appId ||
          existingApp.version !== artifact.version
        )
          throw new PlatformError(
            "CACHE_VERIFICATION_FAILED",
            "Existing content-addressed cache entry is inconsistent.",
          );
        await rm(partPath, { force: true });
      } else await rename(partPath, finalPath);
      const metadata: VerifiedCacheMetadata = {
        schemaVersion: 1,
        sourceRepository: release.repository,
        release: release.tag,
        asset: artifact.filename,
        manifestDigest: createHash("sha256")
          .update(verification.manifestCanonical)
          .digest("hex")
          .toUpperCase(),
        signatureKeyId: signature.keyId,
        artifactSha256: digest,
        verifiedAt: new Date().toISOString(),
        trustDecision: "SIGNED_TRUSTED",
        manifest: manifestValue,
        signature,
      };
      const metadataPath = join(targetDir, "verified-metadata.json");
      await writeFile(
        metadataPath,
        `${JSON.stringify(metadata, null, 2)}\n`,
        "utf8",
      );
      return {
        artifactPath: finalPath,
        metadataPath,
        manifest: manifestValue,
        artifactId: artifact.artifactId,
        sha256: digest,
        trustLevel: "SIGNED",
        trustDecision: "SIGNED_TRUSTED",
        keyId: signature.keyId,
      };
    } catch (error) {
      await rm(partPath, { force: true });
      throw error;
    }
  }
  async list(): Promise<readonly string[]> {
    try {
      return (await readdir(this.cacheRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async verifyCached(
    digest: string,
    trustStore: PublicTrustStore,
  ): Promise<DistributionResult> {
    const dir = join(this.cacheRoot, digest.toUpperCase());
    const metadataPath = join(dir, "verified-metadata.json");
    const metadata = JSON.parse(
      await readFile(metadataPath, "utf8"),
    ) as VerifiedCacheMetadata;
    const verification = verifyReleaseManifest(
      metadata.manifest,
      metadata.signature,
      trustStore,
    );
    if (verification.trustDecision !== "SIGNED_TRUSTED")
      throw new PlatformError(
        "CACHE_VERIFICATION_FAILED",
        `Cached manifest trust decision: ${verification.trustDecision}.`,
      );
    const artifact = metadata.manifest.artifacts.find(
      (item) => item.sha256.toUpperCase() === digest.toUpperCase(),
    );
    if (artifact === undefined)
      throw new PlatformError(
        "CACHE_VERIFICATION_FAILED",
        "Cache metadata does not bind this digest.",
      );
    const artifactPath = join(dir, artifact.filename);
    const inspection = await inspectIpk(artifactPath);
    const app =
      inspection.manifests.length === 1 ? inspection.manifests[0] : undefined;
    if (
      inspection.hash.digest !== digest.toUpperCase() ||
      inspection.size !== artifact.size ||
      app?.id !== artifact.appId ||
      app.version !== artifact.version
    )
      throw new PlatformError(
        "CACHE_VERIFICATION_FAILED",
        "Cached artifact bytes or package identity changed.",
      );
    return {
      artifactPath,
      metadataPath,
      manifest: metadata.manifest,
      artifactId: artifact.artifactId,
      sha256: inspection.hash.digest,
      trustLevel: "SIGNED",
      trustDecision: "SIGNED_TRUSTED",
      keyId: metadata.signature.keyId,
    };
  }
}
