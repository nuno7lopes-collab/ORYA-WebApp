// Middleware para manter a sessão do Supabase fresca em cada request.
// Não faz redirect nem proteção de rotas — apenas refresh de sessão.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({
    req,
    res,
  });

  // Refresh session if expired
  await supabase.auth.getSession();

  return res;
}