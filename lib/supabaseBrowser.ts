"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso no browser.
 * Usa as variáveis NEXT_PUBLIC_*, que são expostas ao front-end.
 * ⚠️ Não importar '@/lib/env' aqui, porque isso é só para código server-side.
 */

function getBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Export compatível com o que já usavas antes

export const supabaseBrowser = getBrowserSupabaseClient();

export function createSupabaseBrowserClient() {
  return getBrowserSupabaseClient();
}

export function createSupabaseClient() {
  return getBrowserSupabaseClient();
}