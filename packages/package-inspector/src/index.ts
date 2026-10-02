import { createReadStream } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import { gunzipSync } from "node:zlib";

import { PlatformError } from "@zui-webos/webos-client";

export interface PackageSecurityLimits {
  readonly maxIpkBytes: number;
  readonly maxArchiveEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalUnpackedBytes: number;
}

export const DEFAULT_PACKAGE_LIMITS: PackageSecurityLimits = {
  maxIpkBytes: 512 * 1024 * 1024,
  maxArchiveEntries: 20_000,
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalUnpackedBytes: 256 * 1024 * 1024,
};

export interface PackageHash {
  readonly algorithm: "sha256";
  readonly digest: string;
  readonly size: number;
}

export interface AppManifest {
  readonly archivePath: string;
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly vendor?: string;
  readonly main?: string;
  readonly type?: string;
  readonly icon?: string;
  readonly largeIcon?: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface PackageInspection {
  readonly filename: string;
  readonly path: string;
  readonly size: number;
  readonly hash: PackageHash;
  readonly format: "debian-ar+tar.gz";
  readonly archiveEntries: number;
  readonly unpackedBytes: number;
  readonly manifests: readonly AppManifest[];
}

interface TarResult {
  readonly manifests: AppManifest[];
  readonly entries: number;
  readonly unpackedBytes: number;
}

function textField(buffer: Buffer, start: number, length: number): string {
  return (
    buffer
      .subarray(start, start + length)
      .toString("utf8")
      .split("\0", 1)[0]
      ?.trim() ?? ""
  );
}

function safeArchivePath(raw: string): string {
  const path = raw.replace(/^\.\//u, "").replace(/\/$/u, "");
  if (
    path.length === 0 ||
    path.includes("\uFFFD") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    /^[A-Za-z]:/u.test(path) ||
    path.split("/").some((part) => part === ".." || part.length === 0)
  ) {
    throw new PlatformError(
      "UNSAFE_ARCHIVE_ENTRY",
      `Unsafe archive path '${raw}'.`,
    );
  }
  return path;
}

function parseManifest(path: string, data: Buffer): AppManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(data.toString("utf8"));
  } catch {
    throw new PlatformError(
      "PACKAGE_METADATA_INVALID",
      `Malformed JSON in '${path}'.`,
    );
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new PlatformError(
      "PACKAGE_METADATA_INVALID",
      `Manifest '${path}' is not an object.`,
    );
  }
  const value = raw as Record<string, unknown>;
  for (const field of ["id", "title", "version"] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new PlatformError(
        "PACKAGE_METADATA_INVALID",
        `Manifest '${path}' lacks '${field}'.`,
      );
    }
  }
  const optional = (field: string): string | undefined =>
    typeof value[field] === "string" ? value[field] : undefined;
  const vendor = optional("vendor");
  const main = optional("main");
  const type = optional("type");
  const icon = optional("icon");
  const largeIcon = optional("largeIcon");
  return {
    archivePath: path,
    id: value.id as string,
    title: value.title as string,
    version: value.version as string,
    ...(vendor === undefined ? {} : { vendor }),
    ...(main === undefined ? {} : { main }),
    ...(type === undefined ? {} : { type }),
    ...(icon === undefined ? {} : { icon }),
    ...(largeIcon === undefined ? {} : { largeIcon }),
    raw: value,
  };
}

function parseTar(data: Buffer, limits: PackageSecurityLimits): TarResult {
  const manifests: AppManifest[] = [];
  const paths = new Set<string>();
  let offset = 0;
  let entries = 0;
  let unpackedBytes = 0;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    entries += 1;
    if (entries > limits.maxArchiveEntries) {
      throw new PlatformError(
        "ARCHIVE_LIMIT_EXCEEDED",
        "Tar entry-count limit exceeded.",
      );
    }
    const rawName = textField(header, 0, 100);
    const prefix = textField(header, 345, 155);
    const path = safeArchivePath(prefix ? `${prefix}/${rawName}` : rawName);
    const key = path.toLocaleLowerCase("en-US");
    if (paths.has(key)) {
      throw new PlatformError(
        "UNSAFE_ARCHIVE_ENTRY",
        `Duplicate archive path '${path}'.`,
      );
    }
    paths.add(key);
    const sizeText = textField(header, 124, 12).replace(/\s/gu, "");
    if (!/^[0-7]+$/u.test(sizeText)) {
      throw new PlatformError(
        "INVALID_PACKAGE",
        `Invalid tar size for '${path}'.`,
      );
    }
    const size = Number.parseInt(sizeText, 8);
    if (size > limits.maxEntryBytes) {
      throw new PlatformError(
        "ARCHIVE_LIMIT_EXCEEDED",
        `Entry '${path}' exceeds the size limit.`,
      );
    }
    unpackedBytes += size;
    if (unpackedBytes > limits.maxTotalUnpackedBytes) {
      throw new PlatformError(
        "ARCHIVE_LIMIT_EXCEEDED",
        "Total unpacked-size limit exceeded.",
      );
    }
    const type = String.fromCharCode(header[156] ?? 0);
    if (type === "1" || type === "2") {
      throw new PlatformError(
        "UNSAFE_ARCHIVE_ENTRY",
        `Links are not allowed: '${path}'.`,
      );
    }
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > data.length) {
      throw new PlatformError(
        "INVALID_PACKAGE",
        `Truncated tar entry '${path}'.`,
      );
    }
    if ((type === "0" || type === "\0") && /(^|\/)appinfo\.json$/u.test(path)) {
      manifests.push(
        parseManifest(path, data.subarray(contentStart, contentEnd)),
      );
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  if (manifests.length === 0) {
    throw new PlatformError(
      "PACKAGE_METADATA_INVALID",
      "Package contains no appinfo.json manifest.",
    );
  }
  return { manifests, entries, unpackedBytes };
}

