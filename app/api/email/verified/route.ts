import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { claimIdentity } from "@/lib/ownership/claimIdentity";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// Endpoint para ser chamado pelo frontend após evento de email verificado (Supabase)
async function _POST() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const email = data.user.email;
  if (!email) {
    return jsonWrap({ ok: false, error: "EMAIL_MISSING" }, { status: 400 });
  }
  await claimIdentity(email, data.user.id, { requireVerified: true });
  return jsonWrap({ ok: true });
}
export const POST = withApiEnvelope(_POST);