import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { claimIdentity } from "@/lib/ownership/claimIdentity";
import { linkPendingWorkforceInvitesToUser } from "@/lib/workforceInvites";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
// Endpoint para ser chamado pelo frontend após evento de email verificado (Supabase)
async function _POST() {
  const supabase = await createSupabaseServer({ allowUnverifiedEmail: true });
  const { data, error } = await getUserWithPolicy("required_unverified_ok", { supabaseOverride: supabase });
  if (error || !data?.user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const email = data.user.email;
  if (!email) {
    return jsonWrap({ ok: false, error: "EMAIL_MISSING" }, { status: 400 });
  }
  await claimIdentity(email, data.user.id, {
    requireVerified: true,
    mergedBy: data.user.id,
  });
  await linkPendingWorkforceInvitesToUser({
    userId: data.user.id,
    email,
  });
  return jsonWrap({ ok: true });
}
export const POST = withApiEnvelope(_POST);
