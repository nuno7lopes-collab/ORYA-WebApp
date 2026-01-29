import { getRequestContext } from "@/lib/http/requestContext";
import * as SentryNode from "@sentry/node";

type LogContext = Record<string, unknown> & {
  requestId?: string | null;
  correlationId?: string | null;
};

type ResolveOptions = { fallbackToRequestContext?: boolean };

let sentryInitialized = false;

function ensureSentry() {
  if (sentryInitialized) return;
  if (!process.env.SENTRY_DSN) return;
  SentryNode.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
  sentryInitialized = true;
}

function normalizeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function resolveContext(input?: LogContext, opts?: ResolveOptions) {
  const requestId = typeof input?.requestId === "string" ? input?.requestId : null;
  const correlationId =
    typeof input?.correlationId === "string" ? input?.correlationId : requestId;

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

export function logInfo(scope: string, context?: LogContext, opts?: ResolveOptions) {
  const payload = resolveContext(context, opts);
  console.info(`[${scope}]`, payload);
}

export function logWarn(scope: string, context?: LogContext, opts?: ResolveOptions) {
  const payload = resolveContext(context, opts);
  console.warn(`[${scope}]`, payload);
}

export function logError(scope: string, err: unknown, context?: LogContext, opts?: ResolveOptions) {
  const payload = resolveContext(context, opts);
  const errorPayload = normalizeError(err);
  console.error(`[${scope}]`, { ...payload, error: errorPayload });

  ensureSentry();
  const sentry = (globalThis as any)?.Sentry ?? SentryNode;
  if (sentry?.captureException && process.env.SENTRY_DSN) {
    sentry.captureException(err, {
      extra: { ...payload, scope },
      tags: { scope },
    });
  }
}
