import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { claimIdentity } from "@/lib/ownership/claimIdentity";

export async function POST() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const email = data.user.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "EMAIL_MISSING" }, { status: 400 });
  }
  await claimIdentity(email, data.user.id);
  return NextResponse.json({ ok: true });
}
