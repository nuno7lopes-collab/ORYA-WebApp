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

export function appendOrganizationIdToHref(href: string, organizationId: number | null): string {
  if (!organizationId || !Number.isFinite(organizationId)) return href;
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(href);
    const base = isAbsolute ? undefined : "http://local";
    const url = new URL(href, base);
    if (!url.pathname.startsWith("/organizacao")) return href;
    if (url.searchParams.has("organizationId")) return href;
    url.searchParams.set("organizationId", String(organizationId));
    if (isAbsolute) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function setOrganizationIdInHref(href: string, organizationId: number | null): string {
  if (!organizationId || !Number.isFinite(organizationId)) return href;
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(href);
    const base = isAbsolute ? undefined : "http://local";
    const url = new URL(href, base);
    if (!url.pathname.startsWith("/organizacao")) return href;
    url.searchParams.set("organizationId", String(organizationId));
    if (isAbsolute) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
