import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

/**
 * Runtime data must be visible to both packaged and ordinary desktop
 * processes. Windows may virtualize LOCALAPPDATA for packaged applications,
 * so it is deliberately not a default data root.
 */
export function platformDataRoot(
  env: NodeJS.ProcessEnv = process.env,
  userHome = homedir(),
): string {
  const configured = env.ZUI_WEBOS_DATA_DIR?.trim();
  if (configured !== undefined && configured.length > 0) {
    if (!isAbsolute(configured))
      throw new Error("ZUI_WEBOS_DATA_DIR must be an absolute path.");
    return resolve(configured);
  }
  return join(userHome, ".zui-webos");
}

export function artifactCacheRoot(
  env: NodeJS.ProcessEnv = process.env,
  userHome = homedir(),
): string {
  return join(platformDataRoot(env, userHome), "artifacts", "sha256");
}

export function stagingReleaseRoot(
  env: NodeJS.ProcessEnv = process.env,
  userHome = homedir(),
): string {
  return join(platformDataRoot(env, userHome), "releases", "staging");
}

export function stagingInputRoot(
  env: NodeJS.ProcessEnv = process.env,
  userHome = homedir(),
): string {
  return join(platformDataRoot(env, userHome), "release-inputs", "sha256");
}
