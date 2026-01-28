import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const rawPhone = typeof payload?.contactPhone === "string" ? payload.contactPhone.trim() : "";
    if (!rawPhone || !isValidPhone(rawPhone)) {
      return jsonWrap(
        { ok: false, error: "Telefone inválido. Usa um número real (podes incluir indicativo, ex.: +351...)." },
        { status: 400 },
      );
    }

    const normalized = normalizePhone(rawPhone);
    await prisma.profile.update({
      where: { id: user.id },
      data: { contactPhone: normalized },
    });

    return jsonWrap({ ok: true, contactPhone: normalized });
  } catch (err) {
    console.error("PATCH /api/me/contact-phone error:", err);
    return jsonWrap({ ok: false, error: "Erro ao guardar telemóvel." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);