import { getMobileEnv } from "./env";

export type AnalyticsPayload = Record<string, unknown>;

type TrackEventOptions = {
  organizationId?: number | null;
  surface?: string | null;
  outcome?: string | null;
  eventVersion?: string;
  idempotencyKey?: string | null;
  sessionId?: string | null;
  tags?: Record<string, unknown>;
};

type BufferedTelemetryEvent = {
  eventName: string;
  eventVersion: string;
  sourceType: "MOBILE";
  organizationId?: number | null;
  idempotencyKey: string;
  sessionId: string;
  surface: string | null;
  outcome: string | null;
  payload: Record<string, unknown>;
  tags: Record<string, unknown>;
  occurredAt: string;
};

const FLUSH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE = 20;
const MAX_BUFFER_SIZE = 200;

let queue: BufferedTelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
let generatedSessionId: string | null = null;

function randomId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionId(explicit?: string | null) {
  if (explicit && explicit.trim()) return explicit.trim();
  if (!generatedSessionId) generatedSessionId = randomId();
  return generatedSessionId;
}

function toJsonSafe(value: unknown, depth = 0, seen?: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (depth >= 6) return "[DEPTH_LIMIT]";
  if (Array.isArray(value)) return value.slice(0, 40).map((entry) => toJsonSafe(entry, depth + 1, seen));
  if (typeof value !== "object") return String(value);
  const refs = seen ?? new WeakSet<object>();
  if (refs.has(value as object)) return "[CIRCULAR]";
  refs.add(value as object);
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    out[key] = toJsonSafe(entry, depth + 1, refs);
  }
  return out;
}

async function flushQueue() {
  if (flushInFlight || queue.length === 0) return;
  flushInFlight = true;
  const batch = queue.splice(0, MAX_BATCH_SIZE);
  const baseUrl = getMobileEnv().apiBaseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/api/telemetry/events`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-client-platform": "mobile",
      },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) {
      queue = [...batch, ...queue].slice(0, MAX_BUFFER_SIZE);
    }
  } catch {
    queue = [...batch, ...queue].slice(0, MAX_BUFFER_SIZE);
  } finally {
    flushInFlight = false;
    if (queue.length > 0 && !flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushQueue();
      }, FLUSH_INTERVAL_MS);
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
}

export function trackEvent(
  name: string,
  payload?: AnalyticsPayload,
  options?: TrackEventOptions,
) {
  const eventName = name?.trim();
  if (!eventName) return;

  const sessionId = getSessionId(options?.sessionId ?? null);
  const idempotencyKey = options?.idempotencyKey?.trim() || randomId();
  const event: BufferedTelemetryEvent = {
    eventName,
    eventVersion: options?.eventVersion?.trim() || "1.0.0",
    sourceType: "MOBILE",
    organizationId:
      typeof options?.organizationId === "number" ? options.organizationId : null,
    idempotencyKey,
    sessionId,
    surface: options?.surface?.trim() || null,
    outcome: options?.outcome?.trim() || null,
    occurredAt: new Date().toISOString(),
    payload: toJsonSafe(payload ?? {}) as Record<string, unknown>,
    tags: toJsonSafe({
      ...(options?.tags ?? {}),
      appEnv: getMobileEnv().appEnv,
    }) as Record<string, unknown>,
  };

  queue.push(event);
  if (queue.length > MAX_BUFFER_SIZE) {
    queue = queue.slice(queue.length - MAX_BUFFER_SIZE);
  }

  if (queue.length >= MAX_BATCH_SIZE) {
    void flushQueue();
    return;
  }

  scheduleFlush();
}
