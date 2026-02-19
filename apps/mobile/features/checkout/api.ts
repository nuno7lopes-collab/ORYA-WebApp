import { api, ApiError, ApiRawResult, unwrapApiResponse } from "../../lib/api";
import {
  CheckoutIntentResponse,
  CheckoutStatusResponse,
  CheckoutMethod,
} from "./types";

type CreateCheckoutInput = {
  slug: string;
  ticketTypeId?: number;
  quantity?: number;
  items?: Array<{
    ticketTypeId: number;
    quantity: number;
  }>;
  paymentMethod: CheckoutMethod;
  purchaseId?: string | null;
  idempotencyKey?: string | null;
  paymentScenario?: string;
  inviteToken?: string | null;
};

type CreatePairingCheckoutInput = {
  pairingId: number;
  ticketTypeId: number;
  inviteToken?: string | null;
  idempotencyKey?: string | null;
};

const toApiPaymentMethod = (method: CheckoutMethod): "card" | "mbway" => {
  if (method === "mbway") return "mbway";
  return "card";
};

const isEnvelopeLike = (value: unknown): value is { ok?: unknown } =>
  typeof value === "object" && value !== null && "ok" in value;

const readPayloadMessage = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return null;
};

const readPayloadCode = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.errorCode === "string" && payload.errorCode.trim()) {
    return payload.errorCode.trim().toUpperCase();
  }
  return null;
};

const unwrapRawResponse = <T>(result: ApiRawResult<unknown>): T => {
  const payload = result.data;
  if (!result.ok && !isEnvelopeLike(payload)) {
    const message =
      readPayloadMessage(payload) || result.errorText || "Erro ao carregar.";
    throw new ApiError(result.status, message, readPayloadCode(payload));
  }
  return unwrapApiResponse<T>(payload, result.status);
};

export const createCheckoutIntent = async (
  input: CreateCheckoutInput,
): Promise<CheckoutIntentResponse> => {
  const items =
    Array.isArray(input.items) && input.items.length > 0
      ? input.items
          .filter(
            (item) =>
              Number.isFinite(item.ticketTypeId) &&
              Number.isFinite(item.quantity) &&
              item.quantity > 0,
          )
          .map((item) => ({
            ticketId: item.ticketTypeId,
            quantity: Math.floor(item.quantity),
          }))
      : Number.isFinite(input.ticketTypeId) &&
          Number.isFinite(input.quantity) &&
          (input.quantity ?? 0) > 0
        ? [{ ticketId: input.ticketTypeId as number, quantity: Math.floor(input.quantity as number) }]
        : [];
  if (items.length === 0) {
    throw new ApiError(400, "Seleciona pelo menos um bilhete.");
  }
  const response = await api.requestRaw<unknown>("/api/payments/intent", {
    method: "POST",
    body: JSON.stringify({
      slug: input.slug,
      items,
      paymentMethod: toApiPaymentMethod(input.paymentMethod),
      paymentScenario: input.paymentScenario ?? "SINGLE",
      purchaseId: input.purchaseId ?? undefined,
      idempotencyKey: input.idempotencyKey ?? undefined,
      inviteToken: input.inviteToken ?? undefined,
    }),
  });
  return unwrapRawResponse<CheckoutIntentResponse>(response);
};

export const createPairingCheckoutIntent = async (
  input: CreatePairingCheckoutInput,
): Promise<CheckoutIntentResponse> => {
  const response = await api.requestRaw<unknown>(
    `/api/padel/pairings/${input.pairingId}/checkout`,
    {
      method: "POST",
      body: JSON.stringify({
        ticketTypeId: input.ticketTypeId,
        padelCategoryLinkId: input.ticketTypeId,
        inviteToken: input.inviteToken ?? undefined,
        idempotencyKey: input.idempotencyKey ?? undefined,
      }),
    },
  );
  return unwrapRawResponse<CheckoutIntentResponse>(response);
};

export const fetchCheckoutStatus = async (params: {
  checkoutId?: string | null;
  purchaseId?: string | null;
  paymentIntentId?: string | null;
}): Promise<CheckoutStatusResponse> => {
  const query = new URLSearchParams();
  if (params.checkoutId) query.set("checkoutId", params.checkoutId);
  if (params.purchaseId) query.set("purchaseId", params.purchaseId);
  if (params.paymentIntentId)
    query.set("paymentIntentId", params.paymentIntentId);
  const response = await api.requestRaw<unknown>(
    `/api/checkout/status?${query.toString()}`,
  );
  return unwrapRawResponse<CheckoutStatusResponse>(response);
};
