import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { logAccountEvent } from "@/lib/accountEvents";

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { status: true, deletionScheduledFor: true },
    });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (profile.status !== "PENDING_DELETE") {
      return NextResponse.json({ ok: false, error: "NOT_PENDING_DELETE" }, { status: 400 });
    }

    const now = new Date();
    if (profile.deletionScheduledFor && profile.deletionScheduledFor <= now) {
      return NextResponse.json({ ok: false, error: "DELETION_LOCKED" }, { status: 409 });
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

    return NextResponse.json({ ok: true, status: "ACTIVE" }, { status: 200 });
  } catch (err) {
    console.error("[settings/delete/cancel] erro:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
