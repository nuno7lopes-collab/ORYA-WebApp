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
import { ORYA_ORG_ID_HEADER } from "@/lib/http/headers";

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
  const pathMatch = req.nextUrl.pathname.match(/^\/(?:api\/)?org\/([^/]+)(?:\/|$)/i);
  if (pathMatch?.[1]) {
    const fromPath = parseOrganizationId(pathMatch[1]);
    if (fromPath) return fromPath;
  }

  const resolved = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  if (resolved) return resolved;

  const headerOrgId = parseOrganizationId(req.headers.get(ORYA_ORG_ID_HEADER));
  if (headerOrgId) return headerOrgId;

  if (options?.allowFallback) {
    return parseOrganizationId(req.cookies.get(ORGANIZATION_COOKIE_NAME)?.value);
  }
  return null;
}

type OrgIdSource = "query" | "body" | "payload";
export type OrgRequestSource = "path" | "query" | "header" | "body" | "cookie";

type OrgIdCandidate = {
  source: OrgRequestSource;
  raw: unknown;
  parsed: number | null;
  provided: boolean;
};

type StrictOrgResolutionOk = {
  ok: true;
  organizationId: number;
  source: OrgRequestSource;
  candidates: OrgIdCandidate[];
};

type StrictOrgResolutionErrMissing = {
  ok: false;
  reason: "MISSING";
  candidates: OrgIdCandidate[];
};

type StrictOrgResolutionErrInvalid = {
  ok: false;
  reason: "INVALID";
  source: OrgRequestSource;
  raw: unknown;
  candidates: OrgIdCandidate[];
};

type StrictOrgResolutionErrConflict = {
  ok: false;
  reason: "CONFLICT";
  values: number[];
  candidates: OrgIdCandidate[];
};

export type StrictOrgResolutionResult =
  | StrictOrgResolutionOk
  | StrictOrgResolutionErrMissing
  | StrictOrgResolutionErrInvalid
  | StrictOrgResolutionErrConflict;

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
    req.headers.get("x-amzn-trace-id") ||
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

function hasProvidedValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function buildOrgIdCandidate(source: OrgRequestSource, raw: unknown): OrgIdCandidate {
  return {
    source,
    raw,
    parsed: parseOrganizationId(raw),
    provided: hasProvidedValue(raw),
  };
}

function readBodyOrganizationId(body?: Record<string, unknown> | null): {
  hasValue: boolean;
  value: unknown;
} {
  if (!body || typeof body !== "object") {
    return { hasValue: false, value: undefined };
  }
  const hasValue = Object.prototype.hasOwnProperty.call(body, "organizationId");
  return { hasValue, value: hasValue ? body.organizationId : undefined };
}

export function resolveOrganizationIdStrict(input: {
  req: NextRequest;
  body?: Record<string, unknown> | null;
  allowFallback?: boolean;
}): StrictOrgResolutionResult {
  const { req, body, allowFallback = false } = input;
  const pathRaw = req.nextUrl.pathname.match(/^\/(?:api\/)?org\/([^/]+)(?:\/|$)/i)?.[1] ?? null;
  const queryRaw = req.nextUrl.searchParams.get("organizationId");
  const headerRaw = req.headers.get(ORYA_ORG_ID_HEADER);
  const bodyOrg = readBodyOrganizationId(body);
  const cookieRaw = allowFallback ? req.cookies.get(ORGANIZATION_COOKIE_NAME)?.value : undefined;

  const candidates: OrgIdCandidate[] = [
    buildOrgIdCandidate("path", pathRaw),
    buildOrgIdCandidate("query", queryRaw),
    buildOrgIdCandidate("header", headerRaw),
    buildOrgIdCandidate("body", bodyOrg.value),
    buildOrgIdCandidate("cookie", cookieRaw),
  ].filter((candidate) => candidate.source !== "body" || bodyOrg.hasValue);

  const provided = candidates.filter((candidate) => candidate.provided);
  if (provided.length === 0) {
    return { ok: false, reason: "MISSING", candidates };
  }

  const invalid = provided.find((candidate) => candidate.parsed === null);
  if (invalid) {
    return {
      ok: false,
      reason: "INVALID",
      source: invalid.source,
      raw: invalid.raw,
      candidates,
    };
  }

  const valid = provided.filter((candidate): candidate is OrgIdCandidate & { parsed: number } => candidate.parsed !== null);
  const values = Array.from(new Set(valid.map((candidate) => candidate.parsed)));
  if (values.length > 1) {
    return { ok: false, reason: "CONFLICT", values, candidates };
  }

  const precedence: OrgRequestSource[] = ["path", "query", "header", "body", "cookie"];
  const selectedSource = precedence.find((source) => valid.some((candidate) => candidate.source === source));
  const selected = valid.find((candidate) => candidate.source === selectedSource) ?? valid[0];
  return {
    ok: true,
    organizationId: selected.parsed,
    source: selected.source,
    candidates,
  };
}

export function requireOrganizationIdFromRequest(params: {
  req: NextRequest;
  actorId?: string | null;
}): { ok: true; organizationId: number } | { ok: false; response: NextResponse } {
  const { req, actorId = null } = params;
  const organizationId = resolveOrganizationIdFromRequest(req, { allowFallback: false });
  if (!organizationId) {
    const raw =
      req.nextUrl.searchParams.get("organizationId") ?? req.headers.get(ORYA_ORG_ID_HEADER) ?? null;
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
