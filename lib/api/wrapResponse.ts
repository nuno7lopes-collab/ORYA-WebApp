import { NextResponse } from "next/server";
import { buildResponseHeaders, getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import type { CanonicalApiErrorBase } from "@/lib/api/errors";

type EnvelopeSuccess = {
  ok: true;
  data: unknown;
  result?: unknown;
  meta?: Record<string, unknown>;
  requestId?: string;
  correlationId?: string;
};
type EnvelopeError = {
  ok: false;
  errorCode: CanonicalApiErrorBase["errorCode"];
  message: CanonicalApiErrorBase["message"];
  retryable?: CanonicalApiErrorBase["retryable"];
  nextAction?: string | null;
  details?: Record<string, unknown>;
  data?: unknown;
  error?: string;
  code?: string;
  requestId?: string;
  correlationId?: string;
  errorDetail?: Record<string, unknown>;
};

type WrapOptions = {
  status?: number;
  headers?: HeadersInit;
  req?: Request | null;
  ctx?: RequestContext | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnvelope(payload: unknown): payload is EnvelopeSuccess | EnvelopeError {
  if (!isRecord(payload)) return false;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.ok !== "boolean") return false;
  if (obj.ok === true) return "data" in obj || "result" in obj || "meta" in obj;
  if (obj.ok === false) {
    if (typeof obj.errorCode === "string" && typeof obj.message === "string") return true;
    const err = obj.error;
    return isRecord(err) && typeof err.errorCode === "string" && typeof err.message === "string";
  }
  return false;
}

function isErrorShape(payload: unknown) {
  if (!isRecord(payload)) return false;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.success === "boolean" && obj.success === false) return true;
  if (typeof obj.error === "string") return true;
  if (typeof obj.errorCode === "string" && typeof obj.message === "string") return true;
  if (typeof obj.error === "object" && obj.error !== null) {
    const err = obj.error as Record<string, unknown>;
    return typeof err.errorCode === "string" && typeof err.message === "string";
  }
  return false;
}

function resolveHeaderValue(headers: HeadersInit | undefined, name: string) {
  if (!headers) return undefined;
  const resolved = new Headers(headers).get(name);
  return resolved ?? undefined;
}

function resolveRequestMeta(payload: Record<string, unknown> | null, headers?: HeadersInit) {
  const requestId =
    (payload && typeof payload.requestId === "string" ? payload.requestId : undefined) ??
    resolveHeaderValue(headers, "x-orya-request-id") ??
    resolveHeaderValue(headers, "x-request-id");
  const correlationId =
    (payload && typeof payload.correlationId === "string" ? payload.correlationId : undefined) ??
    resolveHeaderValue(headers, "x-orya-correlation-id") ??
    resolveHeaderValue(headers, "x-correlation-id") ??
    requestId;
  return { requestId, correlationId };
}

function extractExtraDetails(payload: Record<string, unknown>, base?: Record<string, unknown>) {
  const {
    ok: _ok,
    success: _success,
    requestId: _requestId,
    correlationId: _correlationId,
    error: _error,
    errorCode: _errorCode,
    code: _code,
    message: _message,
    retryable: _retryable,
    nextAction: _nextAction,
    details: _details,
    data: _data,
    ...rest
  } = payload;
  const extra = Object.keys(rest).length > 0 ? (rest as Record<string, unknown>) : undefined;
  if (base && extra) return { ...base, ...extra };
  return base ?? extra;
}

function normalizeError(payload: Record<string, unknown>) {
  const baseRetryable = typeof payload.retryable === "boolean" ? payload.retryable : undefined;
  const baseNextAction = typeof payload.nextAction === "string" ? payload.nextAction : undefined;
  const baseDetails =
    typeof payload.details === "object" && payload.details !== null
      ? (payload.details as Record<string, unknown>)
      : undefined;

  if (typeof payload.error === "object" && payload.error !== null) {
    const err = payload.error as Record<string, unknown>;
    const errorCode =
      (err.errorCode as string | undefined) ??
      (err.code as string | undefined) ??
      (payload.errorCode as string | undefined) ??
      (payload.code as string | undefined) ??
      "ERROR";
    const message =
      (err.message as string | undefined) ??
      (payload.message as string | undefined) ??
      (typeof payload.error === "string" ? (payload.error as string) : undefined) ??
      String(errorCode);
    const retryable =
      typeof err.retryable === "boolean" ? err.retryable : baseRetryable;
    const nextAction =
      typeof err.nextAction === "string"
        ? err.nextAction
        : typeof (err as any).next_action === "string"
          ? String((err as any).next_action)
          : baseNextAction;
    const details =
      typeof err.details === "object" && err.details !== null
        ? (err.details as Record<string, unknown>)
        : extractExtraDetails(payload, baseDetails);
    return {
      errorCode: String(errorCode),
      message: String(message),
      ...(retryable !== undefined ? { retryable } : {}),
      ...(nextAction ? { nextAction } : {}),
      ...(details ? { details } : {}),
    };
  }

  const errorCode =
    (payload.errorCode as string | undefined) ??
    (payload.code as string | undefined) ??
    (typeof payload.error === "string" ? payload.error : undefined) ??
    "ERROR";
  const message =
    (payload.message as string | undefined) ??
    (typeof payload.error === "string" ? payload.error : undefined) ??
    String(errorCode);
  const details = extractExtraDetails(payload, baseDetails);
  return {
    errorCode: String(errorCode),
    message: String(message),
    ...(baseRetryable !== undefined ? { retryable: baseRetryable } : {}),
    ...(baseNextAction ? { nextAction: baseNextAction } : {}),
    ...(details ? { details } : {}),
  };
}

