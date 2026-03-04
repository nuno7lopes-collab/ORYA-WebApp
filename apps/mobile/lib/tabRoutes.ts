export const TAB_ROUTE_SEGMENTS = [
  "inicio",
  "competir",
  "reservas",
  "comunidade",
  "perfil",
] as const;

export type TabRouteSegment = (typeof TAB_ROUTE_SEGMENTS)[number];

export const TAB_PATHNAMES: Record<TabRouteSegment, string> = {
  inicio: "/inicio",
  competir: "/competir",
  reservas: "/reservas",
  comunidade: "/comunidade",
  perfil: "/perfil",
};

const TAB_SEGMENT_SET = new Set<string>(TAB_ROUTE_SEGMENTS);

const stripTrailingSlash = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  const stripped = pathname.replace(/\/+$/, "");
  return stripped || "/";
};

export const isTabRouteSegment = (value: string): value is TabRouteSegment =>
  TAB_SEGMENT_SET.has(value);

export const normalizeTabGroupedPathname = (pathname: string): string | null => {
  const normalized = stripTrailingSlash(pathname || "/");
  if (normalized === "/(tabs)") return TAB_PATHNAMES.inicio;
  if (!normalized.startsWith("/(tabs)/")) return normalized;

  const remainder = normalized.slice("/(tabs)/".length);
  if (!remainder) return TAB_PATHNAMES.inicio;

  const [segment, ...rest] = remainder.split("/").filter(Boolean);
  if (!segment || !isTabRouteSegment(segment)) return null;

  return stripTrailingSlash(`/${[segment, ...rest].join("/")}`);
};
