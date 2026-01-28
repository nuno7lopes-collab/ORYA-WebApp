import { NextResponse } from "next/server";
import { buildResponseHeaders, type RequestContext } from "@/lib/http/requestContext";

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
};

export type Envelope<T = unknown> = EnvelopeSuccess<T> | EnvelopeError;

export type EnvelopeErrorInput = {
  errorCode: string;
  message: string;
  retryable?: boolean;
  nextAction?: string | null;
  details?: Record<string, unknown> | null;
};

export function successEnvelope<T>(ctx: RequestContext, data: T): EnvelopeSuccess<T> {
  return {
    ok: true,
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    data,
  };
}

export function errorEnvelope(ctx: RequestContext, input: EnvelopeErrorInput): EnvelopeError {
  return {
    ok: false,
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    errorCode: input.errorCode,
    message: input.message,
    retryable: input.retryable ?? false,
    ...(input.nextAction ? { nextAction: input.nextAction } : {}),
    ...(input.details ? { details: input.details } : {}),
  };
}

export function respondOk<T>(ctx: RequestContext, data: T, init?: ResponseInit) {
  const headers = buildResponseHeaders(ctx, init?.headers);
  return NextResponse.json(successEnvelope(ctx, data), { ...init, headers });
}

export function respondError(ctx: RequestContext, input: EnvelopeErrorInput, init?: ResponseInit) {
  const headers = buildResponseHeaders(ctx, init?.headers);
  return NextResponse.json(errorEnvelope(ctx, input), { ...init, headers });
}

export function respondPlainText(ctx: RequestContext, text: string, init?: ResponseInit) {
  const headers = buildResponseHeaders(ctx, init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/plain; charset=utf-8");
  }
  return new Response(text, { ...init, headers });
}
