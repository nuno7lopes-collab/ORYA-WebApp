import { createClient } from "@supabase/supabase-js";
import { getMobileEnv } from "./env";
import AsyncStorage from "@react-native-async-storage/async-storage";

const shared = getMobileEnv();
const supabaseUrl = shared.supabaseUrl;
const supabaseAnonKey = shared.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[mobile] Missing Supabase envs EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
