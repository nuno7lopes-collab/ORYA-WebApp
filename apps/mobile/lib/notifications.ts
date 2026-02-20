import type { Router } from "expo-router";
import { resolveNotificationLink, type ResolvedNotificationLink } from "../../../lib/mobile/notifications";
import { safePush } from "./navigation";

type RouterLike = Pick<Router, "push">;

export const openNotificationLink = async (router: RouterLike, input?: string | null) => {
  const resolved = resolveNotificationLink(input);
  if (resolved.kind === "native") {
    safePush(router, resolved.path);
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

export { resolveNotificationLink };
export type { ResolvedNotificationLink };
