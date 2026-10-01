#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { createLogger } from "./logger.js";
import { loadConfig, type ConfigOverrides } from "./config.js";
import { DevModeKeeperService } from "./service.js";
import {
  NodeProcessRunner,
  PlatformError,
  WebOSCliAdapter,
} from "@zui-webos/webos-client";

interface ParsedArguments {
  readonly command: readonly string[];
  readonly json: boolean;
  readonly dryRun: boolean;
  readonly overrides: ConfigOverrides;
}

const usage = `ZUI webOS Platform CLI

Usage:
  zui-webos devices list [--json]
  zui-webos devmode status [--device <alias>] [--json]
  zui-webos devmode extend [--device <alias>] [--dry-run] [--json]
  zui-webos devmode ensure [--device <alias>] [--dry-run] [--json]
  zui-webos doctor [--device <alias>] [--json]

Configuration precedence: CLI arguments, environment, local user config, defaults.
Environment: ZUI_WEBOS_DEVICE, ZUI_WEBOS_TIMEOUT_MS,
ZUI_DEVMODE_RENEW_THRESHOLD_HOURS, ZUI_WEBOS_CONFIG.`;

function optionValue(
  args: readonly string[],
  index: number,
  option: string,
): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new PlatformError("INVALID_ARGUMENT", `${option} requires a value.`);
  }
  return value;
}

export function parseArguments(args: readonly string[]): ParsedArguments {
  const command: string[] = [];
  let json = false;
  let dryRun = false;
  let device: string | undefined;
  let timeoutMs: number | undefined;
  let thresholdHours: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === undefined) continue;
    switch (value) {
      case "--":
        break;
      case "--json":
        json = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--device":
        device = optionValue(args, index, value);
        index += 1;
        break;
      case "--timeout-ms":
        timeoutMs = Number(optionValue(args, index, value));
        index += 1;
        break;
      case "--threshold-hours":
        thresholdHours = Number(optionValue(args, index, value));
        index += 1;
        break;
      case "--help":
      case "-h":
        command.push("help");
        break;
      default:
        if (value.startsWith("--")) {
          throw new PlatformError(
            "INVALID_ARGUMENT",
            `Unknown option '${value}'.`,
          );
        }
        command.push(value);
    }
  }

  return {
    command,
    json,
    dryRun,
    overrides: {
      ...(device === undefined ? {} : { device }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(thresholdHours === undefined ? {} : { thresholdHours }),
    },
  };
}

async function execute(args: readonly string[]): Promise<number> {
  const parsed = parseArguments(args);
  const logger = createLogger(parsed.json);
  if (parsed.command.length === 0 || parsed.command[0] === "help") {
    logger.result(usage);
    return 0;
  }

  const config = await loadConfig(parsed.overrides);
  const adapter = new WebOSCliAdapter({
    runner: new NodeProcessRunner(),
    timeoutMs: config.timeoutMs,
  });
  const service = new DevModeKeeperService(adapter);
  const route = parsed.command.join(" ");

  switch (route) {
    case "devices list": {
      const devices = await service.listDevices();
      logger.result({
        devices: devices.map(({ alias, isDefault, profile }) => ({
          alias,
          isDefault,
          ...(profile === undefined ? {} : { profile }),
        })),
      });
      return 0;
    }
    case "devmode status":
      logger.result(await service.status(config.device));
      return 0;
    case "devmode extend":
      logger.result(
        await service.extend(config.device, { dryRun: parsed.dryRun }),
      );
      return 0;
    case "devmode ensure":
      logger.result(
        await service.ensure(config.device, { dryRun: parsed.dryRun }),
      );
      return 0;
    case "doctor": {
      const devices = await service.listDevices();
      const status = await service.status(config.device);
      logger.result({
        ok: true,
        node: process.version,
        configuredDevice: config.device,
        registeredDeviceCount: devices.length,
        connectionStatus: status.connectionStatus,
        rootless: true,
      });
      return 0;
    }
    default:
      throw new PlatformError(
        "INVALID_ARGUMENT",
        `Unknown command '${route}'.`,
      );
  }
}

export async function main(
  args: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const json = args.includes("--json");
  const logger = createLogger(json);
  try {
    process.exitCode = await execute(args);
  } catch (error: unknown) {
    if (error instanceof PlatformError) {
      logger.error({ ok: false, error: error.toJSON() });
      process.exitCode = error.exitCode;
      return;
    }

    logger.error({
      ok: false,
      error: {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
