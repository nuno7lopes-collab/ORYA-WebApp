import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Server-side Supabase client (SSR + Route Handlers)
 * - Safe cookie reading
 * - Safe cookie writing
 * - Prevents JSON parse errors
 * - No profile fetching here
 */
export async function createSupabaseServer() {
  const cookieStore = (await cookies());

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          try {
            const raw = cookieStore.get(name)?.value;
            // Avoid "Unexpected token base64" by NOT parsing anything
            return raw ?? undefined;
          } catch {
            return undefined;
          }
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* ignore errors for RSC */
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch {
            /* ignore */
          }
        },
      },
    }
  );

  return supabase;
}


export async function getCurrentUser() {
  const supabase = await createSupabaseServer();

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
}