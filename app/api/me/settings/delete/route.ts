import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

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

    const now = new Date();

    await prisma.$transaction([
      prisma.profile.upsert({
        where: { id: user.id },
        update: {
          isDeleted: true,
          deletedAt: now,
          visibility: "PRIVATE",
        },
        create: {
          id: user.id,
          roles: ["user"],
          visibility: "PRIVATE",
          isDeleted: true,
          deletedAt: now,
          favouriteCategories: [],
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
    ]);

    // Supabase Auth: hard delete
    const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("[settings/delete] supabase delete error:", deleteError);
      return NextResponse.json(
        { ok: false, error: deleteError.message || "Erro ao apagar conta no Supabase." },
        { status: 500 },
      );
    }

    // Limpar sessão atual
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[settings/delete] erro:", err);
    return NextResponse.json({ ok: false, error: "Erro ao apagar conta." }, { status: 500 });
  }
}
