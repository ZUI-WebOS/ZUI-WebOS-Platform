import type {
  CommandResult,
  DeveloperModeStatus,
  DeviceAlias,
  InstalledApplication,
  InstalledApplicationId,
  ApplicationVersion,
  InventorySnapshot,
  ManagedDevice,
  WebOSDevice,
} from "@zui-webos/shared-types";

import { validateDeviceAlias } from "./alias.js";
import { PlatformError } from "./errors.js";
import type { ProcessRunner } from "./process-runner.js";

export interface WebOSCliExecutables {
  readonly setupDevice: string;
  readonly launch: string;
  readonly install: string;
}

export interface WebOSCliAdapterOptions {
  readonly runner: ProcessRunner;
  readonly timeoutMs?: number;
  readonly executables?: Partial<WebOSCliExecutables>;
  readonly now?: () => Date;
}

const DEFAULT_EXECUTABLES: WebOSCliExecutables = {
  setupDevice: "ares-setup-device",
  launch: "ares-launch",
  install: "ares-install",
};

interface ResolvedCommand {
  readonly logicalName: string;
  readonly executable: string;
  readonly prefixArgs: readonly string[];
}

function resolveDefaultCommand(name: string): ResolvedCommand {
  if (process.platform !== "win32") {
    return { logicalName: name, executable: name, prefixArgs: [] };
  }

  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory.length === 0) continue;
    const cliScript = join(
      directory,
      "node_modules",
      "@webos-tools",
      "cli",
      "bin",
      `${name}.js`,
    );
    if (existsSync(cliScript)) {
      return {
        logicalName: name,
        executable: process.execPath,
        prefixArgs: [cliScript],
      };
    }

    const executable = join(directory, `${name}.exe`);
    if (existsSync(executable)) {
      return { logicalName: name, executable, prefixArgs: [] };
    }
  }

  return { logicalName: name, executable: name, prefixArgs: [] };
}

function commandDetail(result: CommandResult): string {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return output.length === 0 ? `exitCode=${String(result.exitCode)}` : output;
}

function parseDeviceLines(stdout: string): WebOSDevice[] {
  const devices: WebOSDevice[] = [];

  for (const rawLine of stdout.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (
      line.length === 0 ||
      line.startsWith("name ") ||
      line.startsWith("---") ||
      line.startsWith("[Info]")
    ) {
      continue;
    }

    const match =
      /^(?<alias>[A-Za-z0-9][A-Za-z0-9._-]{0,63})(?:\s+\(default\))?\s+/u.exec(
        line,
      );
    const aliasText = match?.groups?.alias;
    if (aliasText === undefined) continue;

    const profileMatch = /\s+(?<profile>tv|ose|signage)\s*(?:\S+)?$/u.exec(
      line,
    );
    devices.push({
      alias: validateDeviceAlias(aliasText),
      isDefault: line.startsWith(`${aliasText} (default)`),
      ...(profileMatch?.groups?.profile === undefined
        ? {}
        : { profile: profileMatch.groups.profile }),
      connectionStatus: "unknown",
    });
  }

  return devices;
}

function parseInstalledApplications(stdout: string): InstalledApplication[] {
  const clean = stdout
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith("[Info]"));
  const blocks = clean.join("\n").split(/\n\s*\n/u);
  const applications: InstalledApplication[] = [];

  for (const block of blocks) {
    if (block.trim().length === 0) continue;
    const metadata: Record<string, string> = {};
    for (const line of block.split("\n")) {
      const separator = line.indexOf(" : ");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 3).trim();
      if (key.length > 0 && !key.startsWith("-")) metadata[key] = value;
    }
    const id = metadata.id;
    if (id === undefined || id.length === 0) {
      throw new PlatformError(
        "MALFORMED_APP_INVENTORY",
        "Installed application inventory contained a block without an app ID.",
      );
    }
    applications.push({
      id: id as InstalledApplicationId,
      ...(metadata.title ? { title: metadata.title } : {}),
      ...(metadata.version
        ? { version: metadata.version as ApplicationVersion }
        : {}),
      ...(metadata.type ? { type: metadata.type } : {}),
      ...(metadata.vendor ? { vendor: metadata.vendor } : {}),
      source: "ares-install-listfull",
      metadata,
    });
  }
  return applications;
}

export class WebOSCliAdapter {
  private readonly runner: ProcessRunner;
  private readonly timeoutMs: number;
  private readonly setupDeviceCommand: ResolvedCommand;
  private readonly launchCommand: ResolvedCommand;
  private readonly installCommand: ResolvedCommand;
  private readonly now: () => Date;

  constructor(options: WebOSCliAdapterOptions) {
    this.runner = options.runner;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.setupDeviceCommand = options.executables?.setupDevice
      ? {
          logicalName: options.executables.setupDevice,
          executable: options.executables.setupDevice,
          prefixArgs: [],
        }
      : resolveDefaultCommand(DEFAULT_EXECUTABLES.setupDevice);
    this.launchCommand = options.executables?.launch
      ? {
          logicalName: options.executables.launch,
          executable: options.executables.launch,
          prefixArgs: [],
        }
      : resolveDefaultCommand(DEFAULT_EXECUTABLES.launch);
    this.installCommand = options.executables?.install
      ? {
          logicalName: options.executables.install,
          executable: options.executables.install,
          prefixArgs: [],
        }
      : resolveDefaultCommand(DEFAULT_EXECUTABLES.install);
    this.now = options.now ?? (() => new Date());
  }

