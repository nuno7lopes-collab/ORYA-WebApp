export const TAB_ORDER = ["network", "agora", "padel", "messages", "profile", "index"] as const;
export const TAB_NAV_ORDER = [...TAB_ORDER] as const;

export type TabKey = (typeof TAB_ORDER)[number];
export type TabRouteKey = (typeof TAB_NAV_ORDER)[number];

export const TAB_PATHS: Record<TabKey, string> = {
  network: "/(tabs)/network",
  agora: "/(tabs)/agora",
  padel: "/(tabs)/padel",
  messages: "/(tabs)/messages",
  profile: "/(tabs)/profile",
  index: "/(tabs)/index",
};

export const resolveTabKeyFromPathname = (pathname: string): TabKey | null => {
  const normalized = pathname.split("?")[0] ?? "";
  if (normalized === "/" || normalized === "/index") return "index";
  if (normalized === "/(tabs)" || normalized === "/(tabs)/") return "index";
  if (normalized.startsWith("/(tabs)/")) {
    const segment = normalized.slice("/(tabs)/".length).split("/")[0];
    if (!segment || segment === "index") return "index";
    if ((TAB_ORDER as readonly string[]).includes(segment)) {
      return segment as TabKey;
    }
  }
  if (normalized.startsWith("/")) {
    const segment = normalized.slice(1).split("/")[0];
    if (!segment || segment === "index") return "index";
    if ((TAB_ORDER as readonly string[]).includes(segment)) {
      return segment as TabKey;
    }
  }
  return null;
};