function buildSuccessEnvelope(payload: Record<string, unknown>, headers?: HeadersInit): EnvelopeSuccess {
  const { requestId, correlationId } = resolveRequestMeta(payload, headers);
  const {
    ok: _ok,
    success: _success,
    requestId: _requestId,
    correlationId: _correlationId,
    data: payloadData,
    result: payloadResult,
    meta,
    ...rest
  } = payload;

  const data =
    payloadData ??
    payloadResult ??
    (Object.keys(rest).length > 0 ? rest : null);

  const response: Record<string, unknown> = {
    ok: true,
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(payloadData !== undefined ? { data: payloadData } : { data }),
    ...(payloadResult !== undefined ? { result: payloadResult } : { result: data }),
    ...rest,
  };

  if (meta) response.meta = meta;
  return response as EnvelopeSuccess;
}

function buildErrorEnvelope(payload: Record<string, unknown>, headers?: HeadersInit): EnvelopeError {
  const { requestId, correlationId } = resolveRequestMeta(payload, headers);
  const normalized = normalizeError(payload);
  const {
    ok: _ok,
    success: _success,
    requestId: _requestId,
    correlationId: _correlationId,
    error: payloadError,
    errorCode: _errorCode,
    code: payloadCode,
    message: _message,
    retryable: _retryable,
    nextAction: _nextAction,
    details: _details,
    data: payloadData,
    ...rest
  } = payload;

  const retryable = typeof normalized.retryable === "boolean" ? normalized.retryable : false;

  const response: Record<string, unknown> = {
    ok: false,
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
    errorCode: normalized.errorCode,
    message: normalized.message,
    retryable,
    ...(normalized.nextAction ? { nextAction: normalized.nextAction } : {}),
    ...(normalized.details ? { details: normalized.details } : {}),
    ...(payloadData !== undefined
      ? { data: payloadData }
      : normalized.details
        ? { data: normalized.details }
        : {}),
    code: typeof payloadCode === "string" ? payloadCode : normalized.errorCode,
    error: typeof payloadError === "string" ? payloadError : normalized.message,
    ...rest,
  };

  if (isRecord(payloadError)) {
    response.errorDetail = payloadError;
  }

  return response as EnvelopeError;
}

export function jsonWrap(payload: unknown, opts: WrapOptions = {}) {
  const ctx =
    opts.ctx ??
    getRequestContext(
      opts.req ?? (opts.headers ? { headers: new Headers(opts.headers) } : null),
    );
  const headers = buildResponseHeaders(ctx, opts.headers);

  if (payload instanceof Response) {
    return new Response(payload.body, {
      status: payload.status,
      statusText: payload.statusText,
      headers: buildResponseHeaders(ctx, payload.headers),
    });
  }
  if (isRecord(payload) && isEnvelope(payload)) {
    const envelope = payload.ok ? buildSuccessEnvelope(payload, headers) : buildErrorEnvelope(payload, headers);
    return NextResponse.json(envelope, { status: opts.status, headers });
  }
  if (isRecord(payload)) {
    const obj = payload as Record<string, unknown>;
    if (obj.ok === true) {
      return NextResponse.json(buildSuccessEnvelope(obj, headers), {
        status: opts.status,
        headers,
      });
    }
    if (obj.ok === false && ("error" in obj || "errorCode" in obj || "message" in obj || "code" in obj)) {
      const status = opts.status ?? 400;
      return NextResponse.json(buildErrorEnvelope(obj, headers), { status, headers });
    }
    if (typeof obj.success === "boolean") {
      if (obj.success) {
        return NextResponse.json(buildSuccessEnvelope(obj, headers), {
          status: opts.status,
          headers,
        });
      }
      const status = opts.status ?? 400;
      return NextResponse.json(buildErrorEnvelope(obj, headers), { status, headers });
    }
  }
  if (isRecord(payload) && isErrorShape(payload)) {
    const status = opts.status ?? 400;
    return NextResponse.json(buildErrorEnvelope(payload, headers), { status, headers });
  }
  const { requestId, correlationId } = resolveRequestMeta(null, headers);
  const response: EnvelopeSuccess = {
    ok: true,
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
    data: payload,
    result: payload,
  };
  return NextResponse.json(response, { status: opts.status, headers });
}
