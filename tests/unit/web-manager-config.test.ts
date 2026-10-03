import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_WEB_MANAGER_PORT,
  WEB_MANAGER_HOST,
  loadWebManagerConfig,
  parseWebManagerPort,
} from "../../apps/web-portal/src/config.js";

describe("Web Manager port configuration", () => {
  afterEach(() => {
    delete process.env.ZUI_WEB_MANAGER_PORT;
  });

  it("uses one loopback-only default configuration", () => {
    expect(loadWebManagerConfig({})).toEqual({
      host: "127.0.0.1",
      port: DEFAULT_WEB_MANAGER_PORT,
    });
    expect(WEB_MANAGER_HOST).toBe("127.0.0.1");
    expect(DEFAULT_WEB_MANAGER_PORT).toBe(4273);
  });

  it.each(["", "0", "65536", "-1", "42.5", "not-a-port", " 4273 "])(
    "rejects invalid configured port %j",
    (value) => {
      expect(() => parseWebManagerPort(value)).toThrow(
        /whole number between 1 and 65535/u,
      );
    },
  );

  it("accepts the full valid TCP port range", () => {
    expect(parseWebManagerPort("1")).toBe(1);
    expect(parseWebManagerPort("4273")).toBe(4273);
    expect(parseWebManagerPort("65535")).toBe(65_535);
  });

  it("fails clearly when the configured port is occupied", async () => {
    const blocker = createServer();
    blocker.listen(0, WEB_MANAGER_HOST);
    await once(blocker, "listening");
    const address = blocker.address();
    if (address === null || typeof address === "string")
      throw new Error("Test listener did not expose a TCP port.");

    const child = spawn(process.execPath, ["apps/web-portal/dist/server.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ZUI_WEB_MANAGER_MOCK: "1",
        ZUI_WEB_MANAGER_PORT: String(address.port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const [exitCode] = (await once(child, "exit")) as [number | null];
    await new Promise<void>((resolve, reject) => {
      blocker.close((error) =>
        error === undefined ? resolve() : reject(error),
      );
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain(
      `${WEB_MANAGER_HOST}:${String(address.port)} is already in use`,
    );
    expect(stderr).toContain("set ZUI_WEB_MANAGER_PORT");
  });
});
