#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  matchProduct,
  validateRegistry,
  type ProductRegistry,
  type RegistryMatch,
} from "@zui-webos/catalog-contracts";
import { createInstallationPlan } from "@zui-webos/installation-planner";
import {
  inspectIpk,
  type PackageInspection,
} from "@zui-webos/package-inspector";

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
  readonly app?: string;
  readonly overrides: ConfigOverrides;
}

const usage = `ZUI webOS Platform CLI

Usage:
  zui-webos devices list [--json]
  zui-webos devices inspect --device <alias> [--json]
  zui-webos apps list --device <alias> [--json]
  zui-webos apps inspect --device <alias> --app <app-id> [--json]
  zui-webos package inspect <path.ipk> [--json]
  zui-webos package verify <path.ipk> [--json]
  zui-webos install plan <path.ipk> --device <alias> [--json]
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
  let app: string | undefined;
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
      case "--app":
        app = optionValue(args, index, value);
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
    ...(app === undefined ? {} : { app }),
    overrides: {
      ...(device === undefined ? {} : { device }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(thresholdHours === undefined ? {} : { thresholdHours }),
    },
  };
}

function validateAppId(value: string | undefined): string {
  if (
    value === undefined ||
    value.length > 255 ||
    !/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/u.test(value)
  ) {
    throw new PlatformError(
      "INVALID_ARGUMENT",
      "--app requires a valid application ID.",
    );
  }
  return value;
}

async function loadProductRegistry(): Promise<ProductRegistry> {
  const url = new URL(
    "../../../repository/apps/products.json",
    import.meta.url,
  );
  const value: unknown = JSON.parse(await readFile(url, "utf8"));
  if (!validateRegistry(value)) {
    throw new PlatformError(
      "INVALID_ARGUMENT",
      "The product registry is invalid.",
    );
  }
  return value;
}

function packageSummary(
  inspection: PackageInspection,
  matches: readonly (RegistryMatch & { readonly appId: string })[],
): string {
  const manifests = inspection.manifests
    .map(
      (manifest) =>
        `${manifest.id} ${manifest.version} (${manifest.archivePath})`,
    )
    .join(", ");
  return [
    `Package: ${inspection.filename}`,
    `SHA256: ${inspection.hash.digest}`,
    `Size: ${inspection.size} bytes`,
    `Manifest: ${manifests}`,
    `Registry: ${matches.map((match) => `${match.product?.displayName ?? "unknown"} ${match.classification}`).join(", ")}`,
    "Authenticity verified: no",
  ].join("\n");
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
  const commandGroup = parsed.command[0];
  const commandAction = parsed.command[1];
  const positionalPath = parsed.command[2];
  const emit = (value: unknown, human: string): void => {
    logger.result(parsed.json ? value : human);
  };

  if (
    commandGroup === "package" &&
    (commandAction === "inspect" || commandAction === "verify")
  ) {
    if (positionalPath === undefined || parsed.command.length !== 3) {
      throw new PlatformError(
        "INVALID_ARGUMENT",
        `package ${commandAction} requires one IPK path.`,
      );
    }
    const inspection = await inspectIpk(positionalPath);
    const registry = await loadProductRegistry();
    const registryMatches = inspection.manifests.map((manifest) => ({
      appId: manifest.id,
      ...matchProduct(registry, manifest.id, manifest.vendor),
    }));
    const result =
      commandAction === "verify"
        ? {
            verified: true,
            authenticityVerified: false,
            inspection,
            registryMatches,
          }
        : { inspection, registryMatches };
    emit(
      result,
      `${commandAction === "verify" ? "Structure and hash verified\n" : ""}${packageSummary(inspection, registryMatches)}`,
    );
    return 0;
  }

  if (commandGroup === "install" && commandAction === "plan") {
    if (positionalPath === undefined || parsed.command.length !== 3) {
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "install plan requires one IPK path.",
      );
    }
    const [inspection, registry, device, inventory] = await Promise.all([
      inspectIpk(positionalPath),
      loadProductRegistry(),
      service.inspectDevice(config.device),
      service.listInstalledApplications(config.device),
    ]);
    const plan = createInstallationPlan({
      package: inspection,
      registry,
      inventory,
      connectionStatus: device.health.connectionStatus,
    });
    const riskText = plan.risks
      .map((item) => `${item.severity} ${item.code}`)
      .join(", ");
    emit(
      plan,
      [
        "READ-ONLY installation plan (not executed)",
        `Device: ${plan.device}`,
        `Package: ${plan.manifest?.title ?? plan.package.filename} ${plan.comparison.packageVersion ?? "unknown"}`,
        `App: ${plan.comparison.packageAppId ?? "invalid"}`,
        `SHA256: ${plan.package.hash.digest}`,
        `Registry: ${plan.comparison.registryMatch.classification}`,
        `Installed: ${plan.comparison.installedApplication === null ? "no" : `yes / ${plan.comparison.installedVersion ?? "unknown"}`}`,
        `Version relation: ${plan.comparison.versionRelation}`,
        `Would overwrite: ${String(plan.wouldOverwriteExistingApp)}`,
        `Risks: ${riskText}`,
      ].join("\n"),
    );
    return 0;
  }

  switch (route) {
    case "devices list": {
      const devices = await service.listDevices();
      const result = {
        devices: devices.map(({ alias, isDefault, profile }) => ({
          alias,
          isDefault,
          ...(profile === undefined ? {} : { profile }),
        })),
      };
      emit(
        result,
        devices
          .map(
            (device) =>
              `${device.alias}${device.isDefault ? " (default)" : ""}`,
          )
          .join("\n"),
      );
      return 0;
    }
    case "devices inspect": {
      const device = await service.inspectDevice(config.device);
      emit(
        device,
        `${device.alias}: ${device.health.connectionStatus}\nCapabilities: ${device.capabilities.join(", ")}`,
      );
      return 0;
    }
    case "apps list": {
      const inventory = await service.listInstalledApplications(config.device);
      emit(
        inventory,
        inventory.applications
          .map(
            (app) =>
              `${app.id}${app.version === undefined ? "" : ` ${app.version}`}${app.title === undefined ? "" : ` - ${app.title}`}`,
          )
          .join("\n"),
      );
      return 0;
    }
    case "apps inspect": {
      const appId = validateAppId(parsed.app);
      const [app, registry] = await Promise.all([
        service.inspectInstalledApplication(config.device, appId),
        loadProductRegistry(),
      ]);
      const result = {
        device: config.device,
        installed: app !== null,
        appId,
        application: app,
        registryMatch: matchProduct(registry, appId, app?.vendor),
      };
      emit(
        result,
        app === null
          ? `${appId}: not installed`
          : `${app.id}${app.version === undefined ? "" : ` ${app.version}`}\n${app.title ?? "Untitled"}\n${result.registryMatch.classification}`,
      );
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
      const [devices, registry] = await Promise.all([
        service.listDevices(),
        loadProductRegistry(),
      ]);
      const status =
        parsed.overrides.device === undefined
          ? null
          : await service.status(config.device);
      const result = {
        ok: true,
        node: process.version,
        registeredDeviceCount: devices.length,
        webOSCli: "available" as const,
        deviceRegistry: "readable" as const,
        packageInspection: "available" as const,
        productRegistryValid: validateRegistry(registry),
        ...(status === null
          ? { deviceCheck: "not-requested" as const }
          : {
              configuredDevice: config.device,
              deviceCheck: "completed" as const,
              connectionStatus: status.connectionStatus,
            }),
        rootless: true,
      };
      emit(
        result,
        `Platform doctor: OK\nRegistered devices: ${devices.length}\nDevice check: ${result.deviceCheck}`,
      );
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
