import {
  resolveNotificationLink,
  type ResolvedNotificationLink,
} from "@/lib/mobile/notifications";

type RouterLike = { push: (href: string) => void };

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
