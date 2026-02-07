import * as WebBrowser from "expo-web-browser";
import { getMobileEnv } from "./env";

export type ResolvedNotificationLink =
  | { kind: "native"; path: string }
  | { kind: "web"; url: string }
  | { kind: "none" };

type RouterLike = { push: (href: string) => void };

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

export const resolveNotificationLink = (input?: string | null): ResolvedNotificationLink => {
  const value = normalizeInput(input);
  if (!value) return { kind: "none" };

  const url = safeParseUrl(value);
  if (!url) return { kind: "none" };

  const path = stripTrailingSlash(url.pathname || "/");
  const search = url.search || "";

  if (path.startsWith("/event/") || path.startsWith("/messages") || path.startsWith("/wallet/")) {
    return { kind: "native", path: `${path}${search}` };
  }
  if (path === "/notifications" || path === "/tickets") {
    return { kind: "native", path: `${path}${search}` };
  }

  if (path.startsWith("/eventos/")) {
    const parts = path.split("/").filter(Boolean);
    const slug = parts[1];
    if (slug) {
      return { kind: "native", path: `/event/${slug}${search}` };
    }
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
      await WebBrowser.openBrowserAsync(resolved.url);
    } catch {
      // ignore errors opening webview
    }
  }
};
