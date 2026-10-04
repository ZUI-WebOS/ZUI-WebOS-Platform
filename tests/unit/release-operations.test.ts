import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ProductRegistry,
  ProductRelease,
} from "@zui-webos/catalog-contracts";
import {
  GitHubReleasePublisher,
  GhCliGitHubReleaseApi,
  GitSourceRepositoryVerifier,
  PinnedArtifactStager,
  StagingKeyStore,
  StagingReleasePipeline,
  type GitHubReleaseApi,
  type PermissionHardener,
  type PreparedStagingRelease,
  type PublishedDraftRelease,
  type SourceRepositoryVerifier,
} from "@zui-webos/release-operations";
import { inspectIpk } from "@zui-webos/package-inspector";
import type { PublicTrustStore } from "@zui-webos/signed-release";
import { PlatformError } from "@zui-webos/webos-client";

import { createIpk, manifest as appManifest } from "../helpers/ipk-fixture.js";

const roots: string[] = [];
const execFileAsync = promisify(execFile);
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

const permissions: PermissionHardener = {
  harden: async () => ({ method: "POSIX_MODE", applied: true }),
};
const sourceVerifier: SourceRepositoryVerifier = {
  verify: async () => undefined,
};

async function keyFixture() {
  const root = await mkdtemp(join(tmpdir(), "zui-key-test-"));
  roots.push(root);
  const store = new StagingKeyStore(root, permissions);
  const passphrase = Buffer.from("correct horse battery staple");
  const generated = await store.generate(
    passphrase,
    new Date("2026-10-03T00:00:00.000Z"),
  );
  return { root, store, passphrase, generated };
}

async function releaseFixture() {
  const key = await keyFixture();
  const artifactRoot = await mkdtemp(join(tmpdir(), "zui-release-test-"));
  const bundleRoot = await mkdtemp(join(tmpdir(), "zui-bundle-test-"));
  roots.push(artifactRoot, bundleRoot);
  const filename = "com.zui.webos.youtube.staging_0.8.4_all.ipk";
  const bytes = createIpk([
    {
      path: "usr/palm/applications/com.zui.webos.youtube.staging/appinfo.json",
      content: appManifest({
        id: "com.zui.webos.youtube.staging",
        version: "0.8.4",
      }),
    },
  ]);
  const artifactPath = join(artifactRoot, filename);
  await writeFile(artifactPath, bytes);
  const repository = "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS";
  const registry: ProductRegistry = {
    schemaVersion: 1,
    products: [
      {
        id: "zui-youtube-webos",
        displayName: "ZUI YouTube for webOS",
        repository,
        appIds: ["com.zui.webos.youtube.staging"],
        appIdentities: [
          {
            appId: "com.zui.webos.youtube.staging",
            deploymentClass: "staging",
          },
        ],
        deploymentModel: "developer-mode-ipk",
        releaseSource: "github-releases",
        rootlessCompatible: true,
        sourceModel: "external-product-repository",
      },
    ],
  };
  const release: ProductRelease = {
    schemaVersion: 1,
    productId: "zui-youtube-webos",
    version: "0.8.4",
    channel: "staging",
    sourceRepository: repository,
    releaseRef: "old-acceptance",
    artifacts: [
      {
        artifactId: "zui-youtube-webos-0.8.4-staging",
        filename,
        appId: "com.zui.webos.youtube.staging",
        version: "0.8.4",
        deploymentClass: "staging",
        size: bytes.length,
        hash: {
          algorithm: "sha256",
          digest: createHash("sha256")
            .update(bytes)
            .digest("hex")
            .toUpperCase(),
        },
        source: { type: "GITHUB_RELEASE", repository },
      },
    ],
  };
  const trustStore: PublicTrustStore = {
    schemaVersion: 1,
    keys: [key.generated.trustEntry],
  };
  const input = {
    registry,
    releases: [release],
    trustStore,
    artifactId: release.artifacts[0]!.artifactId,
    artifactPath,
    sourceRepositoryPath: "C:\\source",
    sourceCommit: "a".repeat(40),
    releaseId: "zui-staging-zui-youtube-webos-0.8.4-20261003-aaaaaaaa",
    signer: await key.store.unlock(key.passphrase),
    now: new Date("2026-10-03T01:00:00.000Z"),
  } as const;
  return {
    ...key,
    registry,
    release,
    trustStore,
    input,
    pipeline: new StagingReleasePipeline(sourceVerifier, bundleRoot),
  };
}

