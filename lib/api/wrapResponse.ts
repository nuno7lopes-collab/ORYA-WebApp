import { NextResponse } from "next/server";

type EnvelopeSuccess = { ok: true; result: unknown; meta?: Record<string, unknown> };
type EnvelopeError = {
  ok: false;
  error: {
    errorCode: string;
    message: string;
    retryable?: boolean;
    nextAction?: string | null;
    details?: Record<string, unknown>;
  };
};

type WrapOptions = {
  status?: number;
  headers?: HeadersInit;
};

function isEnvelope(payload: unknown): payload is EnvelopeSuccess | EnvelopeError {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.ok !== "boolean") return false;
  if (obj.ok === true) return "result" in obj || "meta" in obj;
  if (obj.ok === false) {
    const err = obj.error;
    return (
      typeof err === "object" &&
      err !== null &&
      typeof (err as Record<string, unknown>).errorCode === "string" &&
      typeof (err as Record<string, unknown>).message === "string"
    );
  }
  return false;
}

function isErrorShape(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
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

function extractExtraDetails(payload: Record<string, unknown>, base?: Record<string, unknown>) {
  const {
    ok: _ok,
    success: _success,
    error: _error,
    errorCode: _errorCode,
    code: _code,
    message: _message,
    retryable: _retryable,
    nextAction: _nextAction,
    details: _details,
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

export function jsonWrap(payload: unknown, opts: WrapOptions = {}) {
  if (payload instanceof Response) return payload;
  if (isEnvelope(payload)) {
    return NextResponse.json(payload, { status: opts.status, headers: opts.headers });
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (obj.ok === true) {
      if ("data" in obj && !("result" in obj)) {
        return NextResponse.json(
          { ok: true, result: obj.data, ...(obj.meta ? { meta: obj.meta } : {}) },
          { status: opts.status, headers: opts.headers },
        );
      }
      const { ok: _ok, requestId: _requestId, correlationId: _correlationId, ...rest } = obj;
      const result =
        "result" in obj
          ? obj.result
          : "data" in obj
            ? obj.data
            : Object.keys(rest).length > 0
              ? rest
              : null;
      return NextResponse.json({ ok: true, result }, { status: opts.status, headers: opts.headers });
    }
    if (obj.ok === false && ("error" in obj || "errorCode" in obj || "message" in obj)) {
      const error = normalizeError(obj);
      const status = opts.status ?? 400;
      return NextResponse.json({ ok: false, error }, { status, headers: opts.headers });
    }
    if (typeof obj.success === "boolean") {
      if (obj.success) {
        const { success: _success, error: _error, errorCode: _errorCode, message: _message, meta: _meta, ...rest } = obj;
        const result =
          "data" in obj
            ? obj.data
            : "result" in obj
              ? obj.result
              : Object.keys(rest).length > 0
                ? rest
                : null;
        return NextResponse.json({ ok: true, result }, { status: opts.status, headers: opts.headers });
      }
      const error = normalizeError(obj);
      const status = opts.status ?? 400;
      return NextResponse.json({ ok: false, error }, { status, headers: opts.headers });
    }
  }
  if (payload && typeof payload === "object" && isErrorShape(payload)) {
    const error = normalizeError(payload as Record<string, unknown>);
    const status = opts.status ?? 400;
    return NextResponse.json({ ok: false, error }, { status, headers: opts.headers });
  }
  return NextResponse.json({ ok: true, result: payload }, { status: opts.status, headers: opts.headers });
}
