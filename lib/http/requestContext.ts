import crypto from "crypto";
import type { NextRequest } from "next/server";

type RequestWithHeaders = Pick<Request, "headers"> | Pick<NextRequest, "headers">;

export type RequestContext = {
  requestId: string;
  correlationId: string;
  orgId: number | null;
};

function resolveHeaderValue(req: RequestWithHeaders | null | undefined, name: string) {
  return req?.headers?.get(name) ?? null;
}

function normalizeOrgId(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getRequestContext(
  req?: RequestWithHeaders | null,
  opts?: { orgId?: number | null },
): RequestContext {
  const requestId =
    resolveHeaderValue(req, "x-orya-request-id") ??
    resolveHeaderValue(req, "x-request-id") ??
    crypto.randomUUID();
  const correlationId =
    resolveHeaderValue(req, "x-orya-correlation-id") ??
    resolveHeaderValue(req, "x-correlation-id") ??
    requestId;
  const orgIdHeader = resolveHeaderValue(req, "x-org-id");
  const orgId = typeof opts?.orgId === "number" ? opts.orgId : normalizeOrgId(orgIdHeader);

  return {
    requestId,
    correlationId,
    orgId: orgId ?? null,
  };
}

export function buildResponseHeaders(ctx: RequestContext, existing?: HeadersInit) {
  const headers = new Headers(existing);
  headers.set("x-orya-request-id", ctx.requestId);
  headers.set("x-orya-correlation-id", ctx.correlationId);
  headers.set("x-request-id", ctx.requestId);
  headers.set("x-correlation-id", ctx.correlationId);
  if (ctx.orgId !== null) {
    headers.set("x-org-id", String(ctx.orgId));
  }
  return headers;
}
