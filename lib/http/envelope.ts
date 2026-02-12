import { NextResponse } from "next/server";
import {
  buildResponseHeaders,
  type RequestContext,
} from "@/lib/http/requestContext";
import type { CanonicalApiErrorBase, CanonicalApiErrorInput } from "@/lib/api/errors";

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
  errorCode: CanonicalApiErrorBase["errorCode"];
  message: CanonicalApiErrorBase["message"];
  retryable: CanonicalApiErrorBase["retryable"];
  nextAction?: string | null;
  details?: Record<string, unknown> | null;
  data?: unknown;
  error?: string;
  code?: string;
};

export type Envelope<T = unknown> = EnvelopeSuccess<T> | EnvelopeError;

export type EnvelopeErrorInput = CanonicalApiErrorInput & {
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
