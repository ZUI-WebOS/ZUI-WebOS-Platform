import { describe, expect, it } from "vitest";

import type {
  CommandResult,
  DeveloperModeStatus,
  DeviceAlias,
} from "@zui-webos/shared-types";
import {
  NodeProcessRunner,
  PlatformError,
  parseInstalledApplications,
  validateDeviceAlias,
  WebOSCliAdapter,
} from "@zui-webos/webos-client";
import type { ProcessRequest, ProcessRunner } from "@zui-webos/webos-client";
import {
  DevModeKeeperService,
  type WebOSClient,
} from "../../apps/devmode-keeper/src/service.js";
import { parseArguments } from "../../apps/devmode-keeper/src/cli.js";

function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    executable: "ares-launch",
    args: [],
    exitCode: 0,
    stdout: "",
    stderr: "",
    durationMs: 1,
    timedOut: false,
    ...overrides,
  };
}

class QueueRunner implements ProcessRunner {
  readonly requests: ProcessRequest[] = [];

  constructor(private readonly outcomes: Array<CommandResult | Error>) {}

  async run(request: ProcessRequest): Promise<CommandResult> {
    this.requests.push(request);
    const outcome = this.outcomes.shift();
    if (outcome === undefined) throw new Error("No queued outcome");
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
}

const alias = validateDeviceAlias("tv");
const status: DeveloperModeStatus = {
  device: alias,
  connectionStatus: "reachable",
  appAvailability: "unknown",
  expiresAt: null,
  remainingSeconds: null,
  observedAt: "2026-10-02T00:00:00.000Z",
  detail: "test",
};

function serviceClient(
  extension: CommandResult = commandResult({
    stdout: "Launched application com.palmdts.devmode",
  }),
): WebOSClient {
  return {
    async listDevices() {
      return [
        { alias, isDefault: true, profile: "tv", connectionStatus: "unknown" },
      ];
    },
    async status() {
      return status;
    },
    async inspectDevice() {
      return {
        alias,
        isDefault: true,
        profile: "tv",
        connectionStatus: "reachable",
        health: { connectionStatus: "reachable", checkedAt: status.observedAt },
        capabilities: ["connectivity", "installed-application-inventory"],
      };
    },
    async listInstalledApplications() {
      return {
        device: alias,
        timestamp: status.observedAt,
        source: "ares-install-listfull",
        applications: [],
      };
    },
    async inspectInstalledApplication() {
      return null;
    },
    async extendDeveloperMode() {
      return extension;
    },
    isAcceptedExtension(result) {
      return (
        result.exitCode === 0 &&
        result.stdout.includes("Launched application com.palmdts.devmode")
      );
    },
  };
}

describe("device alias validation", () => {
  it("accepts a registry alias", () => {
    expect(validateDeviceAlias("living-room_1")).toBe("living-room_1");
  });

  it("rejects shell metacharacters", () => {
    expect(() => validateDeviceAlias("tv;Remove-Item")).toThrow(PlatformError);
  });
});

describe("CLI argument parsing", () => {
  it("accepts the standard option delimiter passed by package runners", () => {
    expect(parseArguments(["--", "devices", "list", "--json"])).toMatchObject({
      command: ["devices", "list"],
      json: true,
    });
  });
});

describe("webOS CLI adapter", () => {
  it("parses the real listfull block format", () => {
    const applications = parseInstalledApplications(
      "id : com.zui.player\n" +
        "title : ZUI\n" +
        "version : 1.0.1\n" +
        "vendor : ZUI\n\n" +
        "id : com.zui.webos.youtube.staging\n" +
        "title : ZUI YouTube STAGING\n" +
        "version : 0.8.4\n",
    );
    expect(applications).toMatchObject([
      {
        id: "com.zui.player",
        version: "1.0.1",
        source: "ares-install-listfull",
      },
      { id: "com.zui.webos.youtube.staging", version: "0.8.4" },
    ]);
  });

  it("rejects malformed listfull blocks without an app id", () => {
    expect(() =>
      parseInstalledApplications("title : orphan\nversion : 1.0.0\n"),
    ).toThrowError(
      expect.objectContaining({ code: "MALFORMED_APP_INVENTORY" }),
    );
  });

  it("constructs the extension command as argv without a shell", async () => {
    const list = commandResult({
      executable: "ares-setup-device",
      stdout:
        "name          deviceinfo                  connection  profile  passphrase\n" +
        "------------  --------------------------  ----------  -------  ----------\n" +
        "tv (default)  prisoner@192.0.2.1:9922     ssh         tv\n",
    });
    const launch = commandResult({
      stdout: "Launched application com.palmdts.devmode",
    });
    const runner = new QueueRunner([list, launch]);
    const adapter = new WebOSCliAdapter({
      runner,
      executables: { setupDevice: "setup-test", launch: "launch-test" },
    });

    await adapter.extendDeveloperMode(alias);

    expect(runner.requests[1]).toMatchObject({
      executable: "launch-test",
      args: [
        "com.palmdts.devmode",
        "--params",
        "extend=true",
        "--device",
        "tv",
      ],
    });
  });

  it("reports a missing CLI executable", async () => {
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
    const adapter = new WebOSCliAdapter({
      runner: new QueueRunner([missing]),
      executables: { setupDevice: "missing-cli" },
    });
    await expect(adapter.listDevices()).rejects.toMatchObject({
      code: "WEBOS_CLI_NOT_FOUND",
    });
  });

  it("reports a missing device alias", async () => {
    const runner = new QueueRunner([
      commandResult({ stdout: "name deviceinfo connection profile\n" }),
    ]);
    const adapter = new WebOSCliAdapter({
      runner,
      executables: { setupDevice: "setup-test" },
    });
    await expect(adapter.requireDevice(alias)).rejects.toMatchObject({
      code: "DEVICE_NOT_FOUND",
    });
  });

  it("reports a non-zero connectivity check as unreachable", async () => {
    const list = commandResult({ stdout: "tv (default)  redacted  ssh  tv\n" });
    const runner = new QueueRunner([
      list,
      commandResult({ exitCode: 1, stderr: "offline" }),
    ]);
    const adapter = new WebOSCliAdapter({
      runner,
      executables: { setupDevice: "setup-test", launch: "launch-test" },
    });
    await expect(adapter.status(alias)).rejects.toMatchObject({
      code: "DEVICE_UNREACHABLE",
    });
  });
});

describe("process timeout", () => {
  it("terminates an overlong child process", async () => {
    const result = await new NodeProcessRunner().run({
      executable: process.execPath,
      args: ["-e", "setTimeout(() => {}, 10_000)"],
      timeoutMs: 50,
    });
    expect(result.timedOut).toBe(true);
  });
});

describe("DevMode Keeper service", () => {
  it("does not issue a command in dry-run mode", async () => {
    let extensions = 0;
    const client = serviceClient();
    const wrapped: WebOSClient = {
      ...client,
      async extendDeveloperMode(device: DeviceAlias) {
        extensions += 1;
        return client.extendDeveloperMode(device);
      },
    };
    const result = await new DevModeKeeperService(wrapped).extend(alias, {
      dryRun: true,
    });
    expect(result.decision).toBe("dry-run");
    expect(extensions).toBe(0);
  });

  it("accepts extension only after command and post-check succeed", async () => {
    const result = await new DevModeKeeperService(serviceClient()).extend(
      alias,
      {
        dryRun: false,
      },
    );
    expect(result).toMatchObject({
      decision: "extended",
      commandAccepted: true,
      verified: true,
      expiryVerified: false,
    });
  });

  it("rejects an extension command with non-zero exit", async () => {
    const service = new DevModeKeeperService(
      serviceClient(commandResult({ exitCode: 1 })),
    );
    await expect(
      service.extend(alias, { dryRun: false }),
    ).rejects.toMatchObject({
      code: "EXTENSION_FAILED",
    });
  });

  it("rejects an extension response without the accepted launch marker", async () => {
    const service = new DevModeKeeperService(
      serviceClient(commandResult({ stdout: "unknown" })),
    );
    await expect(
      service.extend(alias, { dryRun: false }),
    ).rejects.toMatchObject({
      code: "EXTENSION_FAILED",
    });
  });

  it("rejects failed post-command verification", async () => {
    let checks = 0;
    const client: WebOSClient = {
      ...serviceClient(),
      async status() {
        checks += 1;
        return checks === 1
          ? status
          : { ...status, connectionStatus: "unreachable" };
      },
    };
    await expect(
      new DevModeKeeperService(client).extend(alias, { dryRun: false }),
    ).rejects.toMatchObject({ code: "VERIFICATION_FAILED" });
  });
});
