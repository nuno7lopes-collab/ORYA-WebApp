import { NextResponse } from "next/server";
import { claimIdentity } from "@/lib/ownership/claimIdentity";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json(
      { ok: false, error: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  const email = data.user.email;
  const userId = data.user.id;
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "EMAIL_MISSING" },
      { status: 400 },
    );
  }

  await claimIdentity(email, userId);

  return NextResponse.json({ ok: true });
}
