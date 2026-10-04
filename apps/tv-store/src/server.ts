import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { loadTvStoreApiConfig, type TvStoreApiConfig } from "./config.js";
import { MockTvStoreDataProvider, TvStoreApi } from "./api.js";
import { TV_STORE_API_PREFIX } from "./contracts.js";

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  });
  response.end(JSON.stringify(body));
}

export async function handleTvStoreRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: TvStoreApi,
  mode: "MOCK" | "LIVE" = "MOCK",
): Promise<void> {
  const method = request.method ?? "GET";
  const raw = request.url ?? "/";
  if (raw.length > 512)
    return send(response, 414, {
      ok: false,
      error: { code: "URI_TOO_LONG", message: "Request URI is too long." },
    });
  if (method === "OPTIONS") return send(response, 204, null);
  if (method !== "GET" && method !== "HEAD")
    return send(response, 405, {
      ok: false,
      error: { code: "READ_ONLY_API", message: "TV Store API is read-only." },
    });
  const url = new URL(raw, "http://tv-store.local");
  if ([...url.searchParams.keys()].length > 0)
    return send(response, 400, {
      ok: false,
      error: {
        code: "QUERY_NOT_ALLOWED",
        message: "Query parameters are not accepted.",
      },
    });
  try {
    let data: unknown;
    if (url.pathname === `${TV_STORE_API_PREFIX}/health`)
      data = { apiVersion: 1, ok: true, mode };
    else if (url.pathname === `${TV_STORE_API_PREFIX}/catalog`)
      data = await service.catalog();
    else if (url.pathname.startsWith(`${TV_STORE_API_PREFIX}/products/`)) {
      const id = decodeURIComponent(
        url.pathname.slice(`${TV_STORE_API_PREFIX}/products/`.length),
      );
      data = await service.product(id);
    } else
      return send(response, 404, {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Read-only TV Store resource not found.",
        },
      });
    if (method === "HEAD") return send(response, 200, null);
    return send(response, 200, { ok: true, data });
  } catch (error) {
    const value = error as Error & { code?: string; status?: number };
    return send(response, value.status ?? 500, {
      ok: false,
      error: {
        code: value.code ?? "CATALOG_UNAVAILABLE",
        message:
          value.status === undefined
            ? "Catalog is temporarily unavailable."
            : value.message,
      },
    });
  }
}

export function createTvStoreServer(config: TvStoreApiConfig) {
  if (!config.mock)
    throw new Error(
      "LIVE TV Store catalog provider is not configured; start with ZUI_TV_STORE_MOCK=1 for this MVP.",
    );
  const api = new TvStoreApi(new MockTvStoreDataProvider());
  const server = createServer((request, response) => {
    void handleTvStoreRequest(request, response, api, "MOCK");
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `TV Store API cannot start because ${config.host}:${String(config.port)} is occupied. Stop the other service or set ZUI_TV_STORE_API_PORT.`,
      );
      process.exitCode = 1;
    } else throw error;
  });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  const config = loadTvStoreApiConfig();
  const server = createTvStoreServer(config);
  server.listen(config.port, config.host, () =>
    console.log(
      `ZUI TV Store read-only API: http://${config.host}:${String(config.port)}${TV_STORE_API_PREFIX}`,
    ),
  );
}
