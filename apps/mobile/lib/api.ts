import { createApiClient } from "@orya/shared";
import { supabase } from "./supabase";
import { getActiveSession } from "./session";
import { getMobileEnv } from "./env";

const REQUEST_TIMEOUT_MS = 12_000;
const SLOW_REQUEST_MS = 1500;
const OFFLINE_COOLDOWN_MS = 8000;
const isDev = typeof __DEV__ !== "undefined" && __DEV__;
let offlineUntil = 0;

const formatError = (err: unknown) => {
  if (err instanceof Error) return err.message;
  return String(err ?? "");
};

const isTimeoutErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  return lower.includes("api timeout") || lower.includes("aborterror") || lower.includes("aborted");
};

const isNetworkErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  return (
    isTimeoutErrorMessage(message) ||
    lower.includes("network request failed") ||
    lower.includes("failed to fetch")
  );
};

const shouldFailFast = () => Date.now() < offlineUntil;

const recordOffline = () => {
  const nextUntil = Date.now() + OFFLINE_COOLDOWN_MS;
  offlineUntil = Math.max(offlineUntil, nextUntil);
};

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

const withTimeout = async <T>(fn: (signal?: AbortSignal) => Promise<T>, signal?: AbortSignal) => {
  if (signal) return fn(signal);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } catch (err) {
    const message = formatError(err);
    if (isTimeoutErrorMessage(message)) {
      throw new Error("API timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

export const api = {
  request: async <T>(path: string, init?: RequestInit): Promise<T> => {
    if (shouldFailFast()) {
      throw new Error("API offline");
    }
    const method = (init?.method ?? "GET").toUpperCase();
    const startedAt = Date.now();
    if (isDev) {
      console.info(`[api] ${method} ${path} start`);
    }
    try {
      const result = await withTimeout(
        (signal) => baseApi.request<T>(path, { ...init, signal: init?.signal ?? signal }),
        init?.signal,
      );
      if (isDev) {
        const duration = Date.now() - startedAt;
        const slowTag = duration >= SLOW_REQUEST_MS ? " (slow)" : "";
        console.info(`[api] ${method} ${path} ${duration}ms${slowTag}`);
      }
      return result;
    } catch (err) {
      const errorMessage = formatError(err);
      if (isNetworkErrorMessage(errorMessage)) {
        recordOffline();
      }
      if (isDev) {
        const duration = Date.now() - startedAt;
        console.warn(`[api] ${method} ${path} failed in ${duration}ms: ${errorMessage}`);
      }
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
        const result = await withTimeout(
          (signal) => baseApi.request<T>(path, { ...retryInit, signal: retryInit?.signal ?? signal }),
          retryInit?.signal,
        );
        if (isDev) {
          const duration = Date.now() - startedAt;
          const slowTag = duration >= SLOW_REQUEST_MS ? " (slow)" : "";
          console.info(`[api] ${method} ${path} retry OK ${duration}ms${slowTag}`);
        }
        return result;
      } catch (retryErr) {
        const retryMessage = formatError(retryErr);
        if (isNetworkErrorMessage(retryMessage)) {
          recordOffline();
        }
        if (isDev) {
          const duration = Date.now() - startedAt;
          console.warn(`[api] ${method} ${path} retry failed in ${duration}ms: ${retryMessage}`);
        }
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
  if (isDev) {
    const envelope = payload as ApiEnvelope<unknown> & { requestId?: string; correlationId?: string };
    console.warn("[api] envelope_error", {
      errorCode: envelope.errorCode ?? null,
      message: envelope.message ?? null,
      requestId: (envelope as any).requestId ?? null,
      correlationId: (envelope as any).correlationId ?? null,
      error: typeof envelope.error === "string" ? envelope.error : (envelope.error as any)?.message ?? null,
    });
  }
  const message =
    (typeof payload.error === "string" && payload.error) ||
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.error === "object" && payload.error?.message) ||
    "Erro ao carregar.";
  throw new ApiError(500, message);
};
