import { getSharedEnv } from "../config/env";

export type ApiClientOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
};

export const createApiClient = (options: ApiClientOptions = {}) => {
  const env = getSharedEnv();
  const baseUrl = options.baseUrl || env.apiBaseUrl;

  const request = async <T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> => {
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const headers = {
      "content-type": "application/json",
      ...(options.headers || {}),
      ...(init.headers || {}),
    } as Record<string, string>;

    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  };

  return { request };
};