async function streamHash(path: string, size: number): Promise<PackageHash> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return {
    algorithm: "sha256",
    digest: hash.digest("hex").toUpperCase(),
    size,
  };
}

export async function inspectIpk(
  path: string,
  limits: PackageSecurityLimits = DEFAULT_PACKAGE_LIMITS,
): Promise<PackageInspection> {
  let info;
  try {
    info = await lstat(path);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PlatformError(
        "PACKAGE_NOT_FOUND",
        `Package '${path}' does not exist.`,
      );
    }
    throw error;
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new PlatformError(
      "PACKAGE_NOT_FILE",
      `Package '${path}' is not a normal file.`,
    );
  }
  if (extname(path).toLowerCase() !== ".ipk") {
    throw new PlatformError(
      "UNSUPPORTED_PACKAGE_FORMAT",
      "Expected a .ipk file.",
    );
  }
  if (info.size > limits.maxIpkBytes) {
    throw new PlatformError(
      "PACKAGE_TOO_LARGE",
      "IPK exceeds the configured size limit.",
    );
  }

  const canonicalPath = await realpath(path);

  const hash = await streamHash(canonicalPath, info.size);
  const handle = await open(canonicalPath, "r");
  try {
    const magic = Buffer.alloc(8);
    if (
      (await handle.read(magic, 0, 8, 0)).bytesRead !== 8 ||
      magic.toString() !== "!<arch>\n"
    ) {
      throw new PlatformError(
        "INVALID_PACKAGE",
        "IPK is not a valid ar archive.",
      );
    }
    let offset = 8;
    let arEntries = 0;
    let tarResult: TarResult | null = null;
    let validDebianBinary = false;
    let hasControlArchive = false;
    const arNames = new Set<string>();
    while (offset + 60 <= info.size) {
      const header = Buffer.alloc(60);
      if ((await handle.read(header, 0, 60, offset)).bytesRead !== 60) {
        throw new PlatformError("INVALID_PACKAGE", "Truncated ar header.");
      }
      if (header.subarray(58, 60).toString() !== "`\n") {
        throw new PlatformError("INVALID_PACKAGE", "Invalid ar member header.");
      }
      const name = header
        .subarray(0, 16)
        .toString("ascii")
        .trim()
        .replace(/\/$/u, "");
      const sizeText = header.subarray(48, 58).toString("ascii").trim();
      if (!/^\d+$/u.test(sizeText))
        throw new PlatformError("INVALID_PACKAGE", "Invalid ar size.");
      const size = Number.parseInt(sizeText, 10);
      arEntries += 1;
      if (arEntries > limits.maxArchiveEntries || size > limits.maxEntryBytes) {
        throw new PlatformError(
          "ARCHIVE_LIMIT_EXCEEDED",
          "IPK member limit exceeded.",
        );
      }
      if (arNames.has(name))
        throw new PlatformError(
          "UNSAFE_ARCHIVE_ENTRY",
          `Duplicate IPK member '${name}'.`,
        );
      arNames.add(name);
      const contentOffset = offset + 60;
      if (contentOffset + size > info.size)
        throw new PlatformError("INVALID_PACKAGE", "Truncated ar member.");
      if (name === "data.tar.gz") {
        const compressed = Buffer.alloc(size);
        if (
          (await handle.read(compressed, 0, size, contentOffset)).bytesRead !==
          size
        ) {
          throw new PlatformError("INVALID_PACKAGE", "Truncated data.tar.gz.");
        }
        let unpacked: Buffer;
        try {
          unpacked = gunzipSync(compressed, {
            maxOutputLength: limits.maxTotalUnpackedBytes,
          });
        } catch {
          throw new PlatformError(
            "INVALID_PACKAGE",
            "Unable to safely decompress data.tar.gz.",
          );
        }
        tarResult = parseTar(unpacked, limits);
      } else if (name === "debian-binary") {
        const marker = Buffer.alloc(size);
        if (
          (await handle.read(marker, 0, size, contentOffset)).bytesRead !== size
        ) {
          throw new PlatformError(
            "INVALID_PACKAGE",
            "Truncated debian-binary marker.",
          );
        }
        validDebianBinary = marker.toString("ascii") === "2.0\n";
      } else if (name === "control.tar.gz") {
        hasControlArchive = true;
      } else if (name.startsWith("data.tar.")) {
        throw new PlatformError(
          "UNSUPPORTED_PACKAGE_FORMAT",
          `Unsupported payload '${name}'.`,
        );
      }
      offset = contentOffset + size + (size % 2);
    }
    if (!validDebianBinary || !hasControlArchive) {
      throw new PlatformError(
        "INVALID_PACKAGE",
        "IPK lacks the required Debian package members.",
      );
    }
    if (tarResult === null)
      throw new PlatformError(
        "INVALID_PACKAGE",
        "IPK has no data.tar.gz payload.",
      );
    return {
      filename: basename(canonicalPath),
      path: canonicalPath,
      size: info.size,
      hash,
      format: "debian-ar+tar.gz",
      archiveEntries: arEntries + tarResult.entries,
      unpackedBytes: tarResult.unpackedBytes,
      manifests: tarResult.manifests,
    };
  } finally {
    await handle.close();
  }
}
