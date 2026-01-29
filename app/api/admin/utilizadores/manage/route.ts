import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAccountEvent } from "@/lib/accountEvents";
import { getClientIp } from "@/lib/auth/requestValidation";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { logError } from "@/lib/observability/logger";

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

async function _POST(req: NextRequest) {
  // 1) Auth check
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
  }
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

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
    logError("admin.utilizadores.manage_parse_failed", err);
    return jsonWrap({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  if (!userId || !action) {
    return jsonWrap(
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
      await logAccountEvent({
        userId,
        type: "admin_user_hard_delete",
        metadata: { actorUserId: admin.userId, ip, userAgent, note: authResult.note },
      });
      return jsonWrap({
        ok: true,
        message: "Utilizador removido em definitivo.",
        note: authResult.note,
      });
    }

    if (action === "ban") {
      // Banir no Auth e marcar profile como inativo
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "87600h", // ~10 anos
      } as any);
      if (banErr) throw banErr;
      await prisma.profile.updateMany({
        where: { id: userId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      await logAccountEvent({
        userId,
        type: "admin_user_ban",
        metadata: { actorUserId: admin.userId, ip, userAgent },
      });
      return jsonWrap({ ok: true, message: "Utilizador banido." });
    }

    if (action === "unban") {
      const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "0h",
      } as any);
      if (unbanErr) throw unbanErr;
      await prisma.profile.updateMany({
        where: { id: userId },
        data: { isDeleted: false, deletedAt: null },
      });
      await logAccountEvent({
        userId,
        type: "admin_user_unban",
        metadata: { actorUserId: admin.userId, ip, userAgent },
      });
      return jsonWrap({ ok: true, message: "Utilizador reativado." });
    }

    return jsonWrap(
      { ok: false, error: "UNKNOWN_ACTION" },
      { status: 400 },
    );
  } catch (err) {
    logError("admin.utilizadores.manage_action_failed", err);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
