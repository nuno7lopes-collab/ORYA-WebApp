import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { logAccountEvent } from "@/lib/accountEvents";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const now = new Date();
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);

    const pending = await prisma.profile.findMany({
      where: {
        status: "PENDING_DELETE",
        deletionScheduledFor: { lte: now },
      },
      take: limit,
      select: { id: true, username: true, fullName: true, roles: true },
    });

    for (const profile of pending) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.profile.update({
            where: { id: profile.id },
            data: {
              status: "DELETED",
              deletedAtFinal: now,
              isDeleted: true,
              visibility: "PRIVATE",
              username: null,
              fullName: "Conta apagada",
              bio: null,
              city: null,
              avatarUrl: null,
              contactPhone: null,
              roles: ["user"],
            },
          });

          await clearUsernameForOwner({ ownerType: "user", ownerId: profile.id, tx });

          await tx.organizationMember.deleteMany({
            where: { userId: profile.id },
          });
        });

        await logAccountEvent({
          userId: profile.id,
          type: "account_delete_completed",
          metadata: { reason: "scheduled_purge" },
        });

        try {
          await supabaseAdmin.auth.admin.deleteUser(profile.id);
        } catch (authErr) {
          console.warn("[purge-pending] falha a remover no auth", authErr);
        }
      } catch (userErr) {
        console.error("[purge-pending] erro ao anonimizar user", { id: profile.id, userErr });
      }
    }

    return NextResponse.json({ ok: true, processed: pending.length }, { status: 200 });
  } catch (err) {
    console.error("[admin/users/purge-pending]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
