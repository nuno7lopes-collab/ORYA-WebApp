import { NextResponse } from "next/server";
import {
  buildResponseHeaders,
  getRequestContext,
  type RequestContext,
} from "@/lib/http/requestContext";

export type EnvelopeSuccess<T> = {
  ok: true;
  requestId: string;
  correlationId: string;
  data: T;
};

export type EnvelopeError = {
  ok: false;
  requestId: string;
  correlationId: string;
  errorCode: string;
  message: string;
  retryable: boolean;
  nextAction?: string | null;
  details?: Record<string, unknown> | null;
  data?: unknown;
  error?: string;
  code?: string;
};

export type Envelope<T = unknown> = EnvelopeSuccess<T> | EnvelopeError;

export type EnvelopeErrorInput = {
  errorCode: string;
  message: string;
  retryable?: boolean;
  nextAction?: string | null;
  details?: Record<string, unknown> | null;
  data?: unknown;
};

export type RequestContextLike = {
  requestId: string;
  correlationId: string;
  orgId?: number | null;
};

function normalizeContext(ctx: RequestContextLike): RequestContext {
  return {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    orgId: ctx.orgId ?? null,
  };
}

export function successEnvelope<T>(ctx: RequestContextLike, data: T): EnvelopeSuccess<T> {
  return {
    ok: true,
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    data,
  };
}

export function errorEnvelope(ctx: RequestContextLike, input: EnvelopeErrorInput): EnvelopeError {
  const data = input.data ?? input.details ?? undefined;
  return {
    ok: false,
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    errorCode: input.errorCode,
    code: input.errorCode,
    message: input.message,
    error: input.message,
    retryable: input.retryable ?? false,
    ...(input.nextAction ? { nextAction: input.nextAction } : {}),
    ...(input.details ? { details: input.details } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}

export function respondOk<T>(ctx: RequestContextLike, data: T, init?: ResponseInit) {
  const normalized = normalizeContext(ctx);
  const headers = buildResponseHeaders(normalized, init?.headers);
  return NextResponse.json(successEnvelope(normalized, data), { ...init, headers });
}

export function respondError(ctx: RequestContextLike, input: EnvelopeErrorInput, init?: ResponseInit) {
  const normalized = normalizeContext(ctx);
  const headers = buildResponseHeaders(normalized, init?.headers);
  return NextResponse.json(errorEnvelope(normalized, input), { ...init, headers });
}

export function respondPlainText(ctx: RequestContextLike, text: string, init?: ResponseInit) {
  const normalized = normalizeContext(ctx);
  const headers = buildResponseHeaders(normalized, init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/plain; charset=utf-8");
  }
  return new Response(text, { ...init, headers });
}

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

function isStableErrorCode(code: unknown) {
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code);
}

function normalizeLegacySuccess(payload: Record<string, unknown>) {
  if ("result" in payload) return (payload as { result: unknown }).result;
  if ("data" in payload) return (payload as { data: unknown }).data;
  const { ok: _ok, requestId: _requestId, correlationId: _correlationId, ...rest } = payload;
  return Object.keys(rest).length > 0 ? rest : null;
}

function normalizeLegacyError(payload: Record<string, unknown>) {
  let errorCode =
    (payload.errorCode as string | undefined) ??
    (payload.code as string | undefined) ??
    (payload.error as string | undefined) ??
    "UNKNOWN_ERROR";
  let message =
    (payload.message as string | undefined) ??
    (payload.error as string | undefined) ??
    (payload.errorCode as string | undefined) ??
    String(errorCode);
  let retryable = Boolean(payload.retryable ?? false);
  let nextAction =
    (payload.nextAction as string | null | undefined) ??
    (payload.next_action as string | null | undefined) ??
    null;
  let details =
    (payload.details as Record<string, unknown> | null | undefined) ??
    (payload.meta as Record<string, unknown> | null | undefined) ??
    null;

  if (payload.error && typeof payload.error === "object") {
    const nested = payload.error as Record<string, unknown>;
    errorCode = (nested.errorCode as string | undefined) ?? (nested.code as string | undefined) ?? errorCode;
    message = (nested.message as string | undefined) ?? message;
    retryable = Boolean(nested.retryable ?? retryable);
    nextAction =
      (nested.nextAction as string | null | undefined) ??
      (nested.next_action as string | null | undefined) ??
      nextAction;
    details = (nested.details as Record<string, unknown> | null | undefined) ?? details;
  }
  return { errorCode, message, retryable, nextAction, details };
}

export function respondLegacy(
  reqOrCtx: Request | RequestContext | null | undefined,
  payload: unknown,
  init?: ResponseInit,
) {
  const ctx =
    reqOrCtx && typeof (reqOrCtx as RequestContext).requestId === "string"
      ? (reqOrCtx as RequestContext)
      : getRequestContext(reqOrCtx as Request | null | undefined);

  if (payload && typeof payload === "object" && "ok" in payload) {
    const legacy = payload as Record<string, unknown>;
    if (legacy.ok === true) {
      return respondOk(ctx, normalizeLegacySuccess(legacy), init);
    }
    if (legacy.ok === false) {
      const { errorCode, message, retryable, nextAction, details } =
        normalizeLegacyError(legacy);
      const status = typeof init?.status === "number" ? init.status : undefined;
      const canonical = status ? CANONICAL_ERROR_CODE_BY_STATUS[status] : undefined;
      const shouldCanonicalize = canonical && !isStableErrorCode(errorCode);
      const normalizedErrorCode = shouldCanonicalize ? canonical : errorCode;
      const normalizedDetails =
        shouldCanonicalize && errorCode && errorCode !== canonical
          ? { ...(details ?? {}), originalCode: errorCode }
          : details;
      return respondError(
        ctx,
        {
          errorCode: normalizedErrorCode,
          message,
          retryable,
          ...(nextAction ? { nextAction } : {}),
          ...(normalizedDetails ? { details: normalizedDetails } : {}),
        },
        init,
      );
    }
  }

  return respondOk(ctx, payload as unknown, init);
}