describe("operational staging key store", () => {
  it("creates encrypted PKCS#8, derives a stable public ID, unlocks, and refuses overwrite", async () => {
    const fixture = await keyFixture();
    const pem = await readFile(fixture.generated.privateKeyPath, "utf8");
    expect(pem).toContain("BEGIN ENCRYPTED PRIVATE KEY");
    expect(pem).not.toContain("BEGIN PRIVATE KEY");
    const signer = await fixture.store.unlock(fixture.passphrase);
    expect(signer.keyId).toBe(fixture.generated.trustEntry.keyId);
    expect(fixture.generated.trustEntry).toMatchObject({
      algorithm: "Ed25519",
      status: "ACTIVE",
      scopes: ["STAGING_RELEASE"],
    });
    await expect(
      fixture.store.generate(Buffer.from("another long safe passphrase")),
    ).rejects.toMatchObject({ code: "SIGNING_KEY_EXISTS" });
  });

  it("rejects weak/wrong passphrases and corrupt encrypted key material", async () => {
    const fixture = await keyFixture();
    await expect(
      fixture.store.unlock(Buffer.from("wrong wrong wrong wrong")),
    ).rejects.toMatchObject({ code: "SIGNING_KEY_UNLOCK_FAILED" });
    await writeFile(fixture.generated.privateKeyPath, "corrupt encrypted key");
    await expect(
      fixture.store.unlock(fixture.passphrase),
    ).rejects.toMatchObject({
      code: "SIGNING_KEY_UNLOCK_FAILED",
    });
    const emptyRoot = await mkdtemp(join(tmpdir(), "zui-key-empty-"));
    roots.push(emptyRoot);
    await expect(
      new StagingKeyStore(emptyRoot, permissions).generate(
        Buffer.from("short"),
      ),
    ).rejects.toMatchObject({ code: "SIGNING_KEY_PASSPHRASE_INVALID" });
  });
});

describe("staging release pipeline", () => {
  it("stages pinned bytes under their digest and refuses inconsistent existing data", async () => {
    const fixture = await releaseFixture();
    const inputRoot = await mkdtemp(join(tmpdir(), "zui-release-input-test-"));
    roots.push(inputRoot);
    const stager = new PinnedArtifactStager(inputRoot);
    const staged = await stager.stage({
      releases: fixture.input.releases,
      artifactId: fixture.input.artifactId,
      sourcePath: fixture.input.artifactPath,
    });
    const digest = fixture.release.artifacts[0]!.hash.digest;
    expect(staged.artifactPath).toBe(
      join(inputRoot, digest, basename(fixture.input.artifactPath)),
    );
    expect((await inspectIpk(staged.artifactPath)).hash.digest).toBe(digest);
    await writeFile(staged.artifactPath, "changed");
    await expect(
      stager.stage({
        releases: fixture.input.releases,
        artifactId: fixture.input.artifactId,
        sourcePath: fixture.input.artifactPath,
      }),
    ).rejects.toMatchObject({ code: "ARTIFACT_IDENTITY_MISMATCH" });
  });

  it("builds and re-verifies an exact staging bundle", async () => {
    const fixture = await releaseFixture();
    const prepared = await fixture.pipeline.prepare(fixture.input);
    expect(prepared.report).toMatchObject({
      signatureValid: true,
      trustDecision: "SIGNED_TRUSTED",
      deploymentClass: "staging",
      sourceCommit: "a".repeat(40),
    });
    await expect(
      fixture.pipeline.verifyBundle(
        prepared.directory,
        fixture.trustStore,
        fixture.input.now,
      ),
    ).resolves.toMatchObject({
      sha256: fixture.release.artifacts[0]!.hash.digest,
    });
  });

  it.each(["RETIRED", "REVOKED"] as const)(
    "blocks %s operational keys",
    async (status) => {
      const fixture = await releaseFixture();
      await expect(
        fixture.pipeline.prepare({
          ...fixture.input,
          trustStore: {
            schemaVersion: 1,
            keys: [{ ...fixture.generated.trustEntry, status }],
          },
        }),
      ).rejects.toMatchObject({ code: "RELEASE_POLICY_BLOCKED" });
    },
  );

  it("blocks wrong scope, artifact substitution, production metadata, and unsafe identity", async () => {
    const fixture = await releaseFixture();
    await expect(
      fixture.pipeline.prepare({
        ...fixture.input,
        trustStore: {
          schemaVersion: 1,
          keys: [
            {
              ...fixture.generated.trustEntry,
              scopes: ["PRODUCTION_RELEASE"],
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: "RELEASE_POLICY_BLOCKED" });
    await expect(
      fixture.pipeline.prepare({
        ...fixture.input,
        releaseId: "not-staging",
      }),
    ).rejects.toMatchObject({ code: "RELEASE_ID_INVALID" });
    await expect(
      fixture.pipeline.prepare({
        ...fixture.input,
        releases: [
          {
            ...fixture.release,
            channel: "stable",
            artifacts: [
              {
                ...fixture.release.artifacts[0]!,
                deploymentClass: "production",
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "RELEASE_POLICY_BLOCKED" });
    await writeFile(fixture.input.artifactPath, Buffer.from("substituted"));
    await expect(
      fixture.pipeline.prepare({
        ...fixture.input,
        releaseId: `${fixture.input.releaseId}-tamper`,
      }),
    ).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  });

  it("blocks public/private key mismatch", async () => {
    const fixture = await releaseFixture();
    const other = await keyFixture();
    await expect(
      fixture.pipeline.prepare({
        ...fixture.input,
        trustStore: { schemaVersion: 1, keys: [other.generated.trustEntry] },
      }),
    ).rejects.toMatchObject({ code: "RELEASE_POLICY_BLOCKED" });
  });

  it("blocks dirty/ambiguous source verification and duplicate local identities", async () => {
    const fixture = await releaseFixture();
    await fixture.pipeline.prepare(fixture.input);
    await expect(fixture.pipeline.prepare(fixture.input)).rejects.toMatchObject(
      {
        code: "RELEASE_ID_EXISTS",
      },
    );
    const blocked = new StagingReleasePipeline(
      {
        verify: async () => {
          throw new PlatformError("SOURCE_REPOSITORY_DIRTY", "dirty fixture");
        },
      },
      await mkdtemp(join(tmpdir(), "zui-source-blocked-")),
    );
    await expect(blocked.prepare(fixture.input)).rejects.toMatchObject({
      code: "SOURCE_REPOSITORY_DIRTY",
    });
  });
});

describe("source commit binding", () => {
  it("requires clean exact HEAD, registered origin, and expected-ref reachability", async () => {
    const root = await mkdtemp(join(tmpdir(), "zui-source-test-"));
    roots.push(root);
    const run = (args: readonly string[]) =>
      execFileAsync("git", [...args], { cwd: root, windowsHide: true });
    await run(["init", "-b", "main"]);
    await writeFile(join(root, "source.txt"), "verified source\n");
    await run(["add", "source.txt"]);
    await run([
      "-c",
      "user.name=ZUI Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "fixture",
    ]);
    const { stdout } = await run(["rev-parse", "HEAD"]);
    const commit = stdout.trim();
    await run([
      "remote",
      "add",
      "origin",
      "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS.git",
    ]);
    await run(["update-ref", "refs/remotes/origin/main", commit]);
    const verifier = new GitSourceRepositoryVerifier();
    const input = {
      path: root,
      expectedRepository: "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS",
      sourceCommit: commit,
    };
    await expect(verifier.verify(input)).resolves.toBeUndefined();
    await expect(
      verifier.verify({ ...input, sourceCommit: "b".repeat(40) }),
    ).rejects.toMatchObject({ code: "SOURCE_COMMIT_INVALID" });
    await expect(
      verifier.verify({
        ...input,
        expectedRepository: "https://github.com/ZUI-WebOS/Unexpected",
      }),
    ).rejects.toMatchObject({ code: "SOURCE_REPOSITORY_MISMATCH" });
    await writeFile(join(root, "dirty.txt"), "dirty\n");
    await expect(verifier.verify(input)).rejects.toMatchObject({
      code: "SOURCE_REPOSITORY_DIRTY",
    });
  });
});

class MemoryGitHubApi implements GitHubReleaseApi {
  existing: PublishedDraftRelease | null = null;
  created: PublishedDraftRelease | null = null;
  uploads: { name: string; size: number }[] = [];
  failUploadAt = -1;
  mutateReadback?: (release: PublishedDraftRelease) => PublishedDraftRelease;

  async findByTag(): Promise<PublishedDraftRelease | null> {
    return this.existing;
  }
  async createDraft(input: {
    repository: string;
    tag: string;
    targetCommitish: string;
  }): Promise<PublishedDraftRelease> {
    this.created = {
      id: 42,
      repository: `https://github.com/${input.repository}`,
      tag: input.tag,
      targetCommitish: input.targetCommitish,
      draft: true,
      prerelease: true,
      htmlUrl: "https://github.com/example/draft",
      assets: [],
    };
    return this.created;
  }
  async uploadAsset(input: { name: string; path: string }): Promise<void> {
    if (this.uploads.length === this.failUploadAt)
      throw new Error("upload failed");
    this.uploads.push({
      name: input.name,
      size: (await readFile(input.path)).length,
    });
  }
  async getById(): Promise<PublishedDraftRelease> {
    const release = this.created ?? this.existing;
    if (release === null) throw new Error("not created");
    const value = { ...release, assets: this.uploads };
    return this.mutateReadback?.(value) ?? value;
  }
}

async function preparedPublisherFixture(): Promise<{
  prepared: PreparedStagingRelease;
  registry: ProductRegistry;
}> {
  const fixture = await releaseFixture();
  return {
    prepared: await fixture.pipeline.prepare(fixture.input),
    registry: fixture.registry,
  };
}

describe("GitHub staging release publisher", () => {
  it("uses gh release upload so GitHub selects the release-upload host", async () => {
    const calls: { executable: string; args: readonly string[] }[] = [];
    const api = new GhCliGitHubReleaseApi(
      async (executable, args): Promise<{ stdout: string; stderr: string }> => {
        calls.push({ executable, args });
        return { stdout: "", stderr: "" };
      },
    );
    await api.uploadAsset({
      repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
      releaseId: 42,
      tag: "zui-staging-test",
      name: "artifact.ipk",
      path: "C:\\path with spaces\\artifact.ipk",
      contentType: "application/vnd.webos.ipk",
    });
    expect(calls).toEqual([
      {
        executable: "gh",
        args: [
          "release",
          "upload",
          "zui-staging-test",
          "C:\\path with spaces\\artifact.ipk",
          "--repo",
          "ZUI-WebOS/ZUI-YouTube-WebOS",
        ],
      },
    ]);
  });

  it("creates one draft prerelease, uploads only the whitelist, and verifies read-back", async () => {
    const fixture = await preparedPublisherFixture();
    const api = new MemoryGitHubApi();
    const result = await new GitHubReleasePublisher(api).upload(fixture);
    expect(result).toMatchObject({ draft: true, prerelease: true });
    expect(api.uploads.map((asset) => asset.name)).toEqual([
      "com.zui.webos.youtube.staging_0.8.4_all.ipk",
      "release-manifest.json",
      "release-manifest.sig",
    ]);
  });

  it("blocks duplicate identity and unexpected repository", async () => {
    const fixture = await preparedPublisherFixture();
    const duplicate = new MemoryGitHubApi();
    duplicate.existing = {
      id: 1,
      repository: fixture.prepared.manifest.repository,
      tag: fixture.prepared.manifest.releaseId,
      targetCommitish: fixture.prepared.manifest.sourceCommit,
      draft: true,
      prerelease: true,
      htmlUrl: "https://github.com/example/existing",
      assets: [],
    };
    await expect(
      new GitHubReleasePublisher(duplicate).upload(fixture),
    ).rejects.toMatchObject({ code: "RELEASE_ID_EXISTS" });
    await expect(
      new GitHubReleasePublisher(new MemoryGitHubApi()).upload({
        ...fixture,
        registry: {
          ...fixture.registry,
          products: [
            {
              ...fixture.registry.products[0]!,
              repository: "https://github.com/ZUI-WebOS/Unexpected",
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: "RELEASE_POLICY_BLOCKED" });
  });

  it("stops on partial upload and rejects read-back state/asset/commit mismatches", async () => {
    const fixture = await preparedPublisherFixture();
    const partial = new MemoryGitHubApi();
    partial.failUploadAt = 1;
    await expect(
      new GitHubReleasePublisher(partial).upload(fixture),
    ).rejects.toThrow("upload failed");
    expect(partial.uploads).toHaveLength(1);

    for (const mutate of [
      (release: PublishedDraftRelease) => ({ ...release, draft: false }),
      (release: PublishedDraftRelease) => ({ ...release, prerelease: false }),
      (release: PublishedDraftRelease) => ({
        ...release,
        targetCommitish: "b".repeat(40),
      }),
      (release: PublishedDraftRelease) => ({
        ...release,
        assets: [...release.assets, { name: "unexpected.log", size: 1 }],
      }),
    ]) {
      const api = new MemoryGitHubApi();
      api.mutateReadback = mutate;
      await expect(
        new GitHubReleasePublisher(api).upload(fixture),
      ).rejects.toMatchObject({ code: "RELEASE_READBACK_FAILED" });
    }
  });

  it("resumes only an exact approved draft and uploads only missing whitelist assets", async () => {
    const fixture = await preparedPublisherFixture();
    const api = new MemoryGitHubApi();
    const manifestBytes = (await readFile(fixture.prepared.manifestPath))
      .length;
    api.existing = {
      id: 402810510,
      repository: fixture.prepared.manifest.repository,
      tag: fixture.prepared.manifest.releaseId,
      targetCommitish: fixture.prepared.manifest.sourceCommit,
      draft: true,
      prerelease: true,
      htmlUrl: "https://github.com/example/recovery",
      assets: [{ name: "release-manifest.json", size: manifestBytes }],
    };
    api.uploads = [...api.existing.assets];
    const observed = await new GitHubReleasePublisher(api).resumeUpload({
      ...fixture,
      releaseId: 402810510,
    });
    expect(observed.assets.map((asset) => asset.name).sort()).toEqual(
      [
        "com.zui.webos.youtube.staging_0.8.4_all.ipk",
        "release-manifest.json",
        "release-manifest.sig",
      ].sort(),
    );
    expect(
      api.uploads.filter((asset) => asset.name === "release-manifest.json"),
    ).toHaveLength(1);

    const wrongId = new MemoryGitHubApi();
    wrongId.existing = api.existing;
    await expect(
      new GitHubReleasePublisher(wrongId).resumeUpload({
        ...fixture,
        releaseId: 7,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_READBACK_FAILED" });
  });
});
