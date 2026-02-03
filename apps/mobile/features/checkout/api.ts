import { api, unwrapApiResponse } from "../../lib/api";
import { CheckoutIntentResponse, CheckoutStatusResponse, CheckoutMethod } from "./types";

type CreateCheckoutInput = {
  slug: string;
  ticketTypeId: number;
  quantity: number;
  paymentMethod: CheckoutMethod;
  purchaseId?: string | null;
  idempotencyKey?: string | null;
  paymentScenario?: string;
};

const toApiPaymentMethod = (method: CheckoutMethod): "card" | "mbway" => {
  if (method === "mbway") return "mbway";
  return "card";
};

export const createCheckoutIntent = async (input: CreateCheckoutInput): Promise<CheckoutIntentResponse> => {
  const response = await api.request<unknown>("/api/payments/intent", {
    method: "POST",
    body: JSON.stringify({
      slug: input.slug,
      items: [{ ticketId: input.ticketTypeId, quantity: input.quantity }],
      paymentMethod: toApiPaymentMethod(input.paymentMethod),
      paymentScenario: input.paymentScenario ?? "SINGLE",
      purchaseId: input.purchaseId ?? undefined,
      idempotencyKey: input.idempotencyKey ?? undefined,
    }),
  });
  return unwrapApiResponse<CheckoutIntentResponse>(response);
};

export const fetchCheckoutStatus = async (params: {
  purchaseId?: string | null;
  paymentIntentId?: string | null;
}): Promise<CheckoutStatusResponse> => {
  const query = new URLSearchParams();
  if (params.purchaseId) query.set("purchaseId", params.purchaseId);
  if (params.paymentIntentId) query.set("paymentIntentId", params.paymentIntentId);
  const response = await api.request<unknown>(`/api/checkout/status?${query.toString()}`);
  return unwrapApiResponse<CheckoutStatusResponse>(response);
};
