import { createApiClient } from "@orya/shared";
import { supabase } from "./supabase";
import { getActiveSession } from "./session";
import { getMobileEnv } from "./env";

const baseApi = createApiClient({
  baseUrl: getMobileEnv().apiBaseUrl,
  getAccessToken: async () => {
    const session = await getActiveSession();
    return session?.access_token ?? null;
  },
});

const isUnauthorizedError = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return message.includes("API 401") || message.includes("UNAUTHENTICATED");
};

const stripAuthorizationHeader = (headers?: RequestInit["headers"]) => {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.delete("authorization");
    next.delete("Authorization");
    return next;
  }
  if (Array.isArray(headers)) {
    return headers.filter(([key]) => key.toLowerCase() !== "authorization");
  }
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "authorization") {
      next[key] = String(value);
    }
  }
  return next;
};

export const api = {
  request: async <T>(path: string, init?: RequestInit): Promise<T> => {
    try {
      return await baseApi.request<T>(path, init);
    } catch (err) {
      if (!isUnauthorizedError(err)) throw err;
      let refreshed = false;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        refreshed = Boolean(data.session && !error);
      } catch {
        refreshed = false;
      }
      const retryInit = init
        ? { ...init, headers: stripAuthorizationHeader(init.headers) }
        : undefined;
      try {
        return await baseApi.request<T>(path, retryInit);
      } catch (retryErr) {
        if (isUnauthorizedError(retryErr)) {
          try {
            if (!refreshed) {
              await supabase.auth.signOut();
            }
          } catch {
            // ignore sign out errors
          }
        }
        throw retryErr;
      }
    }
  },
  requestWithAccessToken: async <T>(
    path: string,
    accessToken: string | null | undefined,
    init?: RequestInit,
  ): Promise<T> => {
    if (!accessToken) {
      return api.request<T>(path, init);
    }
    const headers = {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    };
    return api.request<T>(path, { ...init, headers });
  },
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  result?: T;
  errorCode?: string;
  message?: string;
  error?: string | { message?: string; errorCode?: string };
};

const isEnvelope = (payload: unknown): payload is ApiEnvelope<unknown> =>
  typeof payload === "object" && payload !== null && "ok" in payload;

export const unwrapApiResponse = <T>(payload: unknown): T => {
  if (!isEnvelope(payload)) return payload as T;
  if (payload.ok) {
    return (payload.data ?? payload.result ?? payload) as T;
  }
  const message =
    (typeof payload.error === "string" && payload.error) ||
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.error === "object" && payload.error?.message) ||
    "Erro ao carregar.";
  throw new ApiError(500, message);
};
