import {
  isTvStoreCatalogResponse,
  type TvStoreCatalogResponse,
} from "../contracts.js";
import { mockTvStoreCatalog } from "../mock.js";

export async function loadCatalog(
  signal?: AbortSignal,
): Promise<TvStoreCatalogResponse> {
  if (import.meta.env.VITE_ZUI_TV_STORE_MOCK !== "0") return mockTvStoreCatalog;
  const base = String(import.meta.env.VITE_ZUI_TV_STORE_API_BASE ?? "");
  if (
    !/^http:\/\/(?:127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d{1,5}$/u.test(
      base,
    )
  )
    throw new Error(
      "TV Store API address is not a configured local-network endpoint.",
    );
  const response = await fetch(
    `${base}/api/tv-store/v1/catalog`,
    signal === undefined ? undefined : { signal },
  );
  if (!response.ok) throw new Error("Catalog service is unavailable.");
  const envelope = (await response.json()) as { ok?: unknown; data?: unknown };
  if (envelope.ok !== true || !isTvStoreCatalogResponse(envelope.data))
    throw new Error("Catalog response is invalid.");
  return envelope.data;
}
