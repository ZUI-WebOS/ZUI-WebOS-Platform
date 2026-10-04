import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const output = resolve(appRoot, "dist", "webos");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(appRoot, "dist", "client"), output, { recursive: true });
await cp(resolve(appRoot, "webos"), output, { recursive: true });
const metadata = JSON.parse(
  await readFile(resolve(output, "appinfo.json"), "utf8"),
);
if (
  metadata.id !== "com.zui.webos.store.staging" ||
  metadata.title !== "ZUI Store STAGING" ||
  metadata.main !== "index.html"
) {
  throw new Error("TV Store staging package identity is invalid.");
}
process.stdout.write(
  `Staged ${metadata.id}@${metadata.version} for webOS packaging.\n`,
);
