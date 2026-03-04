import {
  TAB_PATHNAMES,
  TAB_ROUTE_SEGMENTS,
  isTabRouteSegment,
  normalizeTabGroupedPathname,
} from "../../lib/tabRoutes";

export const TAB_ORDER = TAB_ROUTE_SEGMENTS;

export type TabKey = (typeof TAB_ORDER)[number];

export const TAB_PATHS: Record<TabKey, string> = TAB_PATHNAMES;

export const resolveTabKeyFromPathname = (pathname: string): TabKey | null => {
  const pathOnly = pathname.split("?")[0] ?? "";
  const normalized = normalizeTabGroupedPathname(pathOnly);
  if (!normalized) return null;

  if (normalized === "/" || normalized === "/inicio" || normalized === "/(tabs)/inicio") return "inicio";
  if (normalized.startsWith("/")) {
    const segment = normalized.slice(1).split("/")[0];
    if (!segment) return "inicio";
    if (isTabRouteSegment(segment)) return segment;
  }
  return null;
};
