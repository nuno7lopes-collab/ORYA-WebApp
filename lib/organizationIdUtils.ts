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

export function resolveCanonicalOrgHref(
  pathname: string,
  currentSearch: URLSearchParams,
  organizationId: number | null,
): { pathname: string; search: URLSearchParams } | null {
  if (!pathname.startsWith("/organizacao")) return null;

  const suffix = pathname.slice("/organizacao".length);
  const nextSearch = new URLSearchParams(currentSearch);
  nextSearch.delete("organizationId");

  if (suffix === "/organizations") {
    return { pathname: buildOrgHubHref("/organizations"), search: nextSearch };
  }

  if (suffix === "/become") {
    return { pathname: buildOrgHubHref("/create"), search: nextSearch };
  }

  if ((suffix === "" || suffix === "/" || suffix === "/overview") && (!organizationId || !Number.isFinite(organizationId))) {
    return { pathname: buildOrgHubHref("/organizations"), search: nextSearch };
  }

  if (!organizationId || !Number.isFinite(organizationId)) return null;

  if (suffix === "" || suffix === "/" || suffix === "/overview") {
    const tab = nextSearch.get("tab");
    const section = nextSearch.get("section");
    nextSearch.delete("tab");
    nextSearch.delete("section");
    if (tab === "manage") {
      return { pathname: buildOrgHref(organizationId, "/operations"), search: nextSearch };
    }
    if (tab === "promote") {
      return { pathname: buildOrgHref(organizationId, "/marketing"), search: nextSearch };
    }
    if (tab === "profile") {
      return { pathname: buildOrgHref(organizationId, "/profile"), search: nextSearch };
    }
    if (tab === "analyze") {
      if (section === "financas" || section === "invoices") {
        return {
          pathname: section === "invoices" ? buildOrgHref(organizationId, "/finance/invoices") : buildOrgHref(organizationId, "/finance"),
          search: nextSearch,
        };
      }
      if (section === "ops") {
        nextSearch.set("tab", "ops");
      } else if (section === "vendas") {
        nextSearch.set("tab", "vendas");
      } else {
        nextSearch.set("tab", "overview");
      }
      return { pathname: buildOrgHref(organizationId, "/analytics"), search: nextSearch };
    }
    return { pathname: buildOrgHref(organizationId, "/overview"), search: nextSearch };
  }

  if (suffix === "/manage") {
    return { pathname: buildOrgHref(organizationId, "/operations"), search: nextSearch };
  }

  if (suffix === "/promote" || suffix === "/promo") {
    return { pathname: buildOrgHref(organizationId, "/marketing"), search: nextSearch };
  }

  if (suffix === "/profile") {
    return { pathname: buildOrgHref(organizationId, "/profile"), search: nextSearch };
  }

  if (suffix === "/profile/seguidores") {
    return { pathname: buildOrgHref(organizationId, "/profile/followers"), search: nextSearch };
  }

  if (suffix === "/scan") {
    return { pathname: buildOrgHref(organizationId, "/check-in"), search: nextSearch };
  }

  if (suffix === "/chat" || suffix === "/mensagens") {
    return { pathname: buildOrgHref(organizationId, "/chat"), search: nextSearch };
  }

  if (suffix === "/chat/preview") {
    return { pathname: buildOrgHref(organizationId, "/chat/preview"), search: nextSearch };
  }

  if (suffix === "/settings/verify") {
    return { pathname: buildOrgHref(organizationId, "/settings/verify"), search: nextSearch };
  }

  if (suffix === "/settings" || suffix.startsWith("/settings/") || suffix.startsWith("/owner/confirm")) {
    return { pathname: buildOrgHref(organizationId, "/settings"), search: nextSearch };
  }

  if (suffix === "/pagamentos" || suffix === "/faturacao") {
    return { pathname: buildOrgHref(organizationId, "/finance"), search: nextSearch };
  }

  if (suffix === "/pagamentos/invoices") {
    return { pathname: buildOrgHref(organizationId, "/finance/invoices"), search: nextSearch };
  }

  if (suffix === "/estatisticas") {
    return { pathname: buildOrgHref(organizationId, "/analytics"), search: nextSearch };
  }

  if (suffix === "/analyze") {
    const section = nextSearch.get("section");
    nextSearch.delete("section");
    if (section === "financas" || section === "invoices") {
      return {
        pathname: section === "invoices" ? buildOrgHref(organizationId, "/finance/invoices") : buildOrgHref(organizationId, "/finance"),
        search: nextSearch,
      };
    }
    if (section === "ops") {
      nextSearch.set("tab", "ops");
    } else if (section === "vendas") {
      nextSearch.set("tab", "vendas");
    } else if (!nextSearch.get("tab")) {
      nextSearch.set("tab", "overview");
    }
    return { pathname: buildOrgHref(organizationId, "/analytics"), search: nextSearch };
  }

  if (suffix === "/eventos") {
    return { pathname: buildOrgHref(organizationId, "/events"), search: nextSearch };
  }

  if (suffix === "/eventos/novo") {
    return { pathname: buildOrgHref(organizationId, "/events/new"), search: nextSearch };
  }

  if (suffix.startsWith("/eventos/")) {
    return { pathname: buildOrgHref(organizationId, `/events/${suffix.slice("/eventos/".length)}`), search: nextSearch };
  }

  if (suffix === "/reservas") {
    return { pathname: buildOrgHref(organizationId, "/bookings"), search: nextSearch };
  }
  if (suffix === "/reservas/novo") {
    return { pathname: buildOrgHref(organizationId, "/bookings/new"), search: nextSearch };
  }
  if (suffix === "/reservas/servicos") {
    return { pathname: buildOrgHref(organizationId, "/bookings/services"), search: nextSearch };
  }
  if (suffix === "/reservas/clientes") {
    return { pathname: buildOrgHref(organizationId, "/bookings/customers"), search: nextSearch };
  }
  if (suffix === "/reservas/profissionais") {
    return { pathname: buildOrgHref(organizationId, "/bookings/professionals"), search: nextSearch };
  }
  if (suffix.startsWith("/reservas/profissionais/")) {
    return {
      pathname: buildOrgHref(organizationId, `/bookings/professionals/${suffix.slice("/reservas/profissionais/".length)}`),
      search: nextSearch,
    };
  }
  if (suffix === "/reservas/recursos") {
    return { pathname: buildOrgHref(organizationId, "/bookings/resources"), search: nextSearch };
  }
  if (suffix.startsWith("/reservas/recursos/")) {
    return {
      pathname: buildOrgHref(organizationId, `/bookings/resources/${suffix.slice("/reservas/recursos/".length)}`),
      search: nextSearch,
    };
  }
  if (suffix === "/reservas/politicas") {
    return { pathname: buildOrgHref(organizationId, "/bookings/policies"), search: nextSearch };
  }

  if (suffix === "/inscricoes") {
    return { pathname: buildOrgHref(organizationId, "/forms"), search: nextSearch };
  }
  if (suffix.startsWith("/inscricoes/")) {
    return { pathname: buildOrgHref(organizationId, `/forms/${suffix.slice("/inscricoes/".length)}`), search: nextSearch };
  }

  if (suffix === "/staff") {
    return { pathname: buildOrgHref(organizationId, "/team"), search: nextSearch };
  }
  if (suffix === "/treinadores") {
    return { pathname: buildOrgHref(organizationId, "/trainers"), search: nextSearch };
  }
  if (suffix === "/clube/membros") {
    return { pathname: buildOrgHref(organizationId, "/club/members"), search: nextSearch };
  }
  if (suffix === "/clube/caixa") {
    return { pathname: buildOrgHref(organizationId, "/club/cash"), search: nextSearch };
  }

  if (suffix === "/padel") {
    return { pathname: buildOrgHref(organizationId, "/padel"), search: nextSearch };
  }
  if (suffix === "/padel/clube") {
    return { pathname: buildOrgHref(organizationId, "/padel/clubs"), search: nextSearch };
  }
  if (suffix === "/padel/torneios") {
    return { pathname: buildOrgHref(organizationId, "/padel/tournaments"), search: nextSearch };
  }
  if (suffix === "/padel/torneios/novo") {
    return { pathname: buildOrgHref(organizationId, "/padel/tournaments/new"), search: nextSearch };
  }
  if (suffix.startsWith("/padel/torneios/")) {
    return { pathname: buildOrgHref(organizationId, `/padel/tournaments/${suffix.slice("/padel/torneios/".length)}`), search: nextSearch };
  }

  if (suffix === "/torneios") {
    return { pathname: buildOrgHref(organizationId, "/padel/tournaments"), search: nextSearch };
  }
  if (suffix === "/torneios/novo") {
    return { pathname: buildOrgHref(organizationId, "/padel/tournaments/new"), search: nextSearch };
  }
  if (suffix.startsWith("/torneios/")) {
    return { pathname: buildOrgHref(organizationId, `/padel/tournaments/${suffix.slice("/torneios/".length)}`), search: nextSearch };
  }
  if (suffix.startsWith("/tournaments/")) {
    return { pathname: buildOrgHref(organizationId, `/padel/tournaments/${suffix.slice("/tournaments/".length)}`), search: nextSearch };
  }

  if (suffix === "/crm") {
    return { pathname: buildOrgHref(organizationId, "/crm"), search: nextSearch };
  }
  if (suffix === "/crm/clientes") {
    return { pathname: buildOrgHref(organizationId, "/crm/customers"), search: nextSearch };
  }
  if (suffix.startsWith("/crm/clientes/")) {
    return { pathname: buildOrgHref(organizationId, `/crm/customers/${suffix.slice("/crm/clientes/".length)}`), search: nextSearch };
  }
  if (suffix === "/crm/segmentos") {
    return { pathname: buildOrgHref(organizationId, "/crm/segments"), search: nextSearch };
  }
  if (suffix.startsWith("/crm/segmentos/")) {
    return { pathname: buildOrgHref(organizationId, `/crm/segments/${suffix.slice("/crm/segmentos/".length)}`), search: nextSearch };
  }
  if (suffix === "/crm/campanhas") {
    return { pathname: buildOrgHref(organizationId, "/crm/campaigns"), search: nextSearch };
  }
  if (suffix === "/crm/relatorios") {
    return { pathname: buildOrgHref(organizationId, "/crm/reports"), search: nextSearch };
  }
  if (suffix === "/crm/loyalty") {
    return { pathname: buildOrgHref(organizationId, "/crm/loyalty"), search: nextSearch };
  }

  if (suffix === "/loja") {
    return { pathname: buildOrgHref(organizationId, "/store"), search: nextSearch };
  }

  return null;
}

export function appendOrganizationIdToHref(href: string, organizationId: number | null): string {
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(href);
    const base = isAbsolute ? undefined : "http://local";
    const url = new URL(href, base);
    if (url.pathname.startsWith("/org/") || url.pathname.startsWith("/org-hub")) {
      url.searchParams.delete("organizationId");
      url.searchParams.delete("org");
      if (isAbsolute) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    }

    const canonical = resolveCanonicalOrgHref(url.pathname, url.searchParams, organizationId);
    if (canonical) {
      url.pathname = canonical.pathname;
      url.search = canonical.search.toString() ? `?${canonical.search.toString()}` : "";
      if (isAbsolute) return url.toString();
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (!organizationId || !Number.isFinite(organizationId)) return href;
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
  return appendOrganizationIdToHref(href, organizationId);
}
