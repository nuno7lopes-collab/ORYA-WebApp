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

export function parseOrganizationIdFromPathname(pathname: string | null | undefined): number | null {
  if (!pathname) return null;
  const canonicalMatch = pathname.match(/^\/org\/([^/]+)(?:\/|$)/i);
  if (canonicalMatch?.[1]) {
    return parseOrganizationId(canonicalMatch[1]);
  }
  const legacyMatch = pathname.match(/^\/organizacao\/([^/]+)(?:\/|$)/i);
  if (legacyMatch?.[1]) {
    return parseOrganizationId(legacyMatch[1]);
  }
  return null;
}

function resolveCanonicalOrgHref(
  pathname: string,
  currentSearch: URLSearchParams,
  organizationId: number,
): { pathname: string; search: URLSearchParams } | null {
  if (!pathname.startsWith("/organizacao")) return null;

  const suffix = pathname.slice("/organizacao".length);
  const nextSearch = new URLSearchParams(currentSearch);
  nextSearch.delete("organizationId");

  if (suffix === "" || suffix === "/" || suffix === "/overview") {
    const tab = nextSearch.get("tab");
    const section = nextSearch.get("section");
    nextSearch.delete("tab");
    nextSearch.delete("section");
    if (tab === "manage") {
      return { pathname: `/org/${organizationId}/manage`, search: nextSearch };
    }
    if (tab === "promote") {
      return { pathname: `/org/${organizationId}/promote`, search: nextSearch };
    }
    if (tab === "profile") {
      return { pathname: `/org/${organizationId}/profile`, search: nextSearch };
    }
    if (tab === "analyze") {
      if (section === "financas" || section === "invoices") {
        if (section === "invoices") nextSearch.set("tab", "invoices");
        return { pathname: `/org/${organizationId}/financas`, search: nextSearch };
      }
      if (section === "ops") {
        nextSearch.set("tab", "ops");
      } else if (section === "vendas") {
        nextSearch.set("tab", "vendas");
      } else {
        nextSearch.set("tab", "overview");
      }
      return { pathname: `/org/${organizationId}/analytics`, search: nextSearch };
    }
    return { pathname: `/org/${organizationId}/overview`, search: nextSearch };
  }

  if (suffix === "/manage") {
    return { pathname: `/org/${organizationId}/manage`, search: nextSearch };
  }

  if (suffix === "/promote") {
    return { pathname: `/org/${organizationId}/promote`, search: nextSearch };
  }

  if (suffix === "/profile") {
    return { pathname: `/org/${organizationId}/profile`, search: nextSearch };
  }

  if (suffix === "/scan") {
    if (!nextSearch.get("tab")) {
      nextSearch.set("tab", "scanner");
    }
    return { pathname: `/org/${organizationId}/checkin`, search: nextSearch };
  }

  if (suffix === "/reservas" || suffix.startsWith("/reservas/")) {
    return { pathname: `/org/${organizationId}/servicos`, search: nextSearch };
  }

  if (suffix === "/settings" || suffix.startsWith("/settings/") || suffix.startsWith("/owner/confirm")) {
    return { pathname: `/org/${organizationId}/settings`, search: nextSearch };
  }

  if (suffix === "/pagamentos" || suffix.startsWith("/pagamentos/") || suffix === "/faturacao") {
    return { pathname: `/org/${organizationId}/financas`, search: nextSearch };
  }

  if (suffix === "/estatisticas") {
    return { pathname: `/org/${organizationId}/analytics`, search: nextSearch };
  }

  if (suffix === "/analyze") {
    const section = nextSearch.get("section");
    nextSearch.delete("section");
    if (section === "financas" || section === "invoices") {
      if (section === "invoices") nextSearch.set("tab", "invoices");
      return { pathname: `/org/${organizationId}/financas`, search: nextSearch };
    }
    if (section === "ops") {
      nextSearch.set("tab", "ops");
    } else if (section === "vendas") {
      nextSearch.set("tab", "vendas");
    } else if (!nextSearch.get("tab")) {
      nextSearch.set("tab", "overview");
    }
    return { pathname: `/org/${organizationId}/analytics`, search: nextSearch };
  }

  if (suffix === "/profile/seguidores") {
    return { pathname: `/org/${organizationId}/perfil/seguidores`, search: nextSearch };
  }

  if (suffix === "/loja") {
    return { pathname: `/org/${organizationId}/loja`, search: nextSearch };
  }

  return null;
}

export function appendOrganizationIdToHref(href: string, organizationId: number | null): string {
  if (!organizationId || !Number.isFinite(organizationId)) return href;
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(href);
    const base = isAbsolute ? undefined : "http://local";
    const url = new URL(href, base);
    const canonical = resolveCanonicalOrgHref(url.pathname, url.searchParams, organizationId);
    if (canonical) {
      url.pathname = canonical.pathname;
      url.search = canonical.search.toString() ? `?${canonical.search.toString()}` : "";
      if (isAbsolute) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    }
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
    const canonical = resolveCanonicalOrgHref(url.pathname, url.searchParams, organizationId);
    if (canonical) {
      url.pathname = canonical.pathname;
      url.search = canonical.search.toString() ? `?${canonical.search.toString()}` : "";
      if (isAbsolute) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (!url.pathname.startsWith("/organizacao")) return href;
    url.searchParams.set("organizationId", String(organizationId));
    if (isAbsolute) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
