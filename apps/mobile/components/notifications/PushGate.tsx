import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/auth";
import { registerForPushToken } from "../../lib/push";
import { api } from "../../lib/api";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { notificationsKeys, useNotificationsUnread } from "../../features/notifications/hooks";
import { useRouter } from "expo-router";
import { openNotificationLink } from "../../lib/notifications";

export function PushGate() {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastTokenRef = useRef<string | null>(null);
  const lastAccessTokenRef = useRef<string | null>(null);
  const authFailedRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const unreadQuery = useNotificationsUnread(Boolean(session?.user?.id));

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    if (session?.access_token && session.access_token !== lastAccessTokenRef.current) {
      lastAccessTokenRef.current = session.access_token;
      authFailedRef.current = false;
    }
  }, [session?.access_token]);

  useEffect(() => {
    const register = async () => {
      if (!session?.user?.id || !session?.access_token || registering) return;
      if (authFailedRef.current) return;
      try {
        setRegistering(true);
        const token = await registerForPushToken();
        if (!token || lastTokenRef.current === token) return;
        await api.requestWithAccessToken("/api/me/push-tokens", session.access_token, {
          method: "POST",
          body: JSON.stringify({ token, platform: "ios" }),
        });
        lastTokenRef.current = token;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("API 401") || message.includes("UNAUTHENTICATED")) {
          authFailedRef.current = true;
          if (lastErrorRef.current !== "UNAUTHENTICATED") {
            lastErrorRef.current = "UNAUTHENTICATED";
            console.info("[mobile] push registration skipped (unauthenticated)");
          }
          return;
        }
        if (lastErrorRef.current !== message) {
          lastErrorRef.current = message;
          console.warn("[mobile] push registration failed", err);
        }
      } finally {
        setRegistering(false);
      }
    };

    register();
  }, [session?.user?.id, session?.access_token, registering]);

  useEffect(() => {
    const count = unreadQuery.data?.unreadCount ?? 0;
    Notifications.setBadgeCountAsync(count).catch(() => undefined);
  }, [unreadQuery.data?.unreadCount]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const receiveSub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const deepLink = typeof data?.deepLink === "string" ? data.deepLink : null;
      const ctaUrl = typeof data?.ctaUrl === "string" ? data.ctaUrl : null;
      openNotificationLink(router, deepLink ?? ctaUrl ?? null).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        const deepLink = typeof data?.deepLink === "string" ? data.deepLink : null;
        const ctaUrl = typeof data?.ctaUrl === "string" ? data.ctaUrl : null;
        openNotificationLink(router, deepLink ?? ctaUrl ?? null).catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      receiveSub.remove();
      responseSub.remove();
    };
  }, [queryClient, router, session?.user?.id]);

  return null;
}
