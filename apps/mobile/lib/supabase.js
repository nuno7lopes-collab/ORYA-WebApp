import { createClient } from "@supabase/supabase-js";
import { getSharedEnv } from "@orya/shared";

const { supabaseUrl, supabaseAnonKey } = getSharedEnv();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[mobile] Missing Supabase envs EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
