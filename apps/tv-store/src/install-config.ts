import { networkInterfaces } from "node:os";
import type { DeviceAlias } from "@zui-webos/shared-types";
import { validateDeviceAlias } from "@zui-webos/webos-client";
import {
  DEFAULT_TV_STORE_INSTALL_PORT,
  validatePrivateLanHost,
} from "./config.js";

export { DEFAULT_TV_STORE_INSTALL_PORT } from "./config.js";
export const INSTALL_ARM_TTL_MS = 10 * 60 * 1000;
export const PAIRING_TTL_MS = 3 * 60 * 1000;

export interface TvStoreInstallConfig {
  readonly host: string;
  readonly port: number;
  readonly deviceAlias: DeviceAlias;
  readonly armedAt: string;
  readonly expiresAt: string;
  readonly pairingExpiresAt: string;
}

function localAddresses(): readonly string[] {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_TV_STORE_INSTALL_PORT;
  if (!/^\d{1,5}$/u.test(raw))
    throw new Error(
      "ZUI_TV_STORE_INSTALL_PORT must be a whole number from 1 to 65535.",
    );
  const value = Number(raw);
  if (value < 1 || value > 65_535)
    throw new Error(
      "ZUI_TV_STORE_INSTALL_PORT must be a whole number from 1 to 65535.",
    );
  return value;
}

function explicitDevice(args: readonly string[]): DeviceAlias {
  if (args.length !== 2 || args[0] !== "--device" || args[1] === undefined)
    throw new Error(
      "Install service requires exactly '--device <alias>'; the target is never inferred.",
    );
  return validateDeviceAlias(args[1]);
}

export function loadTvStoreInstallConfig(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = process.argv.slice(2),
  assignedAddresses: readonly string[] = localAddresses(),
  now: Date = new Date(),
): TvStoreInstallConfig {
  const host = env.ZUI_TV_STORE_INSTALL_HOST?.trim() ?? "";
  if (host.length === 0)
    throw new Error(
      "ZUI_TV_STORE_INSTALL_HOST is required and must name one explicit private LAN interface.",
    );
  validatePrivateLanHost(host, assignedAddresses);
  const armedAt = now.toISOString();
  return {
    host,
    port: parsePort(env.ZUI_TV_STORE_INSTALL_PORT),
    deviceAlias: explicitDevice(args),
    armedAt,
    expiresAt: new Date(now.getTime() + INSTALL_ARM_TTL_MS).toISOString(),
    pairingExpiresAt: new Date(now.getTime() + PAIRING_TTL_MS).toISOString(),
  };
}
