import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getAdminProfile() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "UNAUTHENTICATED" as const };
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile || !Array.isArray(profile.roles) || !profile.roles.includes("admin")) {
    return { user: null, error: "FORBIDDEN" as const };
  }

  return { user, error: null as const };
}

type Action = "ban" | "unban" | "hard_delete";

async function hardDeleteAuthUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, false);
  if (!error) return { ok: true, note: null as string | null };

  // Se já não existir no Auth, tratamos como sucesso para não bloquear a limpeza local
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";
  if (error?.status === 404 || message.includes("not found")) {
    return { ok: true, note: "AUTH_USER_ALREADY_REMOVED" as const };
  }

  return { ok: false, note: null, error };
}

export async function POST(req: NextRequest) {
  // 1) Auth check
  const { error } = await getAdminProfile();
  if (error === "UNAUTHENTICATED") {
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }
  if (error === "FORBIDDEN") {
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  // 2) Body parsing (JSON ou form)
  let userId: string | undefined;
  let action: Action | undefined;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      userId = body?.userId;
      action = body?.action;
    } else {
      const form = await req.formData();
      userId = (form.get("userId") as string | null) ?? undefined;
      action = (form.get("action") as Action | null) ?? undefined;
    }
  } catch (err) {
    console.error("[admin/utilizadores/manage] parse error", err);
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  if (!userId || !action) {
    return NextResponse.json(
      { ok: false, error: "MISSING_PARAMS" },
      { status: 400 },
    );
  }

  try {
    if (action === "hard_delete") {
      // Remover do Auth e limpar profile para permitir recriação
      const authResult = await hardDeleteAuthUser(userId);
      if (!authResult.ok) throw authResult.error;

      await prisma.profile.deleteMany({ where: { id: userId } });
      return NextResponse.json({
        ok: true,
        message: "Utilizador removido em definitivo.",
        note: authResult.note,
      });
    }

    if (action === "ban") {
      // Banir no Auth e marcar profile como inativo
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        banDuration: "87600h", // ~10 anos
      });
      if (banErr) throw banErr;
      await prisma.profile.updateMany({
        where: { id: userId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, message: "Utilizador banido." });
    }

    if (action === "unban") {
      const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        banDuration: "0h",
      });
      if (unbanErr) throw unbanErr;
      await prisma.profile.updateMany({
        where: { id: userId },
        data: { isDeleted: false, deletedAt: null },
      });
      return NextResponse.json({ ok: true, message: "Utilizador reativado." });
    }

    return NextResponse.json(
      { ok: false, error: "UNKNOWN_ACTION" },
      { status: 400 },
    );
  } catch (err) {
    console.error("[admin/utilizadores/manage] action error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
