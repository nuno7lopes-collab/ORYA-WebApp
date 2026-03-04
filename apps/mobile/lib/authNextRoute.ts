import { normalizeTabGroupedPathname, TAB_PATHNAMES } from "./tabRoutes";

type NextRouteParam = string | string[] | null | undefined;

const MAX_NEXT_ROUTE_LENGTH = 512;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;
const INTERNAL_ROUTE_BASE = "https://orya.local";

const ALLOWED_STATIC_PATHS = new Set([
  "/",
  TAB_PATHNAMES.inicio,
  TAB_PATHNAMES.competir,
  TAB_PATHNAMES.reservas,
  TAB_PATHNAMES.comunidade,
  TAB_PATHNAMES.perfil,
  "/comunidade/mensagens",
  "/comunidade/mensagens/pedidos",
  "/messages",
  "/messages/requests",
  "/aulas",
  "/notifications",
  "/tickets",
  "/map",
  "/search",
  "/checkout",
  "/settings",
  "/onboarding",
  "/store/downloads",
  "/store/purchases",
  "/convites/organizacoes",
]);

const RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  "inicio",
  "competir",
  "reservas",
  "comunidade",
  "perfil",
  "messages",
  "agora",
  "network",
  "profile",
  "padel",
  "index",
  "notifications",
  "tickets",
  "map",
  "search",
  "checkout",
  "settings",
  "onboarding",
  "aulas",
  "event",
  "service",
  "wallet",
  "store",
  "inscricoes",
  "convites",
  "auth",
  "api",
]);

const decodeRoute = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const stripTrailingSlash = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  const stripped = pathname.replace(/\/+$/, "");
  return stripped || "/";
};

const splitSegments = (pathname: string) => pathname.split("/").filter(Boolean);

const hasSafeSegments = (segments: string[]) =>
  segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");

const isAllowedStorePath = (segments: string[]) => {
  const [, second, third, fourth] = segments;
  if (!second) return false;

  if (second === "downloads" && segments.length === 2) return true;
  if (second === "purchases" && (segments.length === 2 || segments.length === 3)) return true;

  if (segments.length === 2) return true;
  if (segments.length === 3 && (third === "cart" || third === "checkout" || third === "success")) return true;
  if (segments.length === 4 && third === "product" && Boolean(fourth)) return true;

  return false;
};

const isAllowedPathname = (pathname: string) => {
  if (ALLOWED_STATIC_PATHS.has(pathname)) return true;

  const segments = splitSegments(pathname);
  if (!segments.length || !hasSafeSegments(segments)) return false;

  const [first, second, third, fourth] = segments;

  switch (first) {
    case "event":
    case "wallet":
    case "inscricoes":
      return segments.length === 2;
    case "comunidade":
      if (segments.length === 1) return true;
      if (second !== "mensagens") return false;
      if (segments.length === 2) return true;
      if (segments.length === 3) return third !== "convite";
      if (segments.length === 4 && third === "convite" && Boolean(fourth)) return true;
      return false;
    case "messages":
      if (segments.length === 1 || segments.length === 2) return true;
      return segments.length === 3 && second === "community-invite";
    case "service":
      return segments.length === 2 || (segments.length === 3 && third === "booking");
    case "store":
      return isAllowedStorePath(segments);
    default:
      return segments.length === 1 && !RESERVED_TOP_LEVEL_SEGMENTS.has(first.toLowerCase());
  }
};

const parseInternalRoute = (value: string): { pathname: string; search: string } | null => {
  try {
    const parsed = new URL(value, INTERNAL_ROUTE_BASE);
    if (parsed.origin !== INTERNAL_ROUTE_BASE) return null;

    const groupedPath = normalizeTabGroupedPathname(parsed.pathname);
    if (!groupedPath) return null;

    const pathname = stripTrailingSlash(groupedPath);
    if (pathname.includes("//")) return null;

    return { pathname, search: parsed.search || "" };
  } catch {
    return null;
  }
};

export const resolveSafeNextRoute = (raw: NextRouteParam): string | null => {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== "string") return null;

  const normalized = decodeRoute(candidate).trim();
  if (!normalized) return null;
  if (normalized.length > MAX_NEXT_ROUTE_LENGTH) return null;
  if (CONTROL_CHARS_REGEX.test(normalized)) return null;

  if (!normalized.startsWith("/")) return null;
  if (normalized.startsWith("//")) return null;

  const parsed = parseInternalRoute(normalized);
  if (!parsed) return null;
  if (!isAllowedPathname(parsed.pathname)) return null;

  return `${parsed.pathname}${parsed.search}`;
};
