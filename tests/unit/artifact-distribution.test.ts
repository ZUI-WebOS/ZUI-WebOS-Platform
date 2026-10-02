import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";

import {
  ArtifactDistributionService,
  type ReleaseProvider,
  type RemoteAsset,
  type RemoteRelease,
} from "@zui-webos/artifact-distribution";
import {
  createEphemeralStagingSigner,
  type PublicTrustStore,
  type ReleaseManifestPayload,
} from "@zui-webos/signed-release";

import { createIpk, manifest as appManifest } from "../helpers/ipk-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

class MemoryProvider implements ReleaseProvider {
  constructor(
    readonly release: RemoteRelease,
    readonly content: Map<string, Buffer>,
  ) {}
  async getRelease(): Promise<RemoteRelease> {
    return this.release;
  }
  async openAsset(asset: RemoteAsset): Promise<Readable> {
    const value = this.content.get(asset.name);
    if (value === undefined) throw new Error(`No bytes for ${asset.name}`);
    return Readable.from(value);
  }
}

async function fixture(
  options: {
    tamperArtifact?: boolean;
    duplicate?: string;
    expectedAppId?: string;
    expectedVersion?: string;
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "zui-dist-test-"));
  roots.push(root);
  const ipk = createIpk([
    {
      path: "usr/palm/applications/com.zui.webos.youtube.staging/appinfo.json",
      content: appManifest({
        id: "com.zui.webos.youtube.staging",
        version: "0.8.4",
      }),
    },
  ]);
  const filename = "com.zui.webos.youtube.staging_0.8.4_all.ipk";
  const repository = "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS";
  const payload: ReleaseManifestPayload = {
    schemaVersion: 1,
    productId: "zui-youtube-webos",
    releaseId: "zui-staging-0.8.4-acceptance",
    version: options.expectedVersion ?? "0.8.4",
    channel: "staging",
    repository,
    sourceCommit: "ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2",
    issuedAt: "2026-10-02T00:00:00.000Z",
    artifacts: [
      {
        artifactId: "zui-youtube-webos-0.8.4-staging",
        filename,
        appId: options.expectedAppId ?? "com.zui.webos.youtube.staging",
        version: options.expectedVersion ?? "0.8.4",
        deploymentClass: "staging",
        size: ipk.length,
        sha256: createHash("sha256").update(ipk).digest("hex").toUpperCase(),
        contentType: "application/vnd.webos.ipk",
        source: {
          provider: "GITHUB_RELEASE",
          repository,
          releaseTag: "zui-staging-0.8.4-acceptance",
          assetName: filename,
        },
      },
    ],
  };
  const generated = createEphemeralStagingSigner(
    new Date("2026-10-01T00:00:00.000Z"),
  );
  const content = new Map<string, Buffer>([
    ["release-manifest.json", Buffer.from(JSON.stringify(payload))],
    [
      "release-manifest.sig",
      Buffer.from(JSON.stringify(generated.signer.sign(payload))),
    ],
    [filename, options.tamperArtifact ? Buffer.from(ipk).fill(0, 20, 21) : ipk],
  ]);
  const assets: RemoteAsset[] = [...content].map(([name, bytes]) => ({
    name,
    size: name === filename ? ipk.length : bytes.length,
    apiUrl: `memory://${name}`,
  }));
  if (options.duplicate !== undefined) {
    const duplicate = assets.find((asset) => asset.name === options.duplicate);
    if (duplicate !== undefined) assets.push({ ...duplicate });
  }
  const release: RemoteRelease = {
    repository,
    tag: "zui-staging-0.8.4-acceptance",
    draft: true,
    prerelease: true,
    assets,
  };
  const trustStore: PublicTrustStore = {
    schemaVersion: 1,
    keys: [generated.trustEntry],
  };
  return {
    root,
    payload,
    trustStore,
    provider: new MemoryProvider(release, content),
  };
}

