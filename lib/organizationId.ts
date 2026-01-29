import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const ORGANIZATION_COOKIE_NAME = "orya_organization";

export function parseOrganizationId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveOrganizationIdFromParams(params: URLSearchParams): number | null {
  return parseOrganizationId(params.get("organizationId"));
}

export async function resolveOrganizationIdFromCookies(): Promise<number | null> {
  try {
    const cookieStore = await cookies();
    return parseOrganizationId(cookieStore.get(ORGANIZATION_COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

export function resolveOrganizationIdFromRequest(
  req: NextRequest,
  options?: { allowFallback?: boolean },
): number | null {
  const resolved = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  if (resolved) return resolved;
  if (!options?.allowFallback) return null;
  return parseOrganizationId(req.cookies.get(ORGANIZATION_COOKIE_NAME)?.value);
}

type OrgIdSource = "query" | "body" | "payload";

type OrgIdLogContext = {
  reason: string;
  path?: string | null;
  actorId?: string | null;
  requestId?: string | null;
  organizationId?: number | null;
  jobName?: string | null;
  payloadKeys?: string[];
};

function resolveRequestId(req: NextRequest): string | null {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    req.headers.get("x-vercel-id") ||
    null
  );
}

function logOrgIdIssue(context: OrgIdLogContext) {
  const {
    reason,
    path = null,
    actorId = null,
    requestId = null,
    organizationId = null,
    jobName = null,
    payloadKeys = [],
  } = context;
  console.warn("[org-context]", {
    reason,
    path,
    actorId,
    requestId,
    organizationId,
    jobName,
    payloadKeys,
  });
}

export function requireOrganizationIdFromRequest(params: {
  req: NextRequest;
  paramName?: string;
  actorId?: string | null;
}): { ok: true; organizationId: number } | { ok: false; response: NextResponse } {
  const { req, paramName = "organizationId", actorId = null } = params;
  const raw = req.nextUrl.searchParams.get(paramName);
  const organizationId = parseOrganizationId(raw);
  if (!organizationId) {
    const reason = raw ? "invalid_orgId_in_request" : "missing_orgId_in_request";
    logOrgIdIssue({
      reason,
      path: `${req.nextUrl.pathname}${req.nextUrl.search}`,
      actorId,
      requestId: resolveRequestId(req),
      organizationId,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: raw ? "INVALID_ORG_ID" : "ORG_ID_REQUIRED" },
        { status: 400 },
      ),
    };
  }
  return { ok: true, organizationId };
}

export function requireOrganizationIdFromPayload(params: {
  payload: Record<string, unknown> | null | undefined;
  actorId?: string | null;
  jobName: string;
  source?: OrgIdSource;
  requestId?: string | null;
}): { ok: true; organizationId: number } | { ok: false } {
  const { payload, actorId = null, jobName, source = "payload", requestId = null } = params;
  const raw = payload?.organizationId ?? null;
  const organizationId = parseOrganizationId(raw);
  if (!organizationId) {
    const reason = raw ? "invalid_orgId_in_job_payload" : "missing_orgId_in_job_payload";
    logOrgIdIssue({
      reason,
      actorId,
      requestId,
      organizationId,
      jobName,
      payloadKeys: Object.keys(payload ?? {}).sort(),
    });
    return { ok: false };
  }
  return { ok: true, organizationId };
}

export function resolveOrganizationIdForUi(input: {
  directOrganizationId?: unknown;
  profileOrganizationId?: unknown;
  cookieOrganizationId?: unknown;
}): { organizationId: number | null; source: "direct" | "profile" | "cookie" | null } {
  const direct = parseOrganizationId(input.directOrganizationId);
  if (direct) return { organizationId: direct, source: "direct" };
  const profile = parseOrganizationId(input.profileOrganizationId);
  if (profile) return { organizationId: profile, source: "profile" };
  const cookie = parseOrganizationId(input.cookieOrganizationId);
  if (cookie) return { organizationId: cookie, source: "cookie" };
  return { organizationId: null, source: null };
}
