import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { loadTvStoreApiConfig, type TvStoreApiConfig } from "./config.js";
import { MockTvStoreDataProvider, TvStoreApi } from "./api.js";
import { TV_STORE_API_PREFIX } from "./contracts.js";
import { LiveTvStoreDataProvider } from "./live.js";

function send(
  response: ServerResponse,
  status: number,
  body: unknown,
  corsOrigin?: "null",
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(corsOrigin === undefined
      ? {}
      : {
          "Access-Control-Allow-Origin": corsOrigin,
          Vary: "Origin",
        }),
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
  const origin = request.headers.origin;
  if (origin !== undefined && origin !== "null")
    return send(response, 403, {
      ok: false,
      error: {
        code: "ORIGIN_NOT_ALLOWED",
        message: "The request origin is not allowed.",
      },
    });
  const corsOrigin = origin === "null" ? "null" : undefined;
  if (raw.length > 512)
    return send(
      response,
      414,
      {
        ok: false,
        error: { code: "URI_TOO_LONG", message: "Request URI is too long." },
      },
      corsOrigin,
    );
  if (method === "OPTIONS") return send(response, 204, null, corsOrigin);
  if (method !== "GET" && method !== "HEAD")
    return send(
      response,
      405,
      {
        ok: false,
        error: { code: "READ_ONLY_API", message: "TV Store API is read-only." },
      },
      corsOrigin,
    );
  const url = new URL(raw, "http://tv-store.local");
  if ([...url.searchParams.keys()].length > 0)
    return send(
      response,
      400,
      {
        ok: false,
        error: {
          code: "QUERY_NOT_ALLOWED",
          message: "Query parameters are not accepted.",
        },
      },
      corsOrigin,
    );
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
      return send(
        response,
        404,
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Read-only TV Store resource not found.",
          },
        },
        corsOrigin,
      );
    if (method === "HEAD") return send(response, 200, null, corsOrigin);
    return send(response, 200, { ok: true, data }, corsOrigin);
  } catch (error) {
    const value = error as Error & { code?: string; status?: number };
    return send(
      response,
      value.status ?? 500,
      {
        ok: false,
        error: {
          code: value.code ?? "CATALOG_UNAVAILABLE",
          message:
            value.status === undefined
              ? "Catalog is temporarily unavailable."
              : value.message,
        },
      },
      corsOrigin,
    );
  }
}

export function createTvStoreServer(
  config: TvStoreApiConfig,
  provider = config.mock
    ? new MockTvStoreDataProvider()
    : new LiveTvStoreDataProvider(config.deviceAlias),
) {
  const api = new TvStoreApi(provider);
  const server = createServer((request, response) => {
    void handleTvStoreRequest(
      request,
      response,
      api,
      config.mock ? "MOCK" : "LIVE",
    );
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
  const provider = config.mock
    ? new MockTvStoreDataProvider()
    : new LiveTvStoreDataProvider(config.deviceAlias);
  try {
    if (!config.mock) await provider.catalog();
    const server = createTvStoreServer(config, provider);
    server.listen(config.port, config.host, () =>
      console.log(
        `ZUI TV Store read-only API: http://${config.host}:${String(config.port)}${TV_STORE_API_PREFIX}`,
      ),
    );
  } catch (error) {
    const code = (error as { code?: string }).code ?? "CATALOG_UNAVAILABLE";
    console.error(
      `TV Store LIVE API startup failed (${code}). Verify device '${config.deviceAlias}' is reachable and inventory can be read, then retry.`,
    );
    process.exitCode = 1;
  }
}
