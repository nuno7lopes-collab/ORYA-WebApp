import type { Router } from "expo-router";
import type { NavigationProp } from "@react-navigation/native";

const DEFAULT_FALLBACK = "/agora";
const DEFAULT_PUSH_DEDUPE_MS = 180;
const DEFAULT_PUSH_LOCK_MS = 320;
const PUSH_STALE_MS = 6000;

type PushHref = Parameters<Router["push"]>[0];
type PushRouter = Pick<Router, "push">;

const pushLocks = new Map<string, number>();
let lastPushKey: string | null = null;
let lastPushAt = 0;

const stableParamValue = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => stableParamValue(item)).join(",");
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([key, item]) => `${key}:${stableParamValue(item)}`).join("|");
  }
  return String(value);
};

const pushHrefToKey = (href: PushHref): string => {
  if (typeof href === "string") return href;
  if (!href || typeof href !== "object") return String(href);
  const pathname = "pathname" in href ? String(href.pathname ?? "") : "";
  const params = "params" in href ? href.params : null;
  if (!params || typeof params !== "object") return pathname;
  const entries = Object.entries(params as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return pathname;
  const query = entries.map(([key, value]) => `${key}=${stableParamValue(value)}`).join("&");
  return `${pathname}?${query}`;
};

export const safePush = (
  router: PushRouter,
  href: PushHref,
  options?: { dedupeMs?: number; lockMs?: number },
): boolean => {
  const dedupeMs = options?.dedupeMs ?? DEFAULT_PUSH_DEDUPE_MS;
  const lockMs = options?.lockMs ?? DEFAULT_PUSH_LOCK_MS;
  const now = Date.now();
  const key = pushHrefToKey(href);

  for (const [lockKey, lockTime] of pushLocks.entries()) {
    if (now - lockTime > PUSH_STALE_MS) {
      pushLocks.delete(lockKey);
    }
  }

  const lockTime = pushLocks.get(key);
  if (lockTime && now - lockTime < lockMs) {
    return false;
  }
  if (lastPushKey === key && now - lastPushAt < dedupeMs) {
    return false;
  }

  lastPushKey = key;
  lastPushAt = now;
  pushLocks.set(key, now);
  router.push(href);

  setTimeout(() => {
    const activeLockTime = pushLocks.get(key);
    if (activeLockTime === now) {
      pushLocks.delete(key);
    }
  }, lockMs);

  return true;
};

export const safeBack = (
  router: Router,
  navigation?: NavigationProp<ReactNavigation.RootParamList> | null,
  fallback: string = DEFAULT_FALLBACK,
) => {
  try {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
  } catch {
    // ignore
  }
  try {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
  } catch {
    // ignore
  }
  router.replace(fallback);
};

export const resetNavigationGuardsForTests = () => {
  pushLocks.clear();
  lastPushKey = null;
  lastPushAt = 0;
};
