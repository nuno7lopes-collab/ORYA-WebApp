import { ApiError, api, unwrapApiResponse } from "../../lib/api";
import { ServiceDetail } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseServiceDetail = (payload: unknown): ServiceDetail => {
  if (!isRecord(payload) || !isRecord(payload.service)) {
    throw new ApiError(500, "Formato invalido do servico.");
  }

  return payload.service as ServiceDetail;
};

export const fetchServiceDetail = async (id: string): Promise<ServiceDetail> => {
  if (!id) {
    throw new ApiError(400, "Servico invalido.");
  }

  try {
    const response = await api.request<unknown>(`/api/servicos/${id}`);
    const unwrapped = unwrapApiResponse<unknown>(response);
    return parseServiceDetail(unwrapped);
  } catch (error) {
    if (error instanceof Error && error.message.includes("API 404")) {
      throw new ApiError(404, "Servico nao encontrado.");
    }
    throw error;
  }
};
