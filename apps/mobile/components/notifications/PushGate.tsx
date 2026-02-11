import { useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import { useAuth } from "../../lib/auth";
import { registerForPushToken } from "../../lib/push";
import { api } from "../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateNotificationsAll,
  invalidateNotificationsUnread,
  useNotificationsUnread,
} from "../../features/notifications/hooks";
import { useRouter } from "expo-router";
import { openNotificationLink } from "../../lib/notifications";

export function PushGate() {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isExpoGo = Constants.appOwnership === "expo";
  const notificationsRef = useRef<null | typeof import("expo-notifications")>(null);
  const lastTokenRef = useRef<string | null>(null);
  const lastAccessTokenRef = useRef<string | null>(null);
  const authFailedRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const unreadQuery = useNotificationsUnread(
    session?.access_token ?? null,
    session?.user?.id ?? null,
  );

  const loadNotifications = useCallback(async () => {
    if (notificationsRef.current) return notificationsRef.current;
    const notificationsModule = await import("expo-notifications");
    notificationsRef.current = notificationsModule;
    return notificationsModule;
  }, []);

  useEffect(() => {
    if (isExpoGo) return;
    let active = true;
    loadNotifications()
      .then((Notifications) => {
        if (!active) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isExpoGo, loadNotifications]);

  useEffect(() => {
    if (session?.access_token && session.access_token !== lastAccessTokenRef.current) {
      lastAccessTokenRef.current = session.access_token;
      authFailedRef.current = false;
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isExpoGo) return;
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
  }, [isExpoGo, session?.user?.id, session?.access_token, registering]);

  useEffect(() => {
    if (isExpoGo) return;
    const count = unreadQuery.data?.unreadCount ?? 0;
    let active = true;
    loadNotifications()
      .then((Notifications) => {
        if (!active) return;
        Notifications.setBadgeCountAsync(count).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isExpoGo, loadNotifications, unreadQuery.data?.unreadCount]);

  useEffect(() => {
    if (isExpoGo || !session?.user?.id) return;
    let active = true;
    let receiveSub: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;

    loadNotifications()
      .then((Notifications) => {
        if (!active) return;
        receiveSub = Notifications.addNotificationReceivedListener(() => {
          invalidateNotificationsUnread(queryClient);
        });

        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, unknown> | undefined;
          const deepLink = typeof data?.deepLink === "string" ? data.deepLink : null;
          const ctaUrl = typeof data?.ctaUrl === "string" ? data.ctaUrl : null;
          openNotificationLink(router, deepLink ?? ctaUrl ?? null).catch(() => undefined);
          invalidateNotificationsAll(queryClient);
          invalidateNotificationsUnread(queryClient);
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
      })
      .catch(() => undefined);

    return () => {
      active = false;
      receiveSub?.remove();
      responseSub?.remove();
    };
  }, [isExpoGo, loadNotifications, queryClient, router, session?.user?.id]);

  return null;
}
