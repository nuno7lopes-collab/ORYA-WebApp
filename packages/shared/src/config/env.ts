export type AppEnv = "prod" | "test" | "dev";

export type SharedEnvConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  appEnv: AppEnv;
};

const DEFAULT_API_BASE = "https://app.orya.pt";

export const getSharedEnv = (): SharedEnvConfig => {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_BASE;
  const appEnv = (process.env.EXPO_PUBLIC_APP_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    "prod") as AppEnv;

  return { supabaseUrl, supabaseAnonKey, apiBaseUrl, appEnv };
};
