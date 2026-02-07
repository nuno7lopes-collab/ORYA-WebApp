import { buildResponseHeaders, getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { setRequestAuthHeader } from "@/lib/http/authContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";

const JSON_CONTENT_TYPE = "application/json";
const DOWNLOAD_CONTENT_TYPES = [
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "text/calendar",
];

const CANONICAL_ERROR_CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  410: "GONE",
  413: "PAYLOAD_TOO_LARGE",
  422: "VALIDATION_FAILED",
  429: "THROTTLED",
  500: "INTERNAL_ERROR",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasJsonContentType(contentType: string | null) {
  if (!contentType) return false;
  return contentType.toLowerCase().includes(JSON_CONTENT_TYPE);
}

function hasDownloadContentType(contentType: string | null) {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return DOWNLOAD_CONTENT_TYPES.some((type) => normalized.includes(type));
}

function hasEventStreamContentType(contentType: string | null) {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("text/event-stream");
}

function isRedirectResponse(res: Response) {
  const status = res.status;
  if (status >= 300 && status < 400) return true;
  return res.headers.has("location");
}

function isV9Envelope(payload: unknown) {
  if (!isObject(payload)) return false;
  if (typeof payload.ok !== "boolean") return false;
  if (payload.ok) {
    return "result" in payload || "data" in payload || "meta" in payload;
  }
  const error = (payload as Record<string, unknown>).error;
  if (isObject(error) && typeof error.errorCode === "string" && typeof error.message === "string") {
    return true;
  }
  if (typeof (payload as Record<string, unknown>).errorCode === "string") {
    return typeof (payload as Record<string, unknown>).message === "string";
  }
  if (typeof error === "string") {
    return typeof (payload as Record<string, unknown>).errorCode === "string";
  }
  return false;
}

function isStableErrorCode(code: unknown) {
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code);
}

