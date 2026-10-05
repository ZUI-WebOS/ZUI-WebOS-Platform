import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { platformDataRoot } from "@zui-webos/runtime-paths";

function signalPath(): string {
  return join(platformDataRoot(), "tv-store", "catalog-invalidation.txt");
}

export async function readCatalogInvalidationSignal(): Promise<string> {
  try {
    return (await readFile(signalPath(), "utf8")).trim();
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function markTvStoreCatalogStale(now = new Date()): Promise<void> {
  const path = signalPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${now.toISOString()}\n`, "utf8");
}
