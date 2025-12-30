import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { logAccountEvent } from "@/lib/accountEvents";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    // Verificar se o utilizador é owner único de alguma organização
    const ownerMemberships = await prisma.organizerMember.findMany({
      where: { userId: user.id, role: "OWNER" },
      include: { organizer: true },
    });

    const blockedOrgs: string[] = [];
    for (const mem of ownerMemberships) {
      if (!mem.organizer) continue;
      const otherOwners = await prisma.organizerMember.count({
        where: {
          organizerId: mem.organizerId,
          role: "OWNER",
          userId: { not: user.id },
        },
      });
      if (otherOwners === 0) {
        blockedOrgs.push(mem.organizer.publicName || mem.organizer.businessName || `Organização #${mem.organizerId}`);
      }
    }

    if (blockedOrgs.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ainda és o único proprietário destas organizações. Transfere a propriedade ou apaga-as antes de eliminar a conta.",
          organizations: blockedOrgs,
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const scheduled = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.profile.update({
      where: { id: user.id },
      data: {
        status: "PENDING_DELETE",
        deletionRequestedAt: now,
        deletionScheduledFor: scheduled,
        visibility: "PRIVATE",
      },
    });

    await logAccountEvent({
      userId: user.id,
      type: "account_delete_requested",
      metadata: { scheduledFor: scheduled },
    });

    await supabase.auth.signOut();

    return NextResponse.json({
      ok: true,
      status: "PENDING_DELETE",
      scheduledFor: scheduled.toISOString(),
      message: "Conta marcada para eliminação. Podes reverter dentro do prazo ao voltar a iniciar sessão.",
    });
  } catch (err) {
    console.error("[settings/delete] erro:", err);
    return NextResponse.json(
      {
        ok: true,
        status: "ERROR",
        warning: "Não foi possível marcar para eliminação. Tenta novamente mais tarde.",
      },
      { status: 200 },
    );
  }
}