function normalizePlainResponse(ctx: RequestContext, res: Response) {
  const headers = buildResponseHeaders(ctx, res.headers);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function ensureSuccessEnvelope(ctx: RequestContext, payload: Record<string, unknown>) {
  const requestId = ctx.requestId;
  const correlationId = ctx.correlationId;
  const dataValue =
    ("data" in payload ? payload.data : undefined) ??
    ("result" in payload ? payload.result : undefined);

  const normalized: Record<string, unknown> = {
    ...payload,
    requestId,
    correlationId,
    ...(!("data" in payload) && dataValue !== undefined ? { data: dataValue } : {}),
    ...(!("result" in payload) && dataValue !== undefined ? { result: dataValue } : {}),
  };

  const flattenSource = isPlainObject(dataValue) ? dataValue : null;
  if (flattenSource) {
    for (const [key, value] of Object.entries(flattenSource)) {
      if (!(key in normalized)) {
        normalized[key] = value;
      }
    }
  }

  return normalized;
}

function ensureErrorEnvelope(ctx: RequestContext, payload: Record<string, unknown>) {
  const requestId = ctx.requestId;
  const correlationId = ctx.correlationId;
  const errorObj = isPlainObject(payload.error) ? (payload.error as Record<string, unknown>) : null;

  const errorCode =
    (typeof payload.errorCode === "string" ? payload.errorCode : undefined) ??
    (typeof payload.code === "string" ? payload.code : undefined) ??
    (typeof errorObj?.errorCode === "string" ? errorObj.errorCode : undefined) ??
    (typeof payload.error === "string" ? payload.error : undefined) ??
    "UNKNOWN_ERROR";
  const message =
    (typeof payload.message === "string" ? payload.message : undefined) ??
    (typeof errorObj?.message === "string" ? errorObj.message : undefined) ??
    (typeof payload.error === "string" ? payload.error : undefined) ??
    String(errorCode);
  const retryable =
    (typeof payload.retryable === "boolean" ? payload.retryable : undefined) ??
    (typeof errorObj?.retryable === "boolean" ? Boolean(errorObj.retryable) : undefined) ??
    false;
  const nextAction =
    (typeof payload.nextAction === "string" ? payload.nextAction : undefined) ??
    (typeof errorObj?.nextAction === "string" ? errorObj.nextAction : undefined) ??
    (typeof (errorObj as any)?.next_action === "string" ? String((errorObj as any).next_action) : null) ??
    null;
  const details =
    (payload.details as Record<string, unknown> | null | undefined) ??
    (errorObj?.details as Record<string, unknown> | null | undefined) ??
    null;

  const normalized: Record<string, unknown> = {
    ...payload,
    requestId,
    correlationId,
    errorCode,
    message,
    retryable,
    ...(nextAction ? { nextAction } : {}),
    ...(details ? { details } : {}),
    ...(!("data" in payload) && details ? { data: details } : {}),
    ...(typeof payload.code === "string" ? {} : { code: errorCode }),
  };

  if (typeof payload.error !== "string") {
    if (errorObj) normalized.errorDetail = errorObj;
    normalized.error = message;
  }

  return normalized;
}

function enforceCanonicalErrorCode(status: number, payload: Record<string, unknown>) {
  const canonical = CANONICAL_ERROR_CODE_BY_STATUS[status];
  if (!canonical) return payload;
  const current = typeof payload.errorCode === "string" ? payload.errorCode : undefined;
  if (current && isStableErrorCode(current)) return payload;

  const original =
    current ??
    (typeof payload.code === "string" ? payload.code : undefined) ??
    (typeof payload.error === "string" ? payload.error : undefined);

  const details =
    original && original !== canonical
      ? { ...(payload.details as Record<string, unknown> | null | undefined), originalCode: original }
      : payload.details;

  return {
    ...payload,
    errorCode: canonical,
    code: typeof payload.code === "string" ? payload.code : original ?? canonical,
    ...(details ? { details } : {}),
  };
}

function ensureCanonicalEnvelope(ctx: RequestContext, payload: Record<string, unknown>) {
  if (payload.ok === true) {
    return ensureSuccessEnvelope(ctx, payload);
  }
  if (payload.ok === false) {
    return ensureErrorEnvelope(ctx, payload);
  }
  return payload;
}

async function normalizeJsonResponse(ctx: RequestContext, res: Response) {
  const payload = await res.json();
  if (isV9Envelope(payload)) {
    let normalized = ensureCanonicalEnvelope(ctx, payload as Record<string, unknown>);
    if (normalized.ok === false) {
      normalized = enforceCanonicalErrorCode(res.status, normalized);
    }
    const headers = buildResponseHeaders(ctx, res.headers);
    return new Response(JSON.stringify(normalized), {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
  return respondError(
    ctx,
    {
      errorCode: "LEGACY_ENVELOPE",
      message: "Response payload is not a v9 envelope.",
      retryable: false,
      details: { status: res.status },
    },
    { status: 500, headers: res.headers },
  );
}

function shouldPassthrough(res: Response) {
  return res.status === 204 || res.status === 304;
}

function shouldBypassEnvelope(res: Response) {
  if (shouldPassthrough(res)) return true;
  if (isRedirectResponse(res)) return true;
  if (res.headers.has("content-disposition")) return true;
  const contentType = res.headers.get("content-type");
  if (hasEventStreamContentType(contentType)) return true;
  if (hasDownloadContentType(contentType)) return true;
  if (res.body instanceof ReadableStream && !hasJsonContentType(contentType)) return true;
  return false;
}

export function withApiEnvelope<Req extends Request, Args extends any[]>(
  handler: (req: Req, ...args: Args) => Promise<Response> | Response,
): (req: Req, ...args: Args) => Promise<Response> {
  return async (req: Req, ...args: Args) => {
    setRequestAuthHeader(req?.headers ?? null);
    const ctx = getRequestContext(req);
    try {
      const result = await handler(req, ...args);
      if (result instanceof Response) {
        if (shouldBypassEnvelope(result)) {
          return normalizePlainResponse(ctx, result);
        }
        const contentType = result.headers.get("content-type");
        if (hasJsonContentType(contentType)) {
          return await normalizeJsonResponse(ctx, result);
        }
        return normalizePlainResponse(ctx, result);
      }
      if (isObject(result) && "ok" in result) {
        if (!isV9Envelope(result)) {
          return respondError(
            ctx,
            {
              errorCode: "LEGACY_ENVELOPE",
              message: "Response payload is not a v9 envelope.",
              retryable: false,
            },
            { status: 500 },
          );
        }
        let normalized = ensureCanonicalEnvelope(ctx, result as Record<string, unknown>);
        if (normalized.ok === false) {
          normalized = enforceCanonicalErrorCode(400, normalized);
        }
        const headers = buildResponseHeaders(ctx);
        return new Response(JSON.stringify(normalized), { status: 200, headers });
      }
      return respondOk(ctx, result as unknown);
    } catch (err) {
      logError(
        "api",
        err,
        {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          path: "url" in req ? (req as Request).url : undefined,
          method: (req as Request).method,
        },
        { fallbackToRequestContext: false },
      );
      return respondError(
        ctx,
        {
          errorCode: "INTERNAL_ERROR",
          message: "Erro interno.",
          retryable: false,
          details: err instanceof Error ? { name: err.name, message: err.message } : null,
        },
        { status: 500 },
      );
    }
  };
}
