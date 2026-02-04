export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// Troca de parceiro após pagamento não é permitida (rota mantida por compatibilidade).
async function _POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const resolved = await params;
  const token = resolved?.token;
  if (!token) return jsonWrap({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { partnerLinkToken: token },
    select: { id: true, partnerLinkExpiresAt: true },
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const now = new Date();
  if (pairing.partnerLinkExpiresAt && pairing.partnerLinkExpiresAt.getTime() < now.getTime()) {
    return jsonWrap({ ok: false, error: "SWAP_CONFIRM_EXPIRED" }, { status: 409 });
  }
  return jsonWrap({ ok: false, error: "SWAP_NOT_ALLOWED" }, { status: 409 });
}
export const POST = withApiEnvelope(_POST);
