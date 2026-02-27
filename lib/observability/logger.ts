import { getRequestContext } from "@/lib/http/requestContext";

type LogContext = Record<string, unknown> & {
  requestId?: string | null;
  correlationId?: string | null;
};

type ResolveOptions = {
  fallbackToRequestContext?: boolean;
  emitSystemEvent?: boolean;
};

type LogLevel = "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(email|phone|token|authorization|cookie|password)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactValue(value: unknown, keyHint?: string, seen?: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, undefined, seen));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  const objectSeen = seen ?? new WeakSet<object>();
  if (objectSeen.has(value)) return "[Circular]";
  objectSeen.add(value);

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = redactValue(entry, key, objectSeen);
  }
  return result;
}

function resolveContext(input?: LogContext, opts?: ResolveOptions) {
  const requestId = typeof input?.requestId === "string" ? input?.requestId : null;
  const correlationId = typeof input?.correlationId === "string" ? input?.correlationId : requestId;

  const fallback = opts?.fallbackToRequestContext ?? true;
  if (!requestId && !correlationId && fallback) {
    const ctx = getRequestContext();
    return { ...input, requestId: ctx.requestId, correlationId: ctx.correlationId };
  }

  return {
    ...input,
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
  };
}

function normalizeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(typeof (err as { code?: unknown }).code === "string"
        ? { code: (err as unknown as { code: string }).code }
        : {}),
    };
  }
  return { message: String(err) };
}

const SYSTEM_EVENT_LEVEL_MAP: Record<LogLevel, string> = {
  info: "system.log.info",
  warn: "system.log.warn",
  error: "system.log.error",
};

function shouldEmitSystemEvent(level: LogLevel, scope: string, opts?: ResolveOptions) {
  if (opts?.emitSystemEvent === false) return false;
  if (typeof window !== "undefined") return false;
  if (scope.startsWith("telemetry.")) return false;
  if (scope.startsWith("system.log")) return false;
  return level === "warn" || level === "error";
}

function toSystemEventPayload(params: {
  level: LogLevel;
  scope: string;
  requestId: string | null;
  correlationId: string | null;
  contextPayload: Record<string, unknown>;
  err: unknown;
}) {
  return {
    logLevel: params.level,
    scope: params.scope,
    requestId: params.requestId,
    correlationId: params.correlationId,
    context: redactValue(params.contextPayload),
    error: params.err === undefined ? null : redactValue(normalizeError(params.err)),
  };
}

async function emitSystemTelemetryEvent(params: {
  level: LogLevel;
  scope: string;
  requestId: string | null;
  correlationId: string | null;
  contextPayload: Record<string, unknown>;
  err: unknown;
}) {
  try {
    const { ingestTelemetryBatch } = await import("@/domain/telemetry/ingest");
    await ingestTelemetryBatch(
      [
        {
          eventName: SYSTEM_EVENT_LEVEL_MAP[params.level],
          eventVersion: "1.0.0",
          sourceType: "INTERNAL",
          actorType: "SYSTEM",
          requestId: params.requestId,
          correlationId: params.correlationId,
          payload: toSystemEventPayload(params),
          tags: { telemetryKind: "SYSTEM_LOG" },
          occurredAt: new Date().toISOString(),
        },
      ],
      {
        requestId: params.requestId,
        correlationId: params.correlationId,
        defaultSourceType: "INTERNAL",
        defaultActorType: "SYSTEM",
      },
    );
  } catch {
    // Intencionalmente silencioso para evitar loops recursivos de logging.
  }
}

function emit(level: LogLevel, scope: string, context?: LogContext, err?: unknown, opts?: ResolveOptions) {
  const payload = resolveContext(context, opts);
  const requestId = typeof payload?.requestId === "string" ? payload.requestId : null;
  const correlationId =
    typeof payload?.correlationId === "string" ? payload.correlationId : requestId;

  const contextPayload: Record<string, unknown> = { ...payload };
  delete contextPayload.requestId;
  delete contextPayload.correlationId;

  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    requestId,
    correlationId,
    context: redactValue(contextPayload),
    error: err === undefined ? null : redactValue(normalizeError(err)),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }

  if (shouldEmitSystemEvent(level, scope, opts)) {
    void emitSystemTelemetryEvent({
      level,
      scope,
      requestId,
      correlationId,
      contextPayload,
      err,
    });
  }
}

export function logInfo(scope: string, context?: LogContext, opts?: ResolveOptions) {
  emit("info", scope, context, undefined, opts);
}

export function logWarn(scope: string, context?: LogContext, opts?: ResolveOptions) {
  emit("warn", scope, context, undefined, opts);
}

export function logError(scope: string, err: unknown, context?: LogContext, opts?: ResolveOptions) {
  emit("error", scope, context, err, opts);
}
