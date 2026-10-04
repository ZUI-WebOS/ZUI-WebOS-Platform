import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import { parseArguments } from "../../apps/devmode-keeper/src/cli.js";
import { createIpk, manifest } from "../helpers/ipk-fixture.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function fixtureBytes(): Buffer {
  return createIpk([
    {
      path: "usr/palm/applications/com.zui.argv.test/appinfo.json",
      content: manifest({ id: "com.zui.argv.test", version: "1.0.0" }),
    },
  ]);
}

async function inspectThroughRootScript(path: string): Promise<string> {
  let executable = "pnpm";
  let args = ["exec", "zui-webos", "package", "inspect", path, "--json"];
  if (process.platform === "win32") {
    const bridgeRoot = await mkdtemp(join(tmpdir(), "zui-argv-bridge-"));
    roots.push(bridgeRoot);
    const script = join(bridgeRoot, "invoke.ps1");
    await writeFile(
      script,
      [
        "param([Parameter(Mandatory=$true)][string]$ArtifactPath)",
        "$ErrorActionPreference = 'Stop'",
        "& pnpm exec zui-webos package inspect $ArtifactPath --json",
        "exit $LASTEXITCODE",
      ].join("\r\n"),
    );
    executable = "powershell.exe";
    args = [
      "-NoProfile",
      "-NonInteractive",
      "-File",
      script,
      "-ArtifactPath",
      path,
    ];
  }
  const { stdout } = await execFileAsync(executable, args, {
    cwd: new URL("../../", import.meta.url),
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  const start = stdout.indexOf('{\n  "inspection"');
  if (start < 0) throw new Error(`Missing inspection JSON: ${stdout}`);
  const value = JSON.parse(stdout.slice(start)) as {
    readonly inspection?: { readonly path?: unknown };
  };
  if (typeof value.inspection?.path !== "string")
    throw new Error("Inspection path is missing.");
  return value.inspection.path;
}

describe("Windows CLI argument forwarding", () => {
  it("uses one direct Node entrypoint instead of nested package-script forwarding", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { readonly scripts?: Record<string, unknown> };
    expect(packageJson.scripts?.["zui-webos"]).toBeUndefined();
    const cliPackage = JSON.parse(
      await readFile(
        new URL("../../apps/devmode-keeper/package.json", import.meta.url),
        "utf8",
      ),
    ) as { readonly bin?: Record<string, unknown> };
    expect(cliPackage.bin?.["zui-webos"]).toBe("./bin/zui-webos.js");
    await expect(
      readFile(
        new URL("../../apps/devmode-keeper/bin/zui-webos.js", import.meta.url),
        "utf8",
      ),
    ).resolves.toContain('import("../dist/cli.js")');
  });

  it.runIf(process.platform === "win32")(
    "preserves normal backslash, spaces, and LOCALAPPDATA paths through pnpm",
    async () => {
      const base = await mkdtemp(join(tmpdir(), "zui-argv-"));
      roots.push(base);
      const localBase = join(
        process.env.LOCALAPPDATA ?? base,
        `ZUI-WebOS-argv-test-${String(process.pid)}`,
      );
      roots.push(localBase);
      const paths = [
        join(base, "normal", "artifact.ipk"),
        join(base, "path with spaces", "artifact file.ipk"),
        join(localBase, "artifacts", "sha256", "ABCDEF", "artifact.ipk"),
      ];
      for (const path of paths) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, fixtureBytes());
        expect(await inspectThroughRootScript(path)).toBe(await realpath(path));
      }
    },
  );

  it("preserves artifact and source repository argv values exactly without double escaping", () => {
    const artifact =
      "C:\\Users\\MSI\\AppData\\Local\\ZUI-WebOS\\artifacts\\sha256\\ABCDEF\\artifact.ipk";
    const source = "C:\\My_OS\\LG-TV\\ZUI_YouTube_WebOS";
    const spaced = "C:\\Path With Spaces\\artifact file.ipk";
    const parsed = parseArguments([
      "release",
      "staging",
      "prepare",
      "artifact-id",
      artifact,
      source,
      "a".repeat(40),
      "release-id",
      spaced,
    ]);
    expect(parsed.command[4]).toBe(artifact);
    expect(parsed.command[5]).toBe(source);
    expect(parsed.command[8]).toBe(spaced);
    expect(parsed.command[4]).not.toContain("\\\\");
    expect(parsed.command[5]).not.toContain("\\\\");
  });
});
