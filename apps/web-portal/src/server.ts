import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { PlatformError } from "@zui-webos/webos-client";
import { WebManagerApi, errorAction } from "./api.js";
import {
  loadWebManagerConfig,
  portInUseMessage,
  type WebManagerConfig,
} from "./config.js";
import type {
  ApiResult,
  CatalogPlanRequest,
  CatalogSelectionRequest,
  PlanRequest,
} from "./contracts.js";

const mock = process.env.ZUI_WEB_MANAGER_MOCK === "1";
const api = new WebManagerApi(mock);
const clientRoot = fileURLToPath(new URL("./client/", import.meta.url));
function configOrExit(): WebManagerConfig {
  try {
    return loadWebManagerConfig();
  } catch (error: unknown) {
    process.stderr.write(
      `ZUI Web Manager configuration error: ${error instanceof Error ? error.message : "Invalid configuration."}\n`,
    );
    process.exit(1);
  }
}
const config = configOrExit();
const { host, port } = config;
const allowedOrigins = new Set([
  `http://${config.host}:${config.port}`,
  `http://localhost:${config.port}`,
]);

function securityHeaders(response: ServerResponse): void {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");
}
function json<T>(
  response: ServerResponse,
  status: number,
  body: ApiResult<T>,
): void {
  securityHeaders(response);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
async function body(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    size += data.length;
    if (size > limit)
      throw new PlatformError(
        "PACKAGE_TOO_LARGE",
        "Request body exceeds the allowed size.",
      );
    chunks.push(data);
  }
  return Buffer.concat(chunks);
}
function permitRequest(request: IncomingMessage): void {
  const hostHeader = request.headers.host;
  if (hostHeader !== `${host}:${port}` && hostHeader !== `localhost:${port}`)
    throw new PlatformError("INVALID_ARGUMENT", "Unexpected Host header.");
  const origin = request.headers.origin;
  if (origin !== undefined && !allowedOrigins.has(origin))
    throw new PlatformError(
      "INVALID_ARGUMENT",
      "Cross-origin requests are forbidden.",
    );
  if (
    request.method === "POST" &&
    request.headers["x-zui-request"] !== "web-manager"
  )
    throw new PlatformError("INVALID_ARGUMENT", "Missing local request guard.");
}
async function route(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  permitRequest(request);
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname === "/api/health") {
    json(response, 200, {
      ok: true,
      data: { mode: mock ? "MOCK" : "REAL", loopback: true },
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    json(response, 200, { ok: true, data: await api.dashboard() });
    return;
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/devices/")) {
    json(response, 200, {
      ok: true,
      data: await api.device(decodeURIComponent(url.pathname.slice(13))),
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/catalog") {
    json(response, 200, { ok: true, data: await api.catalog() });
    return;
  }
  const productMatch = /^\/api\/catalog\/products\/([^/]+)$/u.exec(
    url.pathname,
  );
  if (request.method === "GET" && productMatch !== null) {
    json(response, 200, {
      ok: true,
      data: await api.catalogProduct(decodeURIComponent(productMatch[1]!)),
    });
    return;
  }
  const releaseMatch =
    /^\/api\/catalog\/products\/([^/]+)\/releases\/([^/]+)$/u.exec(
      url.pathname,
    );
  if (request.method === "GET" && releaseMatch !== null) {
    json(response, 200, {
      ok: true,
      data: await api.catalogRelease(
        decodeURIComponent(releaseMatch[1]!),
        decodeURIComponent(releaseMatch[2]!),
      ),
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/cache") {
    json(response, 200, { ok: true, data: await api.cache() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/receipts") {
    json(response, 200, { ok: true, data: await api.receipts() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/plans/latest") {
    json(response, 200, { ok: true, data: api.latestPlan() });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/packages/inspect") {
    const filename = request.headers["x-zui-filename"];
    if (typeof filename !== "string")
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "Package filename is required.",
      );
    json(response, 200, {
      ok: true,
      data: await api.inspectUpload(
        filename,
        await body(request, 512 * 1024 * 1024),
      ),
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/plans") {
    const value = JSON.parse(
      (await body(request, 64 * 1024)).toString("utf8"),
    ) as Partial<PlanRequest>;
    if (
      typeof value.inspectionId !== "string" ||
      typeof value.device !== "string"
    )
      throw new PlatformError("INVALID_ARGUMENT", "Plan request is invalid.");
    json(response, 200, {
      ok: true,
      data: await api.plan({
        inspectionId: value.inspectionId,
        device: value.device,
      }),
    });
    return;
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/catalog/artifacts/fetch"
  ) {
    const value = JSON.parse(
      (await body(request, 64 * 1024)).toString("utf8"),
    ) as Partial<CatalogSelectionRequest> & Record<string, unknown>;
    if (
      typeof value.productId !== "string" ||
      typeof value.releaseId !== "string" ||
      typeof value.artifactId !== "string" ||
      "url" in value ||
      "path" in value ||
      "destination" in value
    )
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "Catalog fetch requires trusted logical identifiers only.",
      );
    json(response, 200, {
      ok: true,
      data: await api.fetchCatalogArtifact({
        productId: value.productId,
        releaseId: value.releaseId,
        artifactId: value.artifactId,
      }),
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/catalog/plans") {
    const value = JSON.parse(
      (await body(request, 64 * 1024)).toString("utf8"),
    ) as Partial<CatalogPlanRequest> & Record<string, unknown>;
    if (
      typeof value.productId !== "string" ||
      typeof value.releaseId !== "string" ||
      typeof value.artifactId !== "string" ||
      typeof value.device !== "string" ||
      "url" in value ||
      "path" in value
    )
      throw new PlatformError(
        "INVALID_ARGUMENT",
        "Catalog plan requires trusted logical identifiers only.",
      );
    json(response, 200, {
      ok: true,
      data: await api.planCatalog({
        productId: value.productId,
        releaseId: value.releaseId,
        artifactId: value.artifactId,
        device: value.device,
      }),
    });
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    json(response, 404, {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "API route not found.",
        action: null,
      },
    });
    return;
  }
  await serveStatic(url.pathname, response);
}
async function serveStatic(
  pathname: string,
  response: ServerResponse,
): Promise<void> {
  const requested =
    pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  let path = resolve(clientRoot, requested);
  if (!path.startsWith(resolve(clientRoot)))
    throw new PlatformError("INVALID_ARGUMENT", "Invalid static path.");
  try {
    if (!(await stat(path)).isFile()) path = join(clientRoot, "index.html");
  } catch {
    path = join(clientRoot, "index.html");
  }
  const mime =
    (
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
      } as Record<string, string>
    )[extname(path)] ?? "application/octet-stream";
  securityHeaders(response);
  response.writeHead(200, { "Content-Type": mime });
  createReadStream(path).pipe(response);
}

const server = createServer((request, response) => {
  void route(request, response).catch((error: unknown) => {
    const code =
      error instanceof PlatformError ? error.code : "UNEXPECTED_ERROR";
    const message =
      error instanceof PlatformError
        ? error.message
        : "The local Web Manager request failed.";
    json(response, error instanceof PlatformError ? 400 : 500, {
      ok: false,
      error: { code, message, action: errorAction(code) },
    });
  });
});
server.on("error", (error: NodeJS.ErrnoException) => {
  const message =
    error.code === "EADDRINUSE"
      ? portInUseMessage(config)
      : `ZUI Web Manager could not start on ${config.host}:${config.port}: ${error.message}`;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
server.listen(config.port, config.host, () => {
  process.stdout.write(
    `ZUI Web Manager (${mock ? "MOCK" : "REAL"}) listening on http://${config.host}:${config.port}\n`,
  );
});
