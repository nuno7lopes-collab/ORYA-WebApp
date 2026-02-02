import { api, ApiError } from "../../lib/api";
import { DiscoverResponseSchema, PublicEventCard } from "@orya/shared";

type DiscoverParams = {
  q?: string;
  type?: "all" | "free" | "paid";
  cursor?: string | null;
  limit?: number;
};

export type DiscoverPage = {
  items: PublicEventCard[];
  nextCursor: string | null;
  hasMore: boolean;
};

const toQueryString = (params: DiscoverParams): string => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type && params.type !== "all") query.set("type", params.type);
  if (params.cursor) query.set("cursor", params.cursor);
  query.set("limit", String(params.limit ?? 12));
  return query.toString();
};

export const fetchDiscoverPage = async (params: DiscoverParams = {}): Promise<DiscoverPage> => {
  const qs = toQueryString(params);
  const response = await api.request<unknown>(`/api/explorar/list?${qs}`);
  const parsed = DiscoverResponseSchema.safeParse(response);

  if (!parsed.success) {
    throw new ApiError(500, "Formato inválido na resposta de descobrir.");
  }

  return {
    items: parsed.data.items,
    nextCursor: parsed.data.pagination?.nextCursor ?? null,
    hasMore: parsed.data.pagination?.hasMore ?? false,
  };
};
