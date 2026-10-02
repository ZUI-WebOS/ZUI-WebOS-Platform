import { readFile } from "node:fs/promises";

import {
  classifyPackageIdentity,
  matchProduct,
  validateRegistry,
} from "@zui-webos/catalog-contracts";
import { describe, expect, it } from "vitest";

describe("product registry", () => {
  it("contains valid source-free metadata for the two external products", async () => {
    const text = await readFile(
      new URL("../../repository/apps/products.json", import.meta.url),
      "utf8",
    );
    const registry: unknown = JSON.parse(text);

    expect(validateRegistry(registry)).toBe(true);
    if (!validateRegistry(registry))
      throw new Error("Invalid registry fixture");
    expect(registry.products).toHaveLength(2);
    expect(
      registry.products.every((product) => product.rootlessCompatible),
    ).toBe(true);
    expect(registry.products.flatMap((product) => product.appIds)).toEqual([
      "com.zui.player",
      "youtube.leanback.v4",
      "com.zui.webos.youtube.staging",
    ]);
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
