"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso no browser.
 * Usa as variáveis NEXT_PUBLIC_*, que são expostas ao front-end.
 * ⚠️ Não importar '@/lib/env' aqui, porque isso é só para código server-side.
 */

function cleanupAuthStorage() {
  if (typeof window === "undefined") return;
  const storages = [window.localStorage, window.sessionStorage];
  for (const store of storages) {
    try {
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i);
        if (!key || !key.startsWith("sb-")) continue;
        // não removemos mais base64, para não apagar sessões válidas
      }
    } catch {
      // ignore
    }
  }

  // Mantemos cookies sb- intactas; não apagamos base64 para não destruir sessões válidas
}

function getBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  cleanupAuthStorage();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabaseBrowser = getBrowserSupabaseClient();
