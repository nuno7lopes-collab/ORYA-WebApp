

// app/api/organizador/become/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }

    // Procurar organizer existente para este user
    let organizer = await prisma.organizer.findFirst({
      where: { userId: profile.id },
    });

    const displayName =
      profile.fullName?.trim() || profile.username || "Organizador";

    if (!organizer) {
      organizer = await prisma.organizer.create({
        data: {
          userId: profile.id,
          displayName,
          status: "PENDING",
        },
      });
    } else {
      organizer = await prisma.organizer.update({
        where: { id: organizer.id },
        data: {
          status: "PENDING",
          displayName,
        },
      });
    }

    // Não adicionamos role organizer aqui — só após aprovação admin
    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: organizer.id,
          displayName: organizer.displayName,
          status: organizer.status,
          stripeAccountId: organizer.stripeAccountId,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao enviar candidatura de organizador." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    await prisma.organizer.deleteMany({
      where: { userId: user.id, status: "PENDING" },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao cancelar candidatura." },
      { status: 500 },
    );
  }
}
