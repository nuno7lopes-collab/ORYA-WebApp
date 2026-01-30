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
