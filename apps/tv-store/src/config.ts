import { isIP } from "node:net";

export const DEFAULT_TV_STORE_API_PORT = 4274;
export interface TvStoreApiConfig {
  readonly host: string;
  readonly port: number;
  readonly mock: boolean;
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_TV_STORE_API_PORT;
  if (!/^\d{1,5}$/u.test(raw))
    throw new Error(
      "ZUI_TV_STORE_API_PORT must be a whole number from 1 to 65535.",
    );
  const value = Number(raw);
  if (value < 1 || value > 65535)
    throw new Error(
      "ZUI_TV_STORE_API_PORT must be a whole number from 1 to 65535.",
    );
  return value;
}

export function loadTvStoreApiConfig(
  env: NodeJS.ProcessEnv = process.env,
): TvStoreApiConfig {
  const mock = env.ZUI_TV_STORE_MOCK === "1";
  const host = env.ZUI_TV_STORE_API_HOST?.trim() ?? (mock ? "127.0.0.1" : "");
  if (host.length === 0)
    throw new Error(
      "ZUI_TV_STORE_API_HOST is required. Set it to this computer's explicit LAN IPv4 address, or use ZUI_TV_STORE_MOCK=1 for loopback-only development.",
    );
  if (host === "0.0.0.0" || host === "::")
    throw new Error(
      "Wildcard TV Store API hosts are forbidden; configure one explicit interface address.",
    );
  if (host !== "127.0.0.1" && isIP(host) !== 4)
    throw new Error("ZUI_TV_STORE_API_HOST must be an explicit IPv4 address.");
  return { host, port: parsePort(env.ZUI_TV_STORE_API_PORT), mock };
}
