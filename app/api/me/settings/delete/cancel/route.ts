import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { logAccountEvent } from "@/lib/accountEvents";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { status: true, deletionScheduledFor: true },
    });
    if (!profile) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (profile.status !== "PENDING_DELETE") {
      return jsonWrap({ ok: false, error: "NOT_PENDING_DELETE" }, { status: 400 });
    }

    const now = new Date();
    if (profile.deletionScheduledFor && profile.deletionScheduledFor <= now) {
      return jsonWrap({ ok: false, error: "DELETION_LOCKED" }, { status: 409 });
    }

    await prisma.profile.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletedAtFinal: null,
      },
    });

    await logAccountEvent({
      userId: user.id,
      type: "account_delete_cancelled",
    });

    return jsonWrap({ ok: true, status: "ACTIVE" }, { status: 200 });
  } catch (err) {
    console.error("[settings/delete/cancel] erro:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);