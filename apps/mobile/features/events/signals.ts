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

const DEDUPED_SIGNAL_TYPES = new Set<EventSignalPayload["signalType"]>(["CLICK", "VIEW", "DWELL"]);
const SIGNAL_DEDUPE_WINDOW_MS = 6000;
const recentSignals = new Map<string, number>();

const buildSignalKey = (payload: EventSignalPayload) =>
  `${payload.signalType}:${payload.eventId ?? "none"}:${payload.organizationId ?? "none"}`;

export const sendEventSignal = async (payload: EventSignalPayload) => {
  if (DEDUPED_SIGNAL_TYPES.has(payload.signalType)) {
    const key = buildSignalKey(payload);
    const now = Date.now();
    const lastSentAt = recentSignals.get(key) ?? 0;
    if (now - lastSentAt < SIGNAL_DEDUPE_WINDOW_MS) {
      return;
    }
    recentSignals.set(key, now);
  }

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
