import { ApiError, api, unwrapApiResponse } from "../../lib/api";
import { ServiceDetail } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseServiceDetail = (payload: unknown): ServiceDetail => {
  if (!isRecord(payload) || !isRecord(payload.service)) {
    throw new ApiError(500, "Formato inválido do serviço.");
  }

  return payload.service as ServiceDetail;
};

export const fetchServiceDetail = async (
  id: string,
  options?: { courtId?: number | null },
): Promise<ServiceDetail> => {
  if (!id) {
    throw new ApiError(400, "Serviço inválido.");
  }

  try {
    const query = new URLSearchParams();
    if (options?.courtId && Number.isFinite(options.courtId) && options.courtId > 0) {
      query.set("courtId", String(Math.trunc(options.courtId)));
    }
    const path = query.size > 0 ? `/api/servicos/${id}?${query.toString()}` : `/api/servicos/${id}`;
    const response = await api.request<unknown>(path);
    const unwrapped = unwrapApiResponse<unknown>(response);
    return parseServiceDetail(unwrapped);
  } catch (error) {
    if (error instanceof Error && error.message.includes("API 404")) {
      throw new ApiError(404, "Serviço não encontrado.");
    }
    throw error;
  }
};
