import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  appendOrganizationIdToHref,
  parseOrganizationId,
  resolveOrganizationIdForUi,
  resolveOrganizationIdFromParams,
} from "@/lib/organizationIdUtils";

export const ORGANIZATION_COOKIE_NAME = "orya_organization";

export { parseOrganizationId, resolveOrganizationIdForUi, resolveOrganizationIdFromParams };

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

export function resolveOrganizationIdFromSearchParams(searchParams?: SearchParamsLike): number | null {
  if (!searchParams) return null;
  if (searchParams instanceof URLSearchParams) {
    return resolveOrganizationIdFromParams(searchParams);
  }
  const raw = searchParams.organizationId;
  if (Array.isArray(raw)) return parseOrganizationId(raw[0]);
  return parseOrganizationId(raw);
}

export async function appendOrganizationIdToRedirectHref(
  href: string,
  searchParams?: SearchParamsLike,
): Promise<string> {
  const orgId = resolveOrganizationIdFromSearchParams(searchParams) ?? (await resolveOrganizationIdFromCookies());
  return appendOrganizationIdToHref(href, orgId);
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
  const allowFallback = typeof options?.allowFallback === "boolean" ? options.allowFallback : null;
  if (allowFallback === true) {
    return parseOrganizationId(req.cookies.get(ORGANIZATION_COOKIE_NAME)?.value);
  }
  if (allowFallback === false) return null;
  const method = req.method?.toUpperCase() ?? "";
  const isOrgApi = req.nextUrl.pathname.startsWith("/api/organizacao");
  if ((method === "GET" || method === "HEAD") && isOrgApi) {
    return parseOrganizationId(req.cookies.get(ORGANIZATION_COOKIE_NAME)?.value);
  }
  return null;
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
