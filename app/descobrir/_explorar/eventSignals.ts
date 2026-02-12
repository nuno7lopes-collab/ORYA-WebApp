"use client";

type EventSignalPayload = {
  eventId?: number | null;
  organizationId?: number | null;
  signalType: "CLICK" | "VIEW" | "DWELL" | "FAVORITE" | "HIDE_EVENT";
  signalValue?: number | null;
  metadata?: Record<string, unknown> | null;
};

const DEDUPED_SIGNAL_TYPES = new Set<EventSignalPayload["signalType"]>(["CLICK", "VIEW", "DWELL"]);
const SIGNAL_DEDUPE_WINDOW_MS = 6000;
const recentSignals = new Map<string, number>();

const buildSignalKey = (payload: EventSignalPayload) =>
  `${payload.signalType}:${payload.eventId ?? "none"}:${payload.organizationId ?? "none"}`;

export async function sendDiscoverEventSignal(payload: EventSignalPayload, isAuthenticated: boolean) {
  if (!isAuthenticated) return;

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
    await fetch("/api/me/events/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[discover][signals] falha ao enviar sinal", err);
    }
  }
}

export type { EventSignalPayload };
