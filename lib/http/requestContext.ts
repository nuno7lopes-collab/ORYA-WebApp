import type { NextRequest } from "next/server";

type RequestWithHeaders = Pick<Request, "headers"> | Pick<NextRequest, "headers">;

type RequestContext = {
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
  const requestId = resolveHeaderValue(req, "x-request-id") ?? crypto.randomUUID();
  const correlationId = resolveHeaderValue(req, "x-correlation-id") ?? requestId;
  const orgIdHeader = resolveHeaderValue(req, "x-org-id");
  const orgId = typeof opts?.orgId === "number" ? opts.orgId : normalizeOrgId(orgIdHeader);

  return {
    requestId,
    correlationId,
    orgId: orgId ?? null,
  };
}
