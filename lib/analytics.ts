export type AnalyticsPayload = Record<string, unknown>;

export type TrackEventOptions = {
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
  sourceType: "WEB";
  organizationId?: number | null;
  idempotencyKey: string;
  sessionId: string;
  surface: string | null;
  outcome: string | null;
  payload: Record<string, unknown>;
  tags: Record<string, unknown>;
  occurredAt: string;
};

const TELEMETRY_ENDPOINT = "/api/telemetry/events";
const SESSION_KEY = "orya.telemetry.session";
const FLUSH_INTERVAL_MS = 2500;
const MAX_BATCH_SIZE = 25;
const MAX_BUFFER_SIZE = 200;

let queue: BufferedTelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
let lifecycleBound = false;

function inBrowser() {
  return typeof window !== "undefined";
}

function randomId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionId(explicit?: string | null) {
  if (explicit && explicit.trim()) return explicit.trim();
  if (!inBrowser()) return `srv-${randomId()}`;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.trim()) return existing.trim();
    const created = randomId();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return `fallback-${randomId()}`;
  }
}

function toJsonSafe(value: unknown, depth = 0, seen?: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
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

async function flushQueue(opts?: { keepalive?: boolean }) {
  if (!inBrowser() || flushInFlight || queue.length === 0) return;
  flushInFlight = true;
  const batch = queue.splice(0, MAX_BATCH_SIZE);

  try {
    const res = await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: opts?.keepalive ?? false,
      credentials: "same-origin",
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
  if (!inBrowser()) return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
}

function bindLifecycleFlush() {
  if (!inBrowser() || lifecycleBound) return;
  lifecycleBound = true;

  const flushOnHide = () => {
    void flushQueue({ keepalive: true });
  };

  window.addEventListener("pagehide", flushOnHide);
  window.addEventListener("beforeunload", flushOnHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushOnHide();
    }
  });
}

export function trackEvent(
  name: string,
  payload?: AnalyticsPayload,
  options?: TrackEventOptions,
) {
  if (!inBrowser()) return;
  const eventName = name?.trim();
  if (!eventName) return;

  bindLifecycleFlush();

  const sessionId = getSessionId(options?.sessionId ?? null);
  const nowIso = new Date().toISOString();
  const surface = options?.surface?.trim() || window.location.pathname || null;
  const idempotencyKey = options?.idempotencyKey?.trim() || randomId();

  const event: BufferedTelemetryEvent = {
    eventName,
    eventVersion: options?.eventVersion?.trim() || "1.0.0",
    sourceType: "WEB",
    organizationId:
      typeof options?.organizationId === "number" ? options.organizationId : null,
    idempotencyKey,
    sessionId,
    surface,
    outcome: options?.outcome?.trim() || null,
    occurredAt: nowIso,
    payload: toJsonSafe(payload ?? {}) as Record<string, unknown>,
    tags: toJsonSafe({
      ...(options?.tags ?? {}),
      href: window.location.href,
      pathname: window.location.pathname,
      referrer: document.referrer || null,
      language: navigator.language || null,
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
