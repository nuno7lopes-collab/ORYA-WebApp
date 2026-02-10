import { resolveMobileLink, type ResolvedMobileLink } from "./links";

export type ResolvedNotificationLink = ResolvedMobileLink;

type RouterLike = { push: (href: string) => void };

export const resolveNotificationLink = (input?: string | null): ResolvedNotificationLink =>
  resolveMobileLink(input, { source: "notifications", allowWeb: true });

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
