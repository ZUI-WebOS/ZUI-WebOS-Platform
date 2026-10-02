import { gzipSync } from "node:zlib";

export interface TarFixtureEntry {
  readonly path: string;
  readonly content?: string | Buffer;
  readonly type?: "file" | "symlink";
}

function field(
  target: Buffer,
  offset: number,
  length: number,
  value: string,
): void {
  target.write(value.slice(0, length), offset, "ascii");
}

function tar(entries: readonly TarFixtureEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content ?? "");
    const header = Buffer.alloc(512);
    field(header, 0, 100, entry.path);
    field(header, 100, 8, "0000644\0");
    field(header, 108, 8, "0000000\0");
    field(header, 116, 8, "0000000\0");
    field(header, 124, 12, `${content.length.toString(8).padStart(11, "0")}\0`);
    field(header, 136, 12, "00000000000\0");
    field(header, 148, 8, "        ");
    field(header, 156, 1, entry.type === "symlink" ? "2" : "0");
    field(header, 257, 6, "ustar\0");
    field(header, 263, 2, "00");
    chunks.push(
      header,
      content,
      Buffer.alloc((512 - (content.length % 512)) % 512),
    );
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

function arMember(name: string, content: Buffer): Buffer {
  const header = Buffer.alloc(60, " ");
  field(header, 0, 16, `${name}/`);
  field(header, 16, 12, "0");
  field(header, 28, 6, "0");
  field(header, 34, 6, "0");
  field(header, 40, 8, "100644");
  field(header, 48, 10, String(content.length));
  field(header, 58, 2, "`\n");
  return Buffer.concat([
    header,
    content,
    content.length % 2 === 0 ? Buffer.alloc(0) : Buffer.from("\n"),
  ]);
}

export function createIpk(entries: readonly TarFixtureEntry[]): Buffer {
  return Buffer.concat([
    Buffer.from("!<arch>\n"),
    arMember("debian-binary", Buffer.from("2.0\n")),
    arMember("control.tar.gz", gzipSync(tar([]))),
    arMember("data.tar.gz", gzipSync(tar(entries))),
  ]);
}

export function manifest(
  overrides: Readonly<Record<string, unknown>> = {},
): string {
  return JSON.stringify({
    id: "com.zui.test",
    title: "ZUI Test",
    version: "1.2.3",
    vendor: "ZUI",
    ...overrides,
  });
}
