import {
  getOrganizationIdFromBrowser,
  parseOrganizationId,
  parseOrgIdFromPathnameStrict,
} from "@/lib/organizationIdUtils";

function mapLegacySuffix(suffix: string) {
  // Canonical org namespace in this repo keeps PT segment names.
  return suffix;
}

function resolveCurrentOrgId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const query = new URLSearchParams(window.location.search);
    const fromQuery =
      parseOrganizationId(query.get("organizationId")) ??
      parseOrganizationId(query.get("org"));
    if (fromQuery) return fromQuery;
  } catch {
    // ignore query parse errors
  }

  const fromPath = parseOrgIdFromPathnameStrict(window.location.pathname);
  if (fromPath) return fromPath;
  return getOrganizationIdFromBrowser();
}

export function resolveCanonicalOrgApiPath(
  input: string,
  explicitOrgId?: number | null,
) {
  if (!input) return input;
  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(input);
  const base = isAbsolute ? undefined : "http://local";
  let parsed: URL;
  try {
    parsed = new URL(input, base);
  } catch {
    return input;
  }

  const pathname = parsed.pathname;
  if (pathname.startsWith("/api/org/")) {
    const orgMatch = pathname.match(/^\/api\/org\/([^/]+)(.*)$/);
    if (!orgMatch) return input;
    const orgSegment = orgMatch[1];
    if (orgSegment !== "[orgId]" && orgSegment !== ":orgId") {
      return input;
    }
    const nextSearch = new URLSearchParams(parsed.searchParams);
    const orgIdFromQuery =
      parseOrganizationId(nextSearch.get("organizationId")) ??
      parseOrganizationId(nextSearch.get("org"));
    const resolvedOrgId =
      parseOrganizationId(explicitOrgId) ?? orgIdFromQuery ?? resolveCurrentOrgId();
    if (!resolvedOrgId) return input;
    nextSearch.delete("organizationId");
    nextSearch.delete("org");
    parsed.pathname = `/api/org/${resolvedOrgId}${orgMatch[2] ?? ""}`;
    parsed.search = nextSearch.toString() ? `?${nextSearch.toString()}` : "";
    return isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (
    pathname.startsWith("/api/org-hub/") ||
    pathname.startsWith("/api/org-system/")
  ) {
    return input;
  }
  if (!pathname.startsWith("/api/organizacao")) {
    return input;
  }

  const suffix = pathname.slice("/api/organizacao".length) || "/";
  const nextSearch = new URLSearchParams(parsed.searchParams);

  // Padel/tournaments stay on legacy namespace during current migration cycle.
  if (/^\/(padel|tournaments|torneios)(\/|$)/i.test(suffix)) {
    return input;
  }

  if (suffix === "/become") {
    parsed.pathname = "/api/org-hub/become";
    parsed.search = nextSearch.toString() ? `?${nextSearch.toString()}` : "";
    return isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (suffix.startsWith("/organizations")) {
    parsed.pathname = `/api/org-hub${suffix}`;
    parsed.search = nextSearch.toString() ? `?${nextSearch.toString()}` : "";
    return isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (suffix === "/invites" || suffix.startsWith("/invites/")) {
    parsed.pathname = `/api/org-hub${suffix}`;
    parsed.search = nextSearch.toString() ? `?${nextSearch.toString()}` : "";
    return isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (suffix === "/payouts/webhook") {
    parsed.pathname = "/api/org-system/payouts/webhook";
    parsed.search = nextSearch.toString() ? `?${nextSearch.toString()}` : "";
    return isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  const orgIdFromQuery =
    parseOrganizationId(nextSearch.get("organizationId")) ??
    parseOrganizationId(nextSearch.get("org"));
  const resolvedOrgId =
    parseOrganizationId(explicitOrgId) ?? orgIdFromQuery ?? resolveCurrentOrgId();
  if (!resolvedOrgId) return input;

  nextSearch.delete("organizationId");
  nextSearch.delete("org");

  parsed.pathname = `/api/org/${resolvedOrgId}${mapLegacySuffix(suffix)}`;
  parsed.search = nextSearch.toString() ? `?${nextSearch.toString()}` : "";
  return isAbsolute
    ? parsed.toString()
    : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
