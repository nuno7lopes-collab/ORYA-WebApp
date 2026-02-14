import { getSharedEnv } from "../config/env";

export type ApiClientOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
  getAccessToken?: () => Promise<string | null> | string | null;
};

export type ApiClient = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
};

const hasAuthorizationHeader = (headers: RequestInit["headers"]): boolean => {
  if (!headers) return false;
  if (headers instanceof Headers) {
    return headers.has("authorization");
  }
  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === "authorization");
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
};

export const createApiClient = (options: ApiClientOptions = {}): ApiClient => {
  const { apiBaseUrl } = getSharedEnv();
  const baseUrl = options.baseUrl ?? apiBaseUrl;
  const defaultHeaders = options.headers ?? {};
  const getAccessToken = options.getAccessToken;

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const accessToken = getAccessToken ? await getAccessToken() : null;
    const hasAuthHeader = hasAuthorizationHeader(init.headers);
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const headers = new Headers({
      "Content-Type": "application/json",
      ...defaultHeaders,
    });

    if (accessToken && !hasAuthHeader) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    if (init.headers) {
      const initHeaders = new Headers(init.headers);
      initHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    const json = await res.json().catch(() => null);
    return json as T;
  };

  return { request };
};
