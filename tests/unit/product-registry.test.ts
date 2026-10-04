import { readFile } from "node:fs/promises";

import {
  classifyPackageIdentity,
  matchProduct,
  validateReleaseRecords,
  validateRegistry,
  verifyArtifactMetadata,
  type ProductRelease,
} from "@zui-webos/catalog-contracts";
import { describe, expect, it } from "vitest";

describe("product registry", () => {
  it("contains valid source-free metadata for the three managed products", async () => {
    const text = await readFile(
      new URL("../../repository/apps/products.json", import.meta.url),
      "utf8",
    );
    const registry: unknown = JSON.parse(text);

    expect(validateRegistry(registry)).toBe(true);
    if (!validateRegistry(registry))
      throw new Error("Invalid registry fixture");
    expect(registry.products).toHaveLength(3);
    expect(
      registry.products.every((product) => product.rootlessCompatible),
    ).toBe(true);
    expect(registry.products.flatMap((product) => product.appIds)).toEqual([
      "com.zui.player",
      "com.zui.webos.store.staging",
      "youtube.leanback.v4",
      "com.zui.webos.youtube.staging",
    ]);
  });

  it("validates pinned release metadata and distinguishes matching from tampered bytes", async () => {
    const registryValue: unknown = JSON.parse(
      await readFile(
        new URL("../../repository/apps/products.json", import.meta.url),
        "utf8",
      ),
    );
    const releaseValue: unknown = JSON.parse(
      await readFile(
        new URL(
          "../../repository/releases/zui-youtube-webos/0.8.4-staging.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    if (!validateRegistry(registryValue))
      throw new Error("Invalid registry fixture");
    expect(validateReleaseRecords([releaseValue], registryValue)).toEqual({
      valid: true,
      errors: [],
    });
    const release = releaseValue as ProductRelease;
    const observed = {
      filename: "com.zui.webos.youtube.staging_0.8.4_all.ipk",
      sha256:
        "816ECFBEBC234443B4E492A9EE7472DDCBB1783CF09B5100BA9B321A882A66F4",
      size: 94208,
      appId: "com.zui.webos.youtube.staging",
      version: "0.8.4",
    };
    expect(verifyArtifactMetadata([release], observed)).toMatchObject({
      status: "VERIFIED_PINNED_ARTIFACT",
      trustLevel: "REPOSITORY_PINNED_HASH",
    });
    expect(
      verifyArtifactMetadata([release], {
        ...observed,
        sha256: "0".repeat(64),
      }),
    ).toMatchObject({ status: "HASH_MISMATCH", trustLevel: "UNVERIFIED" });
  });

  it("classifies production, staging, and unknown identities without claiming authenticity", async () => {
    const registry: unknown = JSON.parse(
      await readFile(
        new URL("../../repository/apps/products.json", import.meta.url),
        "utf8",
      ),
    );
    if (!validateRegistry(registry))
      throw new Error("Invalid registry fixture");
    expect(
      matchProduct(registry, "youtube.leanback.v4", "webosbrew.org"),
    ).toMatchObject({
      classification: "KNOWN_PRODUCT",
      deploymentClass: "production",
      publisherMatched: true,
      authenticityVerified: false,
    });
    expect(
      matchProduct(registry, "com.zui.webos.youtube.staging"),
    ).toMatchObject({
      classification: "KNOWN_STAGING_PRODUCT",
      deploymentClass: "staging",
    });
    expect(matchProduct(registry, "com.unknown.app")).toMatchObject({
      classification: "UNKNOWN_PRODUCT",
      product: null,
    });
    expect(classifyPackageIdentity(registry, null)).toMatchObject({
      classification: "INVALID_PACKAGE",
    });
    expect(
      classifyPackageIdentity(registry, "com.zui.player", "zui-youtube-webos"),
    ).toMatchObject({ classification: "APP_ID_MISMATCH" });
  });
});
