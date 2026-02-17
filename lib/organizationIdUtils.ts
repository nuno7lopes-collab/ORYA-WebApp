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

export type OrgRouteParams = { orgId: number };

type QueryInput = URLSearchParams | Record<string, string | number | boolean | null | undefined> | undefined;

function normalizeSubpath(subpath: string | undefined) {
  if (!subpath || subpath === "/") return "";
  return subpath.startsWith("/") ? subpath : `/${subpath}`;
}

function mergeQuery(query?: QueryInput) {
  if (!query) return "";
  const params = new URLSearchParams(query instanceof URLSearchParams ? query : undefined);
  if (!(query instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || typeof value === "undefined") continue;
      params.set(key, String(value));
    }
  }
  const built = params.toString();
  return built ? `?${built}` : "";
}

export function buildOrgHref(orgId: number, subpath: string = "", query?: QueryInput): string {
  const validOrgId = parseOrganizationId(orgId);
  if (!validOrgId) {
    return `/org-hub/organizations${mergeQuery(query)}`;
  }
  return `/org/${validOrgId}${normalizeSubpath(subpath)}${mergeQuery(query)}`;
}

export function buildOrgHubHref(subpath: string = "", query?: QueryInput): string {
  return `/org-hub${normalizeSubpath(subpath)}${mergeQuery(query)}`;
}

export function parseOrgIdFromPathnameStrict(pathname: string | null | undefined): number | null {
  if (!pathname) return null;
  const canonicalMatch = pathname.match(/^\/org\/([^/]+)(?:\/|$)/i);
  return parseOrganizationId(canonicalMatch?.[1] ?? null);
}

const ORG_COOKIE_NAME = "orya_organization";
const ORG_STORAGE_KEY = "orya_last_organization_id";

export function getOrganizationIdFromBrowser(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(ORG_STORAGE_KEY);
    const parsed = parseOrganizationId(stored);
    if (parsed) return parsed;
  } catch {
    // ignore storage errors
  }
  try {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${ORG_COOKIE_NAME}=`));
    if (!cookie) return null;
    const raw = cookie.split("=")[1] ?? "";
    return parseOrganizationId(decodeURIComponent(raw));
  } catch {
    return null;
  }
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

export function parseOrganizationIdFromPathname(pathname: string | null | undefined): number | null {
  return parseOrgIdFromPathnameStrict(pathname);
}

const ORG_SHORTHAND_CANONICAL_SEGMENTS = new Set([
  "analytics",
  "analyze",
  "bookings",
  "calendar",
  "categorias",
  "chat",
  "check-in",
  "checkin",
  "crm",
  "events",
  "eventos",
  "finance",
  "forms",
  "inscricoes",
  "manage",
  "marketing",
  "padel",
  "profile",
  "promote",
  "reservas",
  "scan",
  "settings",
  "staff",
  "store",
  "team",
]);

function isOrgShorthandRoute(pathname: string) {
  const shorthandMatch = pathname.match(/^\/org\/([^/]+)(?:\/|$)/i);
  if (!shorthandMatch?.[1]) return false;
  const segment = shorthandMatch[1].trim().toLowerCase();
  if (!segment || /^\d+$/.test(segment)) return false;
  return ORG_SHORTHAND_CANONICAL_SEGMENTS.has(segment);
}

export function appendOrganizationIdToHref(href: string, organizationId: number | null): string {
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(href);
    const base = isAbsolute ? undefined : "http://local";
    const url = new URL(href, base);
    const pathname = url.pathname;
    const resolvedOrgId = parseOrganizationId(organizationId);
    const canonicalMatch = pathname.match(/^\/org\/([^/]+)(?:\/|$)/i);
    const canonicalOrgId = parseOrganizationId(canonicalMatch?.[1] ?? null);
    const isCanonicalOrgPath = Boolean(canonicalMatch && canonicalOrgId);
    const isOrgDashboardShorthand = /^\/org(?:\/overview)?$/i.test(pathname);

    if (isCanonicalOrgPath || pathname.startsWith("/org-hub")) {
      url.searchParams.delete("organizationId");
      url.searchParams.delete("org");
      if (isAbsolute) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (isOrgDashboardShorthand) {
      if (!resolvedOrgId) return href;
      url.pathname = buildOrgHref(resolvedOrgId, "/overview");
      url.searchParams.delete("organizationId");
      url.searchParams.delete("org");
      if (isAbsolute) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (resolvedOrgId && isOrgShorthandRoute(pathname)) {
      url.pathname = `/org/${resolvedOrgId}${pathname.slice("/org".length)}`;
      url.searchParams.delete("organizationId");
      url.searchParams.delete("org");
      if (isAbsolute) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return href;
  } catch {
    return href;
  }
}

export function setOrganizationIdInHref(href: string, organizationId: number | null): string {
  return appendOrganizationIdToHref(href, organizationId);
}
