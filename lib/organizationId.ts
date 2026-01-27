import { cookies } from "next/headers";
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
