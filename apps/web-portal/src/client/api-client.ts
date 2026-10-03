import type { ApiResult } from "../contracts.js";
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const result = (await response.json()) as ApiResult<T>;
  if (!result.ok) {
    const error = new Error(result.error.message) as Error & {
      code: string;
      action: string | null;
    };
    error.code = result.error.code;
    error.action = result.error.action;
    throw error;
  }
  return result.data;
}
export const guardedHeaders = { "X-ZUI-Request": "web-manager" } as const;
