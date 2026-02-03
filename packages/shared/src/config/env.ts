export type SharedEnv = {
  appEnv: string;
  apiBaseUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  stripePublishableKey?: string;
  appleMerchantId?: string;
};

const readEnv = (key: string) =>
  typeof process !== "undefined" ? process.env[key] : undefined;

export const getSharedEnv = (): SharedEnv => {
  const appEnv =
    readEnv("EXPO_PUBLIC_APP_ENV") ??
    readEnv("NEXT_PUBLIC_APP_ENV") ??
    readEnv("APP_ENV") ??
    "prod";

  const apiBaseUrl =
    readEnv("EXPO_PUBLIC_API_BASE_URL") ??
    readEnv("NEXT_PUBLIC_API_BASE_URL") ??
    readEnv("NEXT_PUBLIC_BASE_URL") ??
    "https://www.orya.pt";

  const supabaseUrl =
    readEnv("EXPO_PUBLIC_SUPABASE_URL") ?? readEnv("NEXT_PUBLIC_SUPABASE_URL");

  const supabaseAnonKey =
    readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    readEnv("SUPABASE_ANON_KEY");

  const stripePublishableKey =
    readEnv("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY") ??
    readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

  const appleMerchantId =
    readEnv("EXPO_PUBLIC_APPLE_MERCHANT_ID") ??
    readEnv("NEXT_PUBLIC_APPLE_MERCHANT_ID");

  return {
    appEnv,
    apiBaseUrl,
    supabaseUrl,
    supabaseAnonKey,
    stripePublishableKey,
    appleMerchantId,
  };
};
