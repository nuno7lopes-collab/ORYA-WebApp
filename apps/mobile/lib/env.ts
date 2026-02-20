import Constants from "expo-constants";

type MobileEnv = {
  appEnv: string;
  apiBaseUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  stripePublishableKey?: string;
  appleMerchantId?: string;
};

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const normalizeStripeMode = (
  value: string | undefined,
): "test" | "prod" | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "test" ||
    normalized === "testing" ||
    normalized === "staging" ||
    normalized === "dev" ||
    normalized === "development"
  ) {
    return "test";
  }
  if (normalized === "prod" || normalized === "production" || normalized === "live") {
    return "prod";
  }
  return null;
};

const pickStripePublishableKey = (
  extra: Record<string, unknown>,
  appEnvRaw: string,
) => {
  const override =
    normalizeStripeMode(readString(extra.EXPO_PUBLIC_STRIPE_MODE)) ??
    normalizeStripeMode(process.env.EXPO_PUBLIC_STRIPE_MODE) ??
    normalizeStripeMode(process.env.NEXT_PUBLIC_STRIPE_MODE);
  const mode = override ?? normalizeStripeMode(appEnvRaw) ?? "prod";

  const live =
    readString(extra.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE) ??
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
    process.env.STRIPE_PUBLISHABLE_KEY_LIVE ??
    readString(extra.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ??
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const test =
    readString(extra.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST) ??
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST ??
    process.env.STRIPE_PUBLISHABLE_KEY_TEST ??
    readString(extra.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ??
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const key = (mode === "test" ? test : live)?.trim() ?? "";
  if (!key) return undefined;
  if (mode === "test" && key.startsWith("pk_live")) return undefined;
  if (mode === "prod" && key.startsWith("pk_test")) return undefined;
  return key;
};

const getExtra = () => {
  const expoConfig = Constants?.expoConfig as { extra?: Record<string, unknown> } | undefined;
  const manifest = (Constants as any)?.manifest as { extra?: Record<string, unknown> } | undefined;
  return expoConfig?.extra ?? manifest?.extra ?? {};
};

const resolveHostFromExpo = () => {
  const expoConfig = (Constants as any)?.expoConfig as { hostUri?: string } | undefined;
  const manifest = (Constants as any)?.manifest as { hostUri?: string; debuggerHost?: string } | undefined;
  const hostUri =
    expoConfig?.hostUri ??
    manifest?.hostUri ??
    manifest?.debuggerHost ??
    manifest?.hostUri ??
    expoConfig?.hostUri;
  if (!hostUri || typeof hostUri !== "string") return null;
  const [host] = hostUri.split(":");
  return host ?? null;
};

const isPrivateIp = (host: string) => {
  if (!host) return false;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("172.")) {
    const second = Number(host.split(".")[1]);
    return Number.isFinite(second) && second >= 16 && second <= 31;
  }
  return false;
};

const normalizeApiBaseUrl = (raw: string) => {
  if (!raw) return raw;
  const trimmed = raw.replace(/\/+$/, "");
  const candidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  let parsed: URL | null = null;
  try {
    parsed = new URL(candidate);
  } catch {
    return trimmed;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    isPrivateIp(hostname);

  if (!isLocal) return trimmed;

  const host = resolveHostFromExpo();
  if (!host) return trimmed;

  const port = parsed.port || "3000";
  const protocol = parsed.protocol || "http:";
  return `${protocol}//${host}:${port}`;
};

export const getMobileEnv = (): MobileEnv => {
  const extra = getExtra();

  const appEnv =
    readString(extra.EXPO_PUBLIC_APP_ENV) ??
    process.env.EXPO_PUBLIC_APP_ENV ??
    process.env.NEXT_PUBLIC_APP_ENV ??
    "prod";

  const apiBaseUrl =
    readString(extra.EXPO_PUBLIC_API_BASE_URL) ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://orya.pt";

  const supabaseUrl =
    readString(extra.EXPO_PUBLIC_SUPABASE_URL) ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    readString(extra.EXPO_PUBLIC_SUPABASE_ANON_KEY) ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  const stripePublishableKey = pickStripePublishableKey(extra, appEnv);

  const appleMerchantId =
    readString(extra.EXPO_PUBLIC_APPLE_MERCHANT_ID) ??
    process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID ??
    process.env.NEXT_PUBLIC_APPLE_MERCHANT_ID;

  return {
    appEnv,
    apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
    supabaseUrl,
    supabaseAnonKey,
    stripePublishableKey,
    appleMerchantId,
  };
};
