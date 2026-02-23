import { useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import { InteractionManager } from "react-native";
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
  const [bootReady, setBootReady] = useState(false);
  const unreadQuery = useNotificationsUnread(
    session?.access_token ?? null,
    session?.user?.id ?? null,
    bootReady,
  );

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (active) setBootReady(true);
      }, 250);
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      interactionTask.cancel();
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (notificationsRef.current) return notificationsRef.current;
    const notificationsModule = await import("expo-notifications");
    notificationsRef.current = notificationsModule;
    return notificationsModule;
  }, []);

  useEffect(() => {
    if (isExpoGo || !bootReady) return;
    let active = true;
    loadNotifications()
      .then((Notifications) => {
        if (!active) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [bootReady, isExpoGo, loadNotifications]);

  useEffect(() => {
    if (session?.access_token && session.access_token !== lastAccessTokenRef.current) {
      lastAccessTokenRef.current = session.access_token;
      authFailedRef.current = false;
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isExpoGo || !bootReady) return;
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
  }, [bootReady, isExpoGo, session?.user?.id, session?.access_token, registering]);

  useEffect(() => {
    if (isExpoGo || !bootReady) return;
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
  }, [bootReady, isExpoGo, loadNotifications, unreadQuery.data?.unreadCount]);

  useEffect(() => {
    if (isExpoGo || !bootReady || !session?.user?.id) return;
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
  }, [bootReady, isExpoGo, loadNotifications, queryClient, router, session?.user?.id]);

  return null;
}
