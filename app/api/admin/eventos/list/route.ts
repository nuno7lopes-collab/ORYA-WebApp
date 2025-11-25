import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { Prisma, EventStatus, EventType } from "@prisma/client";

// Fase 6.13 – Listar eventos (admin)
// GET /api/admin/eventos/list
// Permite ao admin pesquisar eventos globalmente por título/slug/organizador

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[admin eventos list] erro auth:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    // Confirmar se é admin via profile.roles
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, roles: true },
    });

    const roles = profile?.roles ?? [];
    const isAdmin = Array.isArray(roles) && roles.includes("admin");

    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim() || "";
    const typeFilter = searchParams.get("type")?.trim() || "";

    const takeRaw = searchParams.get("take");
    const take = Math.min(Math.max(Number(takeRaw) || 50, 1), 200); // entre 1 e 200

    const where: Prisma.EventWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        {
          organizer: {
            displayName: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    if (statusFilter) {
      where.status = statusFilter as EventStatus; // mapeado para o enum EventStatus do Prisma
    }

    if (typeFilter) {
      where.type = typeFilter as EventType; // mapeado para o enum EventType do Prisma
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        organizer: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
    });

    const items = events.map((evt) => ({
      id: evt.id,
      slug: evt.slug,
      title: evt.title,
      status: evt.status,
      type: evt.type,
      startsAt: evt.startsAt,
      endsAt: evt.endsAt,
      createdAt: evt.createdAt,
      organizer: evt.organizer
        ? {
            id: evt.organizer.id,
            displayName: evt.organizer.displayName,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[admin eventos list] erro inesperado:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
