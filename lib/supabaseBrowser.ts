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

function resolveCookieDomainFromHost(hostname?: string | null) {
  if (!hostname) return "";
  const safeHost = hostname.split(":")[0]?.toLowerCase();
  if (!safeHost) return "";
  if (safeHost === "localhost" || safeHost.endsWith(".localhost")) return "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(safeHost) || safeHost.includes(":")) return "";
  const parts = safeHost.split(".").filter(Boolean);
  if (parts.length >= 2) return `.${parts.slice(-2).join(".")}`;
  return "";
}

function getBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envCookieDomain = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN?.trim() || "";
  const inferredDomain =
    typeof window !== "undefined"
      ? resolveCookieDomainFromHost(window.location.hostname)
      : "";
  const cookieDomain = envCookieDomain || inferredDomain;
  const isLocalhostDomain =
    typeof cookieDomain === "string" &&
    (cookieDomain === "localhost" || cookieDomain.endsWith(".localhost"));
  const isSecure =
    typeof window !== "undefined"
      ? window.location.protocol === "https:"
      : !isLocalhostDomain;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  cleanupAuthStorage();
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      path: "/",
      sameSite: "lax",
      ...(isSecure ? { secure: true } : {}),
    },
  });
}

export const supabaseBrowser = getBrowserSupabaseClient();
