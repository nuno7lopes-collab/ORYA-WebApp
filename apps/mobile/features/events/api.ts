import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import { DiscoverDetailResponseSchema, PublicEventCard } from "@orya/shared";

export const fetchEventDetail = async (slug: string): Promise<PublicEventCard> => {
  if (!slug) {
    throw new ApiError(400, "Slug inválido.");
  }
  try {
    const response = await api.request<unknown>(`/api/eventos/${slug}/public`);
    const unwrapped = unwrapApiResponse<unknown>(response);
    const parsed = DiscoverDetailResponseSchema.safeParse(unwrapped);
    if (!parsed.success) {
      throw new ApiError(500, "Formato inválido do evento.");
    }
    return parsed.data.item;
  } catch (error) {
    if (error instanceof Error && error.message.includes("API 404")) {
      throw new ApiError(404, "Evento não encontrado.");
    }
    throw error;
  }
};
