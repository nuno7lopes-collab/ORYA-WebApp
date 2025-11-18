import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();

  // este GET garante que o supabase autentica pela cookie
  await supabase.auth.getUser();

  return NextResponse.redirect(new URL("/me", req.url));
}