import { LogBox } from "react-native";

const IGNORED_LOG_MESSAGES = [
  "SafeAreaView",
  "SafeAreaView has been deprecated",
  "SafeAreaView has been deprecated and will be removed in a future release",
  "SafeAreaView is deprecated",
  "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
  "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead. See https://github.com/th3rdwave/react-native-safe-area-context",
  "Please use 'react-native-safe-area-context' instead",
  "WebCrypto API is not supported",
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
];

const normalizeLogEntry = (entry: unknown) => {
  if (typeof entry === "string") return entry;
  if (entry instanceof Error) return entry.message;
  if (!entry || typeof entry !== "object") return "";
  const maybeMessage = (entry as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage : "";
};

const shouldIgnoreSafeAreaDeprecation = (args: unknown[]) => {
  const normalized = args.map(normalizeLogEntry).filter(Boolean).join(" ").toLowerCase();
  if (!normalized) return false;
  const mentionsSafeArea = normalized.includes("safeareaview");
  const mentionsDeprecated = normalized.includes("deprecated");
  const mentionsTarget = normalized.includes("react-native-safe-area-context");
  return (mentionsSafeArea && mentionsDeprecated) || (mentionsSafeArea && mentionsTarget);
};

export const __testing = {
  normalizeLogEntry,
  shouldIgnoreSafeAreaDeprecation,
};

export const installDevLogFilters = () => {
  if (!__DEV__) return;
  const globalRef = globalThis as typeof globalThis & {
    __ORYA_LOG_FILTERS_INSTALLED__?: boolean;
    __ORYA_ORIGINAL_WARN__?: typeof console.warn;
    __ORYA_ORIGINAL_ERROR__?: typeof console.error;
  };
  if (globalRef.__ORYA_LOG_FILTERS_INSTALLED__) return;

  const originalWarn = globalRef.__ORYA_ORIGINAL_WARN__ ?? console.warn.bind(console);
  const originalError = globalRef.__ORYA_ORIGINAL_ERROR__ ?? console.error.bind(console);
  globalRef.__ORYA_ORIGINAL_WARN__ = originalWarn;
  globalRef.__ORYA_ORIGINAL_ERROR__ = originalError;

  console.warn = (...args: unknown[]) => {
    if (shouldIgnoreSafeAreaDeprecation(args)) return;
    originalWarn(...(args as Parameters<typeof console.warn>));
  };

  console.error = (...args: unknown[]) => {
    if (shouldIgnoreSafeAreaDeprecation(args)) return;
    originalError(...(args as Parameters<typeof console.error>));
  };

  LogBox.ignoreLogs(IGNORED_LOG_MESSAGES);
  globalRef.__ORYA_LOG_FILTERS_INSTALLED__ = true;
};
