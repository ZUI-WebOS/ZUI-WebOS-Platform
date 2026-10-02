import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";
import { inspectIpk } from "@zui-webos/package-inspector";
import { createIpk, manifest } from "../helpers/ipk-fixture.js";

const temporaryDirectories: string[] = [];

async function fixture(data: Buffer, name = "fixture.ipk"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zui-ipk-test-"));
  temporaryDirectories.push(directory);
  const path = join(directory, name);
  await writeFile(path, data);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("verified package inspector", () => {
  it("hashes and reads a valid manifest without extracting files", async () => {
    const bytes = createIpk([
      { path: "usr/", type: "file" },
      {
        path: "usr/palm/applications/com.zui.test/appinfo.json",
        content: manifest(),
      },
    ]);
    const path = await fixture(bytes);
    const result = await inspectIpk(path);
    expect(result).toMatchObject({
      format: "debian-ar+tar.gz",
      manifests: [{ id: "com.zui.test", version: "1.2.3" }],
    });
    expect(result.hash.digest).toMatch(/^[A-F0-9]{64}$/u);
    expect(result.hash.digest).toBe(
      createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    );
  });

  it.each([
    [
      "path traversal",
      [{ path: "../appinfo.json", content: manifest() }],
      "UNSAFE_ARCHIVE_ENTRY",
    ],
    [
      "symlink",
      [{ path: "appinfo.json", type: "symlink" as const }],
      "UNSAFE_ARCHIVE_ENTRY",
    ],
    [
      "duplicate path",
      [
        { path: "appinfo.json", content: manifest() },
        { path: "APPINFO.JSON", content: manifest() },
      ],
      "UNSAFE_ARCHIVE_ENTRY",
    ],
    [
      "missing manifest",
      [{ path: "index.html", content: "ok" }],
      "PACKAGE_METADATA_INVALID",
    ],
    [
      "malformed manifest",
      [{ path: "appinfo.json", content: "{" }],
      "PACKAGE_METADATA_INVALID",
    ],
  ])("rejects %s", async (_name, entries, code) => {
    const path = await fixture(createIpk(entries));
    await expect(inspectIpk(path)).rejects.toMatchObject({ code });
  });

  it("represents multiple manifests instead of silently selecting one", async () => {
    const path = await fixture(
      createIpk([
        { path: "a/appinfo.json", content: manifest({ id: "com.zui.a" }) },
        { path: "b/appinfo.json", content: manifest({ id: "com.zui.b" }) },
      ]),
    );
    await expect(inspectIpk(path)).resolves.toMatchObject({
      manifests: [{ id: "com.zui.a" }, { id: "com.zui.b" }],
    });
  });

  it("enforces configured package and unpacked-size limits", async () => {
    const path = await fixture(
      createIpk([{ path: "appinfo.json", content: manifest() }]),
    );
    await expect(
      inspectIpk(path, {
        maxIpkBytes: 8,
        maxArchiveEntries: 10,
        maxEntryBytes: 1024,
        maxTotalUnpackedBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_TOO_LARGE" });
  });

  it("rejects an oversized archive entry", async () => {
    const path = await fixture(
      createIpk([{ path: "appinfo.json", content: manifest() }]),
    );
    await expect(
      inspectIpk(path, {
        maxIpkBytes: 1024 * 1024,
        maxArchiveEntries: 20,
        maxEntryBytes: 64,
        maxTotalUnpackedBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "ARCHIVE_LIMIT_EXCEEDED" });
  });

  it("rejects a truncated package", async () => {
    const bytes = createIpk([{ path: "appinfo.json", content: manifest() }]);
    const path = await fixture(bytes.subarray(0, bytes.length - 20));
    await expect(inspectIpk(path)).rejects.toMatchObject({
      code: "INVALID_PACKAGE",
    });
  });

  it("rejects invalid archive bytes", async () => {
    const path = await fixture(Buffer.from("not an ipk"));
    await expect(inspectIpk(path)).rejects.toMatchObject({
      code: "INVALID_PACKAGE",
    });
  });
});