describe("artifact distribution", () => {
  it("streams, verifies, promotes, and re-verifies a signed IPK", async () => {
    const item = await fixture();
    const service = new ArtifactDistributionService(item.provider, item.root);
    const fetched = await service.fetch({
      repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
      tag: "zui-staging-0.8.4-acceptance",
      artifactId: "zui-youtube-webos-0.8.4-staging",
      trustStore: item.trustStore,
    });
    expect(fetched.trustLevel).toBe("SIGNED");
    expect(await readFile(fetched.artifactPath)).toHaveLength(
      item.payload.artifacts[0]?.size ?? 0,
    );
    expect(
      (await service.verifyCached(fetched.sha256, item.trustStore))
        .trustDecision,
    ).toBe("SIGNED_TRUSTED");
    expect(
      (
        await service.fetch({
          repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
          tag: "zui-staging-0.8.4-acceptance",
          artifactId: "zui-youtube-webos-0.8.4-staging",
          trustStore: item.trustStore,
        })
      ).artifactPath,
    ).toBe(fetched.artifactPath);
    expect(await service.list()).toEqual([fetched.sha256]);
  });

  it.each(["release-manifest.json", "release-manifest.sig"])(
    "rejects duplicate %s assets",
    async (duplicate) => {
      const item = await fixture({ duplicate });
      await expect(
        new ArtifactDistributionService(item.provider, item.root).fetch({
          repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
          tag: "zui-staging-0.8.4-acceptance",
          artifactId: "zui-youtube-webos-0.8.4-staging",
          trustStore: item.trustStore,
        }),
      ).rejects.toMatchObject({ code: "DISTRIBUTION_FAILED" });
    },
  );

  it("rejects tampered bytes and removes partial files", async () => {
    const item = await fixture({ tamperArtifact: true });
    await expect(
      new ArtifactDistributionService(item.provider, item.root).fetch({
        repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
        tag: "zui-staging-0.8.4-acceptance",
        artifactId: "zui-youtube-webos-0.8.4-staging",
        trustStore: item.trustStore,
      }),
    ).rejects.toMatchObject({ code: "ARTIFACT_HASH_MISMATCH" });
    const digest = item.payload.artifacts[0]?.sha256 ?? "";
    expect(await readdir(join(item.root, digest))).toEqual([]);
  });

  it("rejects missing, oversized, truncated, and wrong-identity artifacts", async () => {
    const missing = await fixture();
    await expect(
      new ArtifactDistributionService(missing.provider, missing.root).fetch({
        repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
        tag: "zui-staging-0.8.4-acceptance",
        artifactId: "missing",
        trustStore: missing.trustStore,
      }),
    ).rejects.toMatchObject({ code: "DISTRIBUTION_FAILED" });

    const oversized = await fixture();
    await expect(
      new ArtifactDistributionService(
        oversized.provider,
        oversized.root,
        10,
      ).fetch({
        repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
        tag: "zui-staging-0.8.4-acceptance",
        artifactId: "zui-youtube-webos-0.8.4-staging",
        trustStore: oversized.trustStore,
      }),
    ).rejects.toMatchObject({ code: "ARTIFACT_SIZE_MISMATCH" });

    const truncated = await fixture();
    const filename = truncated.payload.artifacts[0]?.filename ?? "";
    const bytes = truncated.provider.content.get(filename) ?? Buffer.alloc(0);
    truncated.provider.content.set(
      filename,
      bytes.subarray(0, bytes.length - 1),
    );
    await expect(
      new ArtifactDistributionService(truncated.provider, truncated.root).fetch(
        {
          repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
          tag: "zui-staging-0.8.4-acceptance",
          artifactId: "zui-youtube-webos-0.8.4-staging",
          trustStore: truncated.trustStore,
        },
      ),
    ).rejects.toMatchObject({ code: "ARTIFACT_SIZE_MISMATCH" });

    for (const options of [
      { expectedAppId: "com.zui.wrong" },
      { expectedVersion: "9.9.9" },
    ]) {
      const wrong = await fixture(options);
      await expect(
        new ArtifactDistributionService(wrong.provider, wrong.root).fetch({
          repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
          tag: "zui-staging-0.8.4-acceptance",
          artifactId: "zui-youtube-webos-0.8.4-staging",
          trustStore: wrong.trustStore,
        }),
      ).rejects.toMatchObject({ code: "ARTIFACT_IDENTITY_MISMATCH" });
    }
  });

  it("rejects signature failure and unexpected release state", async () => {
    const badSignature = await fixture();
    badSignature.provider.content.set(
      "release-manifest.sig",
      Buffer.from(
        '{"algorithm":"Ed25519","keyId":"' +
          "A".repeat(64) +
          '","signature":"AAAA"}',
      ),
    );
    await expect(
      new ArtifactDistributionService(
        badSignature.provider,
        badSignature.root,
      ).fetch({
        repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
        tag: "zui-staging-0.8.4-acceptance",
        artifactId: "zui-youtube-webos-0.8.4-staging",
        trustStore: badSignature.trustStore,
      }),
    ).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });

    const published = await fixture();
    const provider = new MemoryProvider(
      { ...published.provider.release, draft: false },
      published.provider.content,
    );
    await expect(
      new ArtifactDistributionService(provider, published.root).fetch({
        repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
        tag: "zui-staging-0.8.4-acceptance",
        artifactId: "zui-youtube-webos-0.8.4-staging",
        trustStore: published.trustStore,
      }),
    ).rejects.toMatchObject({ code: "DISTRIBUTION_FAILED" });
  });

  it("fails closed when a cached signing key is revoked or bytes change", async () => {
    const item = await fixture();
    const service = new ArtifactDistributionService(item.provider, item.root);
    const fetched = await service.fetch({
      repository: "ZUI-WebOS/ZUI-YouTube-WebOS",
      tag: "zui-staging-0.8.4-acceptance",
      artifactId: "zui-youtube-webos-0.8.4-staging",
      trustStore: item.trustStore,
    });
    await expect(
      service.verifyCached(fetched.sha256, {
        schemaVersion: 1,
        keys: item.trustStore.keys.map((key) => ({
          ...key,
          status: "REVOKED",
        })),
      }),
    ).rejects.toMatchObject({ code: "CACHE_VERIFICATION_FAILED" });
    await writeFile(fetched.artifactPath, Buffer.from("corrupted"));
    await expect(
      service.verifyCached(fetched.sha256, item.trustStore),
    ).rejects.toBeDefined();
  });
});
