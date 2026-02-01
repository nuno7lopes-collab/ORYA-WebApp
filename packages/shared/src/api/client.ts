import { getSharedEnv } from "../config/env";

export type ApiClientOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
};

export type ApiClient = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
};

export const createApiClient = (options: ApiClientOptions = {}): ApiClient => {
  const { apiBaseUrl } = getSharedEnv();
  const baseUrl = options.baseUrl ?? apiBaseUrl;
  const defaultHeaders = options.headers ?? {};

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const headers = {
      "Content-Type": "application/json",
      ...defaultHeaders,
      ...(init.headers ?? {}),
    };
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
