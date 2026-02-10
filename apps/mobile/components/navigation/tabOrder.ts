export const TAB_ORDER = ["agora", "network", "messages", "profile", "index"] as const;
export const TAB_NAV_ORDER = ["wallet", ...TAB_ORDER] as const;

export type TabKey = (typeof TAB_ORDER)[number];
export type TabRouteKey = (typeof TAB_NAV_ORDER)[number];

export const TAB_PATHS: Record<TabKey, string> = {
  agora: "/(tabs)/agora",
  network: "/(tabs)/network",
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
