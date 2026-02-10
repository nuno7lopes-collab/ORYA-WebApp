import { api } from "../../lib/api";

export type EventSignalPayload = {
  eventId?: number;
  organizationId?: number;
  signalType:
    | "CLICK"
    | "VIEW"
    | "DWELL"
    | "FAVORITE"
    | "PURCHASE"
    | "HIDE_EVENT"
    | "HIDE_CATEGORY"
    | "HIDE_ORG";
  signalValue?: number | null;
  metadata?: Record<string, unknown> | null;
};

export const sendEventSignal = async (payload: EventSignalPayload) => {
  try {
    await api.request("/api/me/events/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[signals] falha ao enviar sinal", err);
    }
  }
};
