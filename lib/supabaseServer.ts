import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

function decodeBase64Cookie(raw: string) {
  const BASE64_PREFIX = "base64-";
  if (!raw.startsWith(BASE64_PREFIX)) return raw;

  const base = raw.slice(BASE64_PREFIX.length);
  const encodings: BufferEncoding[] = ["base64url", "base64"];

  for (const enc of encodings) {
    try {
      return Buffer.from(base, enc).toString("utf-8");
    } catch {
      /* try next */
    }
  }

  // Se não conseguirmos decodificar, tratamos como cookie ausente para evitar JSON.parse de strings inválidas
  return undefined;
}

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
            // Só devolvemos cookies do Supabase (sb-*) e ignoramos o resto
            if (!name.startsWith("sb-")) return undefined;
            const raw = cookieStore.get(name)?.value;
            if (!raw) return undefined;

            // Se for um chunk (sb-*.0, sb-*.1, ...), deixamos intacto para o combinador do Supabase tratar
            const isChunk = /\.\d+$/.test(name);
            return isChunk ? raw : decodeBase64Cookie(raw);
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
