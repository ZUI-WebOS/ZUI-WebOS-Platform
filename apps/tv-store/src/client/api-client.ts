import {
  isTvStoreCatalogResponse,
  type TvStoreCatalogResponse,
} from "../contracts.js";
import { mockTvStoreCatalog } from "../mock.js";
import { isPrivateLanIpv4Address } from "../network-policy.js";
import type {
  InstallSelection,
  PairResponse,
  PublicInstallIntent,
  PublicInstallStatus,
} from "../install-contracts.js";

declare const __ZUI_TV_STORE_CLIENT_CONFIG__: {
  readonly mode: "DEMO" | "LIVE";
  readonly apiBase: string | null;
  readonly installApiBase: string | null;
};

const REQUEST_TIMEOUT_MS = 6_000;

export function validateLiveApiBase(value: string | null): string {
  if (value === null) throw new Error("LIVE TV Store API address is missing.");
  const match =
    /^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/u.exec(
      value,
    );
  if (match === null) throw new Error("TV Store API address is invalid.");
  const port = Number(match[5]);
  if (
    !isPrivateLanIpv4Address(match.slice(1, 5).join(".")) ||
    port < 1 ||
    port > 65_535
  )
    throw new Error("TV Store API address is not a configured LAN endpoint.");
  return value;
}

export async function loadCatalog(
  signal?: AbortSignal,
): Promise<TvStoreCatalogResponse> {
  if (__ZUI_TV_STORE_CLIENT_CONFIG__.mode === "DEMO") return mockTvStoreCatalog;
  return loadLiveCatalog(__ZUI_TV_STORE_CLIENT_CONFIG__.apiBase, signal);
}

export async function loadLiveCatalog(
  configuredBase: string | null,
  signal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<TvStoreCatalogResponse> {
  const base = validateLiveApiBase(configuredBase);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(`${base}/api/tv-store/v1/catalog`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Catalog service is unavailable.");
    const envelope = (await response.json()) as {
      ok?: unknown;
      data?: unknown;
    };
    if (envelope.ok !== true || !isTvStoreCatalogResponse(envelope.data))
      throw new Error("Catalog response is invalid.");
    if (envelope.data.mode !== "LIVE")
      throw new Error("LIVE TV Store received a non-live catalog response.");
    return envelope.data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

interface ApiEnvelope<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: { readonly code?: string; readonly message?: string };
}

async function installRequest<T>(
  path: string,
  options: {
    readonly method?: "GET" | "POST";
    readonly token?: string;
    readonly body?: unknown;
    readonly timeoutMs?: number;
  } = {},
): Promise<T> {
  const base = validateLiveApiBase(
    __ZUI_TV_STORE_CLIENT_CONFIG__.installApiBase,
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(`${base}/api/tv-store-install/v1${path}`, {
      method: options.method ?? "GET",
      signal: controller.signal,
      headers: {
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.token === undefined
          ? {}
          : { Authorization: `Bearer ${options.token}` }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || envelope.ok !== true || envelope.data === undefined)
      throw Object.assign(
        new Error(envelope.error?.message ?? "Install service request failed."),
        { code: envelope.error?.code ?? "INSTALL_SERVICE_ERROR" },
      );
    return envelope.data;
  } finally {
    clearTimeout(timeout);
  }
}

export function pairInstallService(code: string): Promise<PairResponse> {
  return installRequest<PairResponse>("/pair", {
    method: "POST",
    body: { code },
  });
}

export function createInstallIntent(
  token: string,
  selection: InstallSelection,
): Promise<PublicInstallIntent> {
  return installRequest<PublicInstallIntent>("/intents", {
    method: "POST",
    token,
    body: selection,
  });
}

export function cancelInstallIntent(
  token: string,
  intentId: string,
): Promise<PublicInstallStatus> {
  return installRequest<PublicInstallStatus>(`/intents/${intentId}/cancel`, {
    method: "POST",
    token,
    body: {},
  });
}

export function approveInstallIntent(
  token: string,
  intentId: string,
): Promise<PublicInstallStatus> {
  return installRequest<PublicInstallStatus>(`/intents/${intentId}/approve`, {
    method: "POST",
    token,
    body: {},
  });
}

export function loadInstallStatus(
  token: string,
  intentId: string,
): Promise<PublicInstallStatus> {
  return installRequest<PublicInstallStatus>(`/intents/${intentId}/status`, {
    token,
  });
}
