import Constants from "expo-constants";

type MobileEnv = {
  appEnv: string;
  apiBaseUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  stripePublishableKey?: string;
  appleMerchantId?: string;
};

const getExtra = () =>
  Constants?.expoConfig?.extra ?? Constants?.manifest?.extra ?? {};

const resolveHostFromExpo = () => {
  const hostUri =
    Constants?.expoConfig?.hostUri ??
    (Constants as any)?.manifest?.hostUri ??
    (Constants as any)?.manifest?.debuggerHost ??
    (Constants as any)?.manifest?.hostUri ??
    (Constants as any)?.expoConfig?.hostUri;
  if (!hostUri || typeof hostUri !== "string") return null;
  const [host] = hostUri.split(":");
  return host ?? null;
};

const normalizeApiBaseUrl = (raw: string) => {
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  const isLocal =
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("0.0.0.0");
  if (!isLocal) return raw.replace(/\/+$/, "");
  const host = resolveHostFromExpo();
  if (!host) return raw.replace(/\/+$/, "");
  return `http://${host}:3000`;
};

export const getMobileEnv = (): MobileEnv => {
  const extra = getExtra();

  const appEnv =
    extra.EXPO_PUBLIC_APP_ENV ??
    process.env.EXPO_PUBLIC_APP_ENV ??
    process.env.NEXT_PUBLIC_APP_ENV ??
    "prod";

  const apiBaseUrl =
    extra.EXPO_PUBLIC_API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://www.orya.pt";

  const supabaseUrl =
    extra.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  const stripePublishableKey =
    extra.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const appleMerchantId =
    extra.EXPO_PUBLIC_APPLE_MERCHANT_ID ??
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
