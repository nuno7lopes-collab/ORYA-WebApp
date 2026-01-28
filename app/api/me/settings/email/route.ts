import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type Body = {
  email?: string;
};

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

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return jsonWrap({ ok: false, error: "Body inválido." }, { status: 400 });
    }

    const newEmail = body.email?.trim().toLowerCase();
    if (!newEmail) {
      return jsonWrap({ ok: false, error: "Email obrigatório." }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(newEmail)) {
      return jsonWrap(
        { ok: false, error: "Email em formato inválido.", code: "INVALID_EMAIL" },
        { status: 400 },
      );
    }

    const { data, error: updateError } = await supabase.auth.updateUser({ email: newEmail });
    if (updateError) {
      console.error("[settings/email] update error:", updateError);
      return jsonWrap(
        { ok: false, error: updateError.message || "Erro ao atualizar email." },
        { status: 400 },
      );
    }

    // Não guardamos email na Profile (a fonte de verdade é o Supabase), mas
    // tocamos no updatedAt para manter o perfil "vivo".
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { updatedAt: new Date() },
      create: {
        id: user.id,
        roles: ["user"],
        favouriteCategories: [],
        onboardingDone: false,
      },
    });

    return jsonWrap({
      ok: true,
      user: { id: user.id, email: data.user?.email ?? newEmail },
      message: "Email atualizado. Confirmação pode ser necessária.",
    });
  } catch (err) {
    console.error("[settings/email] erro:", err);
    return jsonWrap({ ok: false, error: "Erro a atualizar email." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);