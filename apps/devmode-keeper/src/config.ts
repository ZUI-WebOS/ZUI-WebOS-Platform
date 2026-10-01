import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { DeviceAlias } from "@zui-webos/shared-types";
import { PlatformError, validateDeviceAlias } from "@zui-webos/webos-client";

export interface KeeperConfig {
  readonly device: DeviceAlias;
  readonly timeoutMs: number;
  readonly thresholdHours: number;
}

export interface ConfigOverrides {
  readonly device?: string;
  readonly timeoutMs?: number;
  readonly thresholdHours?: number;
}

interface ConfigFile {
  readonly device?: string;
  readonly timeoutMs?: number;
  readonly thresholdHours?: number;
}

const defaults = {
  device: "tv",
  timeoutMs: 30_000,
  thresholdHours: 24,
} as const;

function positiveNumber(
  value: unknown,
  fallback: number,
  name: string,
): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PlatformError(
      "INVALID_ARGUMENT",
      `${name} must be a positive number.`,
    );
  }
  return parsed;
}

async function readUserConfig(path: string): Promise<ConfigFile> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as ConfigFile;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new PlatformError(
      "INVALID_ARGUMENT",
      `Unable to read local config at '${path}'.`,
    );
  }
}

export function defaultConfigPath(env: NodeJS.ProcessEnv): string {
  const base = env.LOCALAPPDATA ?? env.XDG_CONFIG_HOME;
  if (base === undefined) return join(process.cwd(), "config.local.json");
  return join(base, "ZUI WebOS Platform", "config.json");
}

export async function loadConfig(
  overrides: ConfigOverrides,
  env: NodeJS.ProcessEnv = process.env,
): Promise<KeeperConfig> {
  const file = await readUserConfig(
    env.ZUI_WEBOS_CONFIG ?? defaultConfigPath(env),
  );
  const device =
    overrides.device ?? env.ZUI_WEBOS_DEVICE ?? file.device ?? defaults.device;
  const timeoutMs = positiveNumber(
    overrides.timeoutMs ?? env.ZUI_WEBOS_TIMEOUT_MS ?? file.timeoutMs,
    defaults.timeoutMs,
    "timeoutMs",
  );
  const thresholdHours = positiveNumber(
    overrides.thresholdHours ??
      env.ZUI_DEVMODE_RENEW_THRESHOLD_HOURS ??
      file.thresholdHours,
    defaults.thresholdHours,
    "thresholdHours",
  );

  return { device: validateDeviceAlias(device), timeoutMs, thresholdHours };
}
