import { headers as nextHeaders } from "next/headers";
import type { NextRequest } from "next/server";
import {
  CORRELATION_ID_HEADER,
  ORYA_CORRELATION_ID_HEADER,
  ORYA_REQUEST_ID_HEADER,
  REQUEST_ID_HEADER,
} from "@/lib/http/headers";

type HeaderSource = {
  get(name: string): string | null;
};

type RequestWithHeaders = Pick<Request, "headers"> | Pick<NextRequest, "headers">;

export type RequestContext = {
  requestId: string;
  correlationId: string;
  orgId: number | null;
};

function normalize(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function pickHeader(headers: HeaderSource, names: string[]) {
  for (const name of names) {
    const value = normalize(headers.get(name));
    if (value) return value;
  }
  return null;
}

function normalizeOrgId(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function generateId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function resolveRequestContext(
  headers: HeaderSource,
  opts?: { orgId?: number | null },
): RequestContext {
  const requestId =
    pickHeader(headers, [ORYA_REQUEST_ID_HEADER, REQUEST_ID_HEADER]) ?? generateId();
  const correlationId =
    pickHeader(headers, [ORYA_CORRELATION_ID_HEADER, CORRELATION_ID_HEADER]) ?? requestId;
  const orgId =
    typeof opts?.orgId === "number" ? opts.orgId : normalizeOrgId(headers.get("x-org-id"));

  return { requestId, correlationId, orgId: orgId ?? null };
}

export function getRequestContext(
  req?: RequestWithHeaders | null,
  opts?: { orgId?: number | null },
): RequestContext {
  if (req?.headers) return resolveRequestContext(req.headers, opts);
  try {
    const hdrs = nextHeaders();
    return resolveRequestContext(hdrs, opts);
  } catch {
    const requestId = generateId();
    return {
      requestId,
      correlationId: requestId,
      orgId: typeof opts?.orgId === "number" ? opts.orgId : null,
    };
  }
}

export function buildResponseHeaders(ctx: RequestContext, existing?: HeadersInit) {
  const headers = new Headers(existing);
  headers.set(ORYA_REQUEST_ID_HEADER, ctx.requestId);
  headers.set(ORYA_CORRELATION_ID_HEADER, ctx.correlationId);
  headers.set(REQUEST_ID_HEADER, ctx.requestId);
  headers.set(CORRELATION_ID_HEADER, ctx.correlationId);
  if (ctx.orgId !== null) {
    headers.set("x-org-id", String(ctx.orgId));
  }
  return headers;
}
