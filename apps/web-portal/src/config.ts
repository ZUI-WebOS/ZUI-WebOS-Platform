export const WEB_MANAGER_HOST = "127.0.0.1";
export const DEFAULT_WEB_MANAGER_PORT = 4273;
export const DEFAULT_WEB_MANAGER_DEV_PORT = 4274;

export interface WebManagerConfig {
  readonly host: typeof WEB_MANAGER_HOST;
  readonly port: number;
}

export function parseWebManagerPort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_WEB_MANAGER_PORT;
  if (!/^[0-9]+$/u.test(value))
    throw new Error(
      "ZUI_WEB_MANAGER_PORT must be a whole number between 1 and 65535.",
    );
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
    throw new Error(
      "ZUI_WEB_MANAGER_PORT must be a whole number between 1 and 65535.",
    );
  return port;
}

export function loadWebManagerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): WebManagerConfig {
  return {
    host: WEB_MANAGER_HOST,
    port: parseWebManagerPort(environment.ZUI_WEB_MANAGER_PORT),
  };
}

export function portInUseMessage(config: WebManagerConfig): string {
  return (
    `ZUI Web Manager could not start: ${config.host}:${config.port} is already in use. ` +
    "Stop the process using that port or set ZUI_WEB_MANAGER_PORT to an available port between 1 and 65535."
  );
}
