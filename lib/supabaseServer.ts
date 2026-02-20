import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { cache } from "react";
import { getRequestAuthHeader } from "@/lib/http/authContext";
import { EmailNotVerifiedError, isUserEmailVerified } from "@/lib/security";

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

function resolveCookieDomainFromHost(rawHost?: string | null) {
  if (!rawHost) return "";
  const hostname = rawHost.split(":")[0]?.toLowerCase();
  if (!hostname) return "";
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length >= 2) return `.${parts.slice(-2).join(".")}`;
  return "";
}

function extractBearerToken(authorizationHeader?: string | null) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSecureCookieRuntime() {
  const appEnv = String(
    process.env.APP_ENV ??
      process.env.NEXT_PUBLIC_APP_ENV ??
      process.env.NODE_ENV ??
      "",
  )
    .trim()
    .toLowerCase();
  return appEnv === "production" || appEnv === "prod" || appEnv === "stage";
}

/**
 * Server-side Supabase client (SSR + Route Handlers)
 * - Safe cookie reading
 * - Safe cookie writing
 * - Prevents JSON parse errors
 * - No profile fetching here
 */
type CreateSupabaseServerOptions = {
  allowUnverifiedEmail?: boolean;
};

function shouldEnforceVerifiedEmail(options?: CreateSupabaseServerOptions) {
  if (options?.allowUnverifiedEmail) return false;
  const stack = new Error().stack ?? "";
  return stack.includes("/app/api/");
}

export async function createSupabaseServer(options?: CreateSupabaseServerOptions) {
  const cookieStore = (await cookies());
  const headersStore = await headers();
  const hostHeader = headersStore.get("host");
  const rawAuthHeader = headersStore.get("authorization") ?? getRequestAuthHeader();
  const bearerToken = extractBearerToken(rawAuthHeader);
  const enforceVerifiedEmail = shouldEnforceVerifiedEmail(options);
  const cookieDomain =
    env.supabaseCookieDomain || resolveCookieDomainFromHost(hostHeader);
  const isLocalhostDomain =
    cookieDomain === "localhost" || cookieDomain.endsWith(".localhost");
  const isSecure =
    !isLocalhostDomain &&
    isSecureCookieRuntime();

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      ...(bearerToken
        ? {
            global: {
              headers: {
                Authorization: `Bearer ${bearerToken}`,
              },
            },
          }
        : {}),
      cookieOptions: cookieDomain
        ? {
            domain: cookieDomain,
            path: "/",
            sameSite: "lax",
            ...(isSecure ? { secure: true } : {}),
          }
        : undefined,
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

  const authAny = supabase.auth as typeof supabase.auth & {
    getUser: (jwt?: string) => ReturnType<typeof supabase.auth.getUser>;
  };
  const originalGetUser = authAny.getUser.bind(authAny);
  authAny.getUser = async (jwt?: string) => {
    const response = await originalGetUser(jwt ?? bearerToken ?? undefined);
    if (!enforceVerifiedEmail) return response;
    const resolvedUser = response.data?.user;
    if (resolvedUser && !isUserEmailVerified(resolvedUser)) {
      throw new EmailNotVerifiedError();
    }
    return response;
  };

  return supabase;
}


export const getCurrentUser = cache(async () => {
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
});
