// lib/supabaseServer.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Helper genérico para criar o client do Supabase no lado do servidor.
 *
 * 🔹 Em Route Handlers (/api/*): permite ler E definir cookies de sessão.
 * 🔹 Em componentes de servidor (RSC) normais: só deve ler cookies; se o Supabase
 *    tentar fazer refresh e definir cookies, apanhamos o erro em try/catch
 *    para não rebentar a app.
 */
export async function createSupabaseServer() {
  // Em versões mais recentes do Next, cookies() pode ser tipado como assíncrono.
  const cookieStore = (await cookies()) as any;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            // ReadonlyRequestCookies / RequestCookies expõem .get(name)
            const cookie = cookieStore.get?.(name);
            return cookie?.value;
          } catch {
            return undefined;
          }
        },
        set(name: string, value: string, options: any) {
          try {
            // Em Route Handlers, cookieStore suporta .set(...)
            // Em RSC normais isto atira erro — que é apanhado no catch.
            cookieStore.set?.({ name, value, ...options });
          } catch (err) {
            // Não deixamos a app rebentar em ambientes onde não é permitido escrever cookies.
            // Em /api/login, /api/me, etc., isto deve funcionar sem problemas.
            console.error(
              "[ORYA] Falha ao definir cookie supabase (possivelmente fora de Route Handler):",
              err,
            );
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set?.({
              name,
              value: "",
              ...options,
              maxAge: 0,
            });
          } catch (err) {
            console.error(
              "[ORYA] Falha ao remover cookie supabase (possivelmente fora de Route Handler):",
              err,
            );
          }
        },
      },
    },
  );

  return supabase;
}