export const TAB_ROUTE_SEGMENTS = [
  "agora",
  "index",
  "network",
  "messages",
  "profile",
  "padel",
] as const;

export type TabRouteSegment = (typeof TAB_ROUTE_SEGMENTS)[number];

export const TAB_PATHNAMES: Record<TabRouteSegment, string> = {
  agora: "/agora",
  index: "/(tabs)/index",
  network: "/network",
  messages: "/messages",
  profile: "/profile",
  padel: "/padel",
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
  if (normalized === "/(tabs)") return TAB_PATHNAMES.index;
  if (!normalized.startsWith("/(tabs)/")) return normalized;

  const remainder = normalized.slice("/(tabs)/".length);
  if (!remainder) return TAB_PATHNAMES.index;

  const [segment, ...rest] = remainder.split("/").filter(Boolean);
  if (!segment || !isTabRouteSegment(segment)) return null;
  if (segment === "index" && rest.length === 0) return TAB_PATHNAMES.index;

  return stripTrailingSlash(`/${[segment, ...rest].join("/")}`);
};
