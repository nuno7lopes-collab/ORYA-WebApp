import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import { WalletDetail, WalletEntitlement, WalletPage } from "./types";

type WalletListPayload = {
  items?: WalletEntitlement[];
  nextCursor?: string | null;
};

const toQuery = (opts: {
  cursor?: string | null;
  pageSize?: number;
  upcomingOnly?: boolean;
  pastOnly?: boolean;
}) => {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  params.set("pageSize", String(opts.pageSize ?? 20));
  if (opts.upcomingOnly) params.append("filter", "upcoming");
  if (opts.pastOnly) params.append("filter", "past");
  return params.toString();
};

export const fetchWalletPage = async (opts: {
  cursor?: string | null;
  pageSize?: number;
  upcomingOnly?: boolean;
  pastOnly?: boolean;
} = {}): Promise<WalletPage> => {
  const response = await api.request<unknown>(`/api/me/wallet?${toQuery(opts)}`);
  const unwrapped = unwrapApiResponse<WalletListPayload>(response);
  return {
    items: Array.isArray(unwrapped?.items) ? unwrapped.items : [],
    nextCursor: unwrapped?.nextCursor ?? null,
  };
};

export const fetchWalletDetail = async (entitlementId: string): Promise<WalletDetail> => {
  if (!entitlementId) {
    throw new ApiError(400, "Entitlement inválido.");
  }
  const response = await api.request<unknown>(`/api/me/wallet/${encodeURIComponent(entitlementId)}`);
  return unwrapApiResponse<WalletDetail>(response);
};
