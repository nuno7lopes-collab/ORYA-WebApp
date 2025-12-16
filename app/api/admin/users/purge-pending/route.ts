import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { logAccountEvent } from "@/lib/accountEvents";

async function ensureAdmin() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, status: 401 as const, reason: "UNAUTHENTICATED" as const };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  if (!isAdmin) {
    return { ok: false as const, status: 403 as const, reason: "FORBIDDEN" as const };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await ensureAdmin();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.reason }, { status: admin.status });
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

          await tx.organizer.updateMany({
            where: { userId: profile.id },
            data: { userId: null },
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
