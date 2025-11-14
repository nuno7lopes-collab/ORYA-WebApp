import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const { supabase } = createSupabaseServer(req, res);

  // este GET garante que o supabase autentica pela cookie
  await supabase.auth.getUser();

  return NextResponse.redirect(new URL("/me", req.url));
}