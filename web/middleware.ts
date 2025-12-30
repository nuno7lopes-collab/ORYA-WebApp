// Middleware para manter a sessão do Supabase fresca em cada request.
// Não faz redirect nem proteção de rotas — apenas refresh de sessão.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });
  const orgParam = req.nextUrl.searchParams.get("org") ?? req.nextUrl.searchParams.get("organizerId");
  if (orgParam && /^\d+$/.test(orgParam)) {
    res.cookies.set("orya_org", orgParam, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const raw = req.cookies.get(name)?.value;
        return raw ?? undefined;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth wall para áreas privadas
  const pathname = req.nextUrl.pathname;
  const isProtected =
    pathname.startsWith("/me") ||
    pathname.startsWith("/organizador");

  if (isProtected && !user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectTo", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/me/:path*", "/organizador/:path*"],
};
