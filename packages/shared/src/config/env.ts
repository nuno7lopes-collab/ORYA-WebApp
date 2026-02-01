export type SharedEnv = {
  appEnv: string;
  apiBaseUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
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
    "https://app.orya.pt";

  const supabaseUrl =
    readEnv("EXPO_PUBLIC_SUPABASE_URL") ?? readEnv("NEXT_PUBLIC_SUPABASE_URL");

  const supabaseAnonKey =
    readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    readEnv("SUPABASE_ANON_KEY");

  return {
    appEnv,
    apiBaseUrl,
    supabaseUrl,
    supabaseAnonKey,
  };
};
