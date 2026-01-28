import { buildResponseHeaders, getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondLegacy } from "@/lib/http/envelope";

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function normalizePlainResponse(ctx: RequestContext, res: Response) {
  const headers = buildResponseHeaders(ctx, res.headers);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function normalizeJsonResponse(ctx: RequestContext, res: Response) {
  const payload = await res.json();
  if (isV9Envelope(payload)) {
    const headers = buildResponseHeaders(ctx, res.headers);
    return new Response(JSON.stringify(payload), {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
  return respondLegacy(ctx, payload, { status: res.status, headers: res.headers });
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

export function withApiEnvelope<T extends (req: Request, ...args: any[]) => Promise<Response> | Response>(
  handler: T,
): (req: Request, ...args: Parameters<T> extends [any, ...infer Rest] ? Rest : never) => Promise<Response> {
  return async (req: Request, ...args: any[]) => {
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
      return respondLegacy(ctx, result);
    } catch (err) {
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
