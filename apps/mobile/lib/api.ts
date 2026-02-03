import { createApiClient } from "@orya/shared";
import { supabase } from "./supabase";

export const api = createApiClient({
  getAccessToken: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  },
});

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
