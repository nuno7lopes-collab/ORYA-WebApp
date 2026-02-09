import { getMobileEnv } from "./env";

export type ResolvedNotificationLink =
  | { kind: "native"; path: string }
  | { kind: "web"; url: string }
  | { kind: "none" };

type RouterLike = { push: (href: string) => void };

const WEB_ALLOWED_PATHS = new Set<string>([]);

const WEB_ALLOWED_PREFIXES: string[] = ["/organizacao"];

const normalizeInput = (input?: string | null) => {
  if (!input) return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const safeParseUrl = (input: string) => {
  const base = getMobileEnv().apiBaseUrl || "https://www.orya.pt";
  try {
    return new URL(input, base);
  } catch {
    return null;
  }
};

const stripTrailingSlash = (value: string) => {
  if (!value) return value;
  const stripped = value.replace(/\/+$/, "");
  return stripped || "/";
};

const appendSourceParam = (path: string, search: string, source: string) => {
  if (search) {
    if (search.includes("source=")) return `${path}${search}`;
    return `${path}${search}&source=${encodeURIComponent(source)}`;
  }
  return `${path}?source=${encodeURIComponent(source)}`;
};

export const resolveNotificationLink = (input?: string | null): ResolvedNotificationLink => {
  const value = normalizeInput(input);
  if (!value) return { kind: "none" };

  const url = safeParseUrl(value);
  if (!url) return { kind: "none" };

  const path = stripTrailingSlash(url.pathname || "/");
  const search = url.search || "";

  if (path.startsWith("/event/")) {
    return { kind: "native", path: appendSourceParam(path, search, "notifications") };
  }
  if (path.startsWith("/messages")) {
    return { kind: "native", path: appendSourceParam(path, search, "notifications") };
  }
  if (path.startsWith("/wallet/")) {
    return { kind: "native", path: appendSourceParam(path, search, "notifications") };
  }
  if (path === "/me") {
    return { kind: "native", path: "/profile" };
  }
  if (path === "/profile") {
    return { kind: "native", path: "/profile" };
  }
  if (path === "/network") {
    return { kind: "native", path: `${path}${search}` };
  }
  if (path === "/notifications" || path === "/tickets") {
    return { kind: "native", path: `${path}${search}` };
  }
  if (path === "/me/bilhetes") {
    return { kind: "native", path: "/tickets" };
  }
  if (path === "/convites/organizacoes") {
    return { kind: "native", path: appendSourceParam(path, search, "notifications") };
  }

  if (path.startsWith("/eventos/")) {
    const parts = path.split("/").filter(Boolean);
    const slug = parts[1];
    if (slug) {
      const eventPath = `/event/${slug}`;
      return { kind: "native", path: appendSourceParam(eventPath, search, "notifications") };
    }
  }
  if (path === "/eventos") {
    return { kind: "native", path: "/(tabs)/index" };
  }

  const topLevel = path.split("/").filter(Boolean);
  const reserved = new Set([
    "eventos",
    "event",
    "messages",
    "wallet",
    "me",
    "profile",
    "network",
    "notifications",
    "tickets",
    "social",
    "convites",
    "organizacao",
    "auth",
    "map",
    "search",
    "agora",
    "index",
    "servicos",
    "service",
    "chat",
    "api",
  ]);
  if (topLevel.length === 1 && !reserved.has(topLevel[0])) {
    return { kind: "native", path: `/${topLevel[0]}` };
  }

  if (path === "/me/carteira" || path === "/me/inscricoes") {
    return { kind: "native", path: "/tickets" };
  }

  if (path.startsWith("/me/bilhetes/")) {
    const parts = path.split("/").filter(Boolean);
    const entitlementId = parts[2];
    if (entitlementId) {
      return { kind: "native", path: `/wallet/${entitlementId}` };
    }
  }

  if (path === "/social") {
    const tab = url.searchParams.get("tab");
    if (tab === "notifications") {
      return { kind: "native", path: "/notifications" };
    }
  }

  if (path === "/organizacao/chat") {
    const conversationId = url.searchParams.get("conversationId");
    if (conversationId) {
      return { kind: "native", path: `/messages/${conversationId}` };
    }
    return { kind: "native", path: "/messages" };
  }

  const allowWeb =
    WEB_ALLOWED_PATHS.has(path) || WEB_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (!allowWeb) {
    return { kind: "none" };
  }

  const fallbackUrl = url.toString();
  return { kind: "web", url: fallbackUrl };
};

export const openNotificationLink = async (router: RouterLike, input?: string | null) => {
  const resolved = resolveNotificationLink(input);
  if (resolved.kind === "native") {
    router.push(resolved.path);
    return;
  }
  if (resolved.kind === "web") {
    try {
      const WebBrowser = await import("expo-web-browser");
      await WebBrowser.openBrowserAsync(resolved.url);
    } catch {
      // ignore errors opening webview
    }
  }
};
