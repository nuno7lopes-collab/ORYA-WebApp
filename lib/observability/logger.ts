import { getRequestContext } from "@/lib/http/requestContext";

type LogContext = Record<string, unknown> & {
  requestId?: string | null;
  correlationId?: string | null;
};

type ResolveOptions = { fallbackToRequestContext?: boolean };

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
}
