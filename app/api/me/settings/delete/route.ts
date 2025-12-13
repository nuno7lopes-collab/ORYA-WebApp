import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clearUsernameForOwner } from "@/lib/globalUsernames";

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
        blockedOrgs.push(mem.organizer.displayName || mem.organizer.businessName || `Organização #${mem.organizerId}`);
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

    await prisma.$transaction([
      prisma.profile.updateMany({
        where: { id: user.id },
        data: {
          isDeleted: true,
          deletedAt: now,
          visibility: "PRIVATE",
          username: null,
          fullName: "Conta apagada",
          bio: null,
          city: null,
          avatarUrl: null,
        },
      }),
      prisma.event.updateMany({
        where: { ownerUserId: user.id },
        data: { isDeleted: true, deletedAt: now, status: "CANCELLED" },
      }),
      prisma.eventInterest.deleteMany({ where: { userId: user.id } }),
      prisma.experienceParticipant.deleteMany({ where: { userId: user.id } }),
      prisma.staffAssignment.deleteMany({ where: { userId: user.id } }),
      prisma.ticketReservation.deleteMany({ where: { userId: user.id } }),
      prisma.ticketTransfer.deleteMany({
        where: {
          OR: [{ fromUserId: user.id }, { toUserId: user.id }],
        },
      }),
      prisma.ticketResale.deleteMany({ where: { sellerUserId: user.id } }),

      // Desassociar organizers legacy e memberships
      prisma.organizer.updateMany({
        where: { userId: user.id },
        data: { userId: null },
      }),
      // Limpar memberships deste user (não apaga organizers, só a ligação)
      prisma.organizerMember.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    // Limpa handle global do utilizador e de organizadores que lhe pertençam
    await prisma.$transaction(async (tx) => {
      await clearUsernameForOwner({ ownerType: "user", ownerId: user.id, tx });
      const orgIds = await tx.organizer.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      if (orgIds.length > 0) {
        await Promise.all(
          orgIds.map(({ id }) => clearUsernameForOwner({ ownerType: "organizer", ownerId: id, tx })),
        );
      }
    });

    // Supabase Auth: hard delete
    let authDeleted = true;
    try {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteError) {
        authDeleted = false;
        console.error("[settings/delete] supabase delete error (hard):", deleteError);
      }
    } catch (e) {
      authDeleted = false;
      console.error("[settings/delete] supabase delete exception:", e);
    }

    await supabase.auth.signOut();

    return NextResponse.json({
      ok: true,
      authDeleted,
      warning: authDeleted
        ? null
        : "Conta marcada como apagada, mas não foi possível remover no Auth. Contacta suporte.",
    });
  } catch (err) {
    console.error("[settings/delete] erro:", err);
    return NextResponse.json(
      {
        ok: true,
        authDeleted: false,
        warning:
          "Conta marcada como apagada, mas não foi possível remover no Auth. Contacta suporte.",
      },
      { status: 200 },
    );
  }
}
