import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { validateDeviceAlias } from "@zui-webos/webos-client";
import type { DeviceAlias } from "@zui-webos/shared-types";
import { isPrivateLanIpv4Address } from "./network-policy.js";

export const DEFAULT_TV_STORE_API_PORT = 4274;
export const DEFAULT_TV_STORE_INSTALL_PORT = 4275;
export interface TvStoreApiConfig {
  readonly host: string;
  readonly port: number;
  readonly mock: boolean;
  readonly deviceAlias: DeviceAlias;
}

export interface TvStoreClientConfig {
  readonly mode: "DEMO" | "LIVE";
  readonly apiBase: string | null;
  readonly installApiBase: string | null;
}

export function parseTvStorePort(
  raw: string | undefined,
  name = "ZUI_TV_STORE_API_PORT",
  defaultPort = DEFAULT_TV_STORE_API_PORT,
): number {
  if (raw === undefined) return defaultPort;
  if (!/^\d{1,5}$/u.test(raw))
    throw new Error(`${name} must be a whole number from 1 to 65535.`);
  const value = Number(raw);
  if (value < 1 || value > 65535)
    throw new Error(`${name} must be a whole number from 1 to 65535.`);
  return value;
}

function assignedLanIpv4Addresses(): readonly string[] {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

export function validatePrivateLanHost(
  host: string,
  localAddresses: readonly string[],
): void {
  if (host === "0.0.0.0" || host === "::")
    throw new Error(
      "Wildcard TV Store API hosts are forbidden; configure one explicit interface address.",
    );
  if (isIP(host) !== 4 || !isPrivateLanIpv4Address(host))
    throw new Error(
      "ZUI_TV_STORE_API_HOST must be an explicit RFC1918 private LAN IPv4 address.",
    );
  if (!localAddresses.includes(host))
    throw new Error(
      `ZUI_TV_STORE_API_HOST '${host}' is not assigned to a local non-loopback IPv4 interface. Choose one explicit address from the current network configuration.`,
    );
}

export function loadTvStoreApiConfig(
  env: NodeJS.ProcessEnv = process.env,
  localAddresses: readonly string[] = assignedLanIpv4Addresses(),
): TvStoreApiConfig {
  const mock = env.ZUI_TV_STORE_MOCK === "1";
  const host = env.ZUI_TV_STORE_API_HOST?.trim() ?? (mock ? "127.0.0.1" : "");
  if (host.length === 0)
    throw new Error(
      "ZUI_TV_STORE_API_HOST is required. Set it to this computer's explicit LAN IPv4 address, or use ZUI_TV_STORE_MOCK=1 for loopback-only development.",
    );
  if (mock) {
    if (host !== "127.0.0.1")
      throw new Error("Mock TV Store API must remain bound to 127.0.0.1.");
  } else validatePrivateLanHost(host, localAddresses);
  return {
    host,
    port: parseTvStorePort(env.ZUI_TV_STORE_API_PORT),
    mock,
    deviceAlias: validateDeviceAlias(
      env.ZUI_TV_STORE_DEVICE_ALIAS?.trim() || "tv",
    ),
  };
}

export function loadTvStoreClientConfig(
  env: NodeJS.ProcessEnv = process.env,
  localAddresses: readonly string[] = assignedLanIpv4Addresses(),
): TvStoreClientConfig {
  const mode = env.ZUI_TV_STORE_MODE?.trim() || "DEMO";
  if (mode !== "DEMO" && mode !== "LIVE")
    throw new Error("ZUI_TV_STORE_MODE must be DEMO or LIVE.");
  if (mode === "DEMO") return { mode, apiBase: null, installApiBase: null };
  const host = env.ZUI_TV_STORE_API_HOST?.trim() ?? "";
  if (host.length === 0)
    throw new Error(
      "ZUI_TV_STORE_API_HOST is required when packaging the LIVE TV Store.",
    );
  validatePrivateLanHost(host, localAddresses);
  const port = parseTvStorePort(env.ZUI_TV_STORE_API_PORT);
  const installPort = parseTvStorePort(
    env.ZUI_TV_STORE_INSTALL_PORT,
    "ZUI_TV_STORE_INSTALL_PORT",
    DEFAULT_TV_STORE_INSTALL_PORT,
  );
  if (installPort === port)
    throw new Error(
      "TV Store read-only and install services must use different ports.",
    );
  return {
    mode,
    apiBase: `http://${host}:${String(port)}`,
    installApiBase: `http://${host}:${String(installPort)}`,
  };
}
