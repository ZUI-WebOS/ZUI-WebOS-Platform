import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import {
  artifactCacheRoot,
  platformDataRoot,
  stagingInputRoot,
  stagingReleaseRoot,
} from "@zui-webos/runtime-paths";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("process-neutral runtime paths", () => {
  it.runIf(process.platform === "win32")(
    "does not use virtualizable LOCALAPPDATA as the default data root",
    () => {
      expect(
        platformDataRoot(
          { LOCALAPPDATA: "C:\\virtualized\\Local" },
          "C:\\Users\\Example",
        ),
      ).toBe("C:\\Users\\Example\\.zui-webos");
    },
  );

  it("derives cache, release input, and bundle paths from one root", () => {
    const root = join(tmpdir(), "zui data root");
    const env = { ZUI_WEBOS_DATA_DIR: root };
    expect(artifactCacheRoot(env)).toBe(join(root, "artifacts", "sha256"));
    expect(stagingInputRoot(env)).toBe(join(root, "release-inputs", "sha256"));
    expect(stagingReleaseRoot(env)).toBe(join(root, "releases", "staging"));
  });

  it("rejects a relative configured root", () => {
    expect(() => platformDataRoot({ ZUI_WEBOS_DATA_DIR: "relative" })).toThrow(
      "absolute",
    );
  });

  it.runIf(process.platform === "win32")(
    "is exactly visible to an ordinary child PowerShell process",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "zui shared data "));
      roots.push(root);
      const { stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[System.IO.Path]::GetFullPath($env:ZUI_WEBOS_DATA_DIR)",
        ],
        {
          env: { ...process.env, ZUI_WEBOS_DATA_DIR: root },
          windowsHide: true,
        },
      );
      expect(platformDataRoot({ ZUI_WEBOS_DATA_DIR: root })).toBe(root);
      expect(await realpath(stdout.trim())).toBe(await realpath(root));
    },
  );
});