  async listDevices(): Promise<WebOSDevice[]> {
    const result = await this.runCli(this.setupDeviceCommand, ["--list"]);
    if (result.exitCode !== 0) {
      throw new PlatformError(
        "WEBOS_CLI_NOT_FOUND",
        "Unable to read the webOS CLI device registry.",
      );
    }

    return parseDeviceLines(result.stdout);
  }

  async requireDevice(alias: DeviceAlias): Promise<WebOSDevice> {
    const device = (await this.listDevices()).find(
      (candidate) => candidate.alias === alias,
    );
    if (device === undefined) {
      throw new PlatformError(
        "DEVICE_NOT_FOUND",
        `Device alias '${alias}' is not registered.`,
      );
    }

    return device;
  }

  async status(alias: DeviceAlias): Promise<DeveloperModeStatus> {
    await this.requireDevice(alias);
    const connectivity = await this.runCli(this.launchCommand, [
      "--running",
      "--device",
      alias,
    ]);

    if (connectivity.timedOut) {
      throw new PlatformError(
        "COMMAND_TIMEOUT",
        `Connectivity check for '${alias}' timed out.`,
      );
    }
    if (connectivity.exitCode !== 0) {
      throw new PlatformError(
        "DEVICE_UNREACHABLE",
        `Device '${alias}' is registered but unreachable.`,
      );
    }

    return {
      device: alias,
      connectionStatus: "reachable",
      appAvailability: "unknown",
      expiresAt: null,
      remainingSeconds: null,
      observedAt: this.now().toISOString(),
      detail:
        "The public webOS CLI confirms connectivity but does not expose Developer Mode expiry. Availability is verified when the official extension launch is accepted.",
    };
  }

  async inspectDevice(alias: DeviceAlias): Promise<ManagedDevice> {
    const device = await this.requireDevice(alias);
    const status = await this.status(alias);
    return {
      ...device,
      connectionStatus: status.connectionStatus,
      health: {
        connectionStatus: status.connectionStatus,
        checkedAt: status.observedAt,
      },
      capabilities: [
        "connectivity",
        "installed-application-inventory",
        "developer-mode-extension",
      ],
    };
  }

  async listInstalledApplications(
    alias: DeviceAlias,
  ): Promise<InventorySnapshot> {
    await this.status(alias);
    const result = await this.runCli(this.installCommand, [
      "--listfull",
      "--device",
      alias,
    ]);
    if (result.exitCode !== 0) {
      throw new PlatformError(
        "DEVICE_INVENTORY_FAILED",
        `Unable to read installed applications from '${alias}'.`,
      );
    }
    const applications = parseInstalledApplications(result.stdout);
    return {
      device: alias,
      timestamp: this.now().toISOString(),
      source: "ares-install-listfull",
      applications,
    };
  }

  async inspectInstalledApplication(
    alias: DeviceAlias,
    appId: string,
  ): Promise<InstalledApplication | null> {
    const snapshot = await this.listInstalledApplications(alias);
    return snapshot.applications.find((app) => app.id === appId) ?? null;
  }

  async installPackage(
    alias: DeviceAlias,
    packagePath: string,
  ): Promise<CommandResult> {
    return this.runCli(this.installCommand, [packagePath, "--device", alias]);
  }

  async extendDeveloperMode(alias: DeviceAlias): Promise<CommandResult> {
    await this.requireDevice(alias);
    return this.runCli(this.launchCommand, [
      "com.palmdts.devmode",
      "--params",
      "extend=true",
      "--device",
      alias,
    ]);
  }

  isAcceptedExtension(result: CommandResult): boolean {
    if (result.timedOut || result.exitCode !== 0) return false;
    const output = `${result.stdout}\n${result.stderr}`;
    return /Launched application com\.palmdts\.devmode/u.test(output);
  }

  private async runCli(
    command: ResolvedCommand,
    args: readonly string[],
  ): Promise<CommandResult> {
    try {
      const result = await this.runner.run({
        executable: command.executable,
        args: [...command.prefixArgs, ...args],
        timeoutMs: this.timeoutMs,
      });
      if (result.timedOut) {
        throw new PlatformError(
          "COMMAND_TIMEOUT",
          `webOS CLI command '${command.logicalName}' timed out.`,
          commandDetail(result),
        );
      }
      return { ...result, executable: command.logicalName, args };
    } catch (error: unknown) {
      if (error instanceof PlatformError) throw error;
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        throw new PlatformError(
          "WEBOS_CLI_NOT_FOUND",
          `Required webOS CLI executable '${command.logicalName}' was not found.`,
        );
      }
      throw error;
    }
  }
}

export { parseDeviceLines, parseInstalledApplications };
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
