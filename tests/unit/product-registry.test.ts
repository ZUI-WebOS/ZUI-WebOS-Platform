import { readFile } from "node:fs/promises";

import { validateRegistry } from "@zui-webos/catalog-contracts";
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
});
