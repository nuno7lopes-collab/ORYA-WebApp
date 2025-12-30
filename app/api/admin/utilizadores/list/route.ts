import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

async function getAdminProfile() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, profile: null, error: "UNAUTHENTICATED" };
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });

  if (!profile || !Array.isArray(profile.roles) || !profile.roles.includes("admin")) {
    return { user: null, profile: null, error: "FORBIDDEN" };
  }

  return { user, profile, error: null };
}

export async function GET(req: NextRequest) {
  try {
    // 1) Garantir que é admin
    const { error } = await getAdminProfile();

    if (error === "UNAUTHENTICATED") {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    if (error === "FORBIDDEN") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    // 2) Ler query params
    const { searchParams } = new URL(req.url);

    const search = (searchParams.get("search") || "").trim();
    const role = (searchParams.get("role") || "").trim();

    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");

    let limit = Number(limitRaw ?? 50);
    let offset = Number(offsetRaw ?? 0);

    if (!Number.isFinite(limit) || limit <= 0 || limit > 200) {
      limit = 50;
    }
    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }

    // 3) Construir filtro Prisma
    const where: Prisma.ProfileWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      // Campo roles é um array de strings; usamos has
      where.roles = { has: role };
    }

    // 4) Query com contagem + items
    const [total, items] = await prisma.$transaction([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          username: true,
          fullName: true,
          city: true,
          roles: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      total,
      limit,
      offset,
      items,
    });
  } catch (err) {
    console.error("[admin/utilizadores/list] Erro a carregar utilizadores:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}