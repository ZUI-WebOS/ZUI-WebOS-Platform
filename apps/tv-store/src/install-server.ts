import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  loadTvStoreInstallConfig,
  type TvStoreInstallConfig,
} from "./install-config.js";
import {
  isInstallSelection,
  TV_STORE_INSTALL_API_PREFIX,
} from "./install-contracts.js";
import {
  generatePairingCode,
  InstallServiceError,
  StagingInstallCoordinator,
} from "./install.js";

const MAX_BODY_BYTES = 4096;

function json(
  response: ServerResponse,
  status: number,
  body: unknown,
  requestId: string,
  corsOrigin?: "null",
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Request-Id": requestId,
    ...(corsOrigin === undefined
      ? {}
      : {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          Vary: "Origin",
        }),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<unknown> {
  if (
    !/^application\/json(?:;|$)/iu.test(request.headers["content-type"] ?? "")
  )
    throw new InstallServiceError(
      "CONTENT_TYPE_REQUIRED",
      "Content-Type must be application/json.",
      415,
    );
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > MAX_BODY_BYTES)
      throw new InstallServiceError(
        "REQUEST_TOO_LARGE",
        "The request body is too large.",
        413,
      );
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new InstallServiceError(
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }
}

function emptyObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function bearer(request: IncomingMessage): string {
  const authorization = request.headers.authorization ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{40,128})$/u.exec(authorization);
  if (match?.[1] === undefined)
    throw new InstallServiceError(
      "SESSION_INVALID",
      "A valid install session is required.",
      401,
    );
  return match[1];
}

function intentPath(pathname: string): {
  readonly id: string;
  readonly action: "status" | "approve" | "cancel";
} | null {
  const escaped = TV_STORE_INSTALL_API_PREFIX.replaceAll("/", "\\/");
  const match = new RegExp(
    `^${escaped}/intents/([A-Za-z0-9-]{8,64})/(status|approve|cancel)$`,
    "u",
  ).exec(pathname);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  return {
    id: match[1],
    action: match[2] as "status" | "approve" | "cancel",
  };
}

function publicError(error: unknown): {
  readonly status: number;
  readonly code: string;
  readonly message: string;
} {
  if (error instanceof InstallServiceError)
    return { status: error.status, code: error.code, message: error.message };
  const code =
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "INSTALL_SERVICE_ERROR";
  const messages: Record<string, string> = {
    DEVICE_UNREACHABLE: "The target TV is unreachable.",
    DEVICE_INVENTORY_FAILED: "The TV inventory could not be read.",
    COMMAND_TIMEOUT: "The TV operation timed out.",
    SIGNATURE_INVALID: "The staging release signature is invalid.",
    CACHE_VERIFICATION_FAILED: "The verified artifact cache is invalid.",
    DISTRIBUTION_FAILED: "The trusted artifact could not be obtained.",
    PLAN_EXPIRED: "The installation plan expired. Review again.",
    PLAN_STALE: "The installation plan changed. Review again.",
    INSTALL_POLICY_BLOCKED: "Installation policy blocked this operation.",
    INSTALL_FAILED: "The TV rejected the installation command.",
    INSTALL_VERIFICATION_FAILED: "Installation could not be verified.",
  };
  return {
    status: 409,
    code,
    message: messages[code] ?? "The staging installation could not continue.",
  };
}

export async function handleTvStoreInstallRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: StagingInstallCoordinator,
  log: (event: Record<string, unknown>) => void = () => undefined,
): Promise<void> {
  const requestId = randomUUID();
  const origin = request.headers.origin;
  if (origin !== undefined && origin !== "null")
    return json(
      response,
      403,
      {
        ok: false,
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "The request origin is not allowed.",
        },
      },
      requestId,
    );
  const corsOrigin = origin === "null" ? "null" : undefined;
  const method = request.method ?? "GET";
  const raw = request.url ?? "/";
  if (raw.length > 512)
    return json(
      response,
      414,
      { ok: false, error: { code: "URI_TOO_LONG", message: "URI too long." } },
      requestId,
      corsOrigin,
    );
  if (method === "OPTIONS")
    return json(response, 204, null, requestId, corsOrigin);
  if (method !== "GET" && method !== "POST")
    return json(
      response,
      405,
      {
        ok: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only the narrow install contract methods are allowed.",
        },
      },
      requestId,
      corsOrigin,
    );
  const url = new URL(raw, "http://tv-store-install.local");
  if ([...url.searchParams.keys()].length > 0)
    return json(
      response,
      400,
      {
        ok: false,
        error: {
          code: "QUERY_NOT_ALLOWED",
          message: "Query parameters are not accepted.",
        },
      },
      requestId,
      corsOrigin,
    );
  try {
    let data: unknown;
    if (
      method === "GET" &&
      url.pathname === `${TV_STORE_INSTALL_API_PREFIX}/health`
    )
      data = service.health();
    else if (
      method === "POST" &&
      url.pathname === `${TV_STORE_INSTALL_API_PREFIX}/pair`
    ) {
      const value = (await body(request)) as { code?: unknown };
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        Object.keys(value).length !== 1 ||
        !("code" in value)
      )
        throw new InstallServiceError(
          "INVALID_PAIRING_REQUEST",
          "The pairing request is invalid.",
        );
      data = service.pair(typeof value.code === "string" ? value.code : "");
    } else if (
      method === "POST" &&
      url.pathname === `${TV_STORE_INSTALL_API_PREFIX}/intents`
    ) {
      const value = await body(request);
      if (!isInstallSelection(value))
        throw new InstallServiceError(
          "INVALID_SELECTION",
          "Only logical product, release, and artifact identifiers are accepted.",
        );
      data = await service.createIntent(bearer(request), value);
    } else {
      const route = intentPath(url.pathname);
      if (route === null)
        return json(
          response,
          404,
          {
            ok: false,
            error: {
              code: "NOT_FOUND",
              message: "Install service resource not found.",
            },
          },
          requestId,
          corsOrigin,
        );
      if (method === "GET" && route.action === "status")
        data = service.status(bearer(request), route.id);
      else if (method === "POST" && route.action === "cancel") {
        if (!emptyObject(await body(request)))
          throw new InstallServiceError(
            "INVALID_REQUEST",
            "Cancel accepts no client-controlled installation data.",
          );
        data = service.cancel(bearer(request), route.id);
      } else if (method === "POST" && route.action === "approve") {
        if (!emptyObject(await body(request)))
          throw new InstallServiceError(
            "INVALID_REQUEST",
            "Approval accepts no client-controlled installation data.",
          );
        data = service.approve(bearer(request), route.id);
      } else
        return json(
          response,
          405,
          {
            ok: false,
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "The method is not allowed for this resource.",
            },
          },
          requestId,
          corsOrigin,
        );
    }
    log({ requestId, method, path: url.pathname, result: "OK" });
    return json(response, 200, { ok: true, data }, requestId, corsOrigin);
  } catch (error: unknown) {
    const safe = publicError(error);
    log({
      requestId,
      method,
      path: url.pathname,
      result: safe.code,
    });
    return json(
      response,
      safe.status,
      {
        ok: false,
        error: { code: safe.code, message: safe.message },
      },
      requestId,
      corsOrigin,
    );
  }
}

export function createTvStoreInstallServer(
  config: TvStoreInstallConfig,
  service: StagingInstallCoordinator,
) {
  const server = createServer((request, response) => {
    void handleTvStoreInstallRequest(request, response, service, (event) =>
      console.log(JSON.stringify(event)),
    );
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `TV Store install service cannot start because ${config.host}:${String(config.port)} is occupied. Stop the other service or set ZUI_TV_STORE_INSTALL_PORT.`,
      );
      process.exitCode = 1;
    } else throw error;
  });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  try {
    const config = loadTvStoreInstallConfig();
    const pairingCode = generatePairingCode();
    const service = new StagingInstallCoordinator(config, pairingCode);
    const server = createTvStoreInstallServer(config, service);
    server.listen(config.port, config.host, () => {
      console.log("ZUI TV Store staging install service ARMED");
      console.log(`Device: ${config.deviceAlias}`);
      console.log(`Bind: http://${config.host}:${String(config.port)}`);
      console.log(
        "Policy: STAGING ONLY; production and Store self-update blocked",
      );
      console.log(`Expires: ${config.expiresAt}`);
      console.log(`Pairing code: ${pairingCode}`);
      console.log(`Pairing expires: ${config.pairingExpiresAt}`);
    });
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : "Startup failed.");
    process.exitCode = 1;
  }
}
