import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { OrganizationStatus, Prisma } from "@prisma/client";

/**
 * 6.11 – Listar organizações (admin)
 *
 * GET /api/admin/organizacoes/list
 *
 * Query params opcionais:
 *  - search: string (filtra por publicName com contains, case-insensitive)
 *  - status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' (ou outros valores do enum OrganizationStatus)
 *  - page: número da página (1-based, default 1)
 *  - pageSize: tamanho da página (default 20, máx 100)
 *
 * Apenas utilizadores com role "admin" podem aceder.
 */

function parsePositiveInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return Math.floor(n);
}

type AdminAuthError = "UNAUTHENTICATED" | "FORBIDDEN" | null;

async function getAdminUserId(): Promise<{
  userId: string | null;
  error: AdminAuthError;
}> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { userId: null, error: "UNAUTHENTICATED" };
  }

  // Verificar se este user tem role "admin" no profile
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { roles: true },
  });

  const rolesArray = Array.isArray(profile?.roles) ? profile?.roles : [];

  if (!rolesArray.includes("admin")) {
    return { userId: null, error: "FORBIDDEN" };
  }

  return { userId: user.id, error: null };
}

export async function GET(req: NextRequest) {
  try {
    // 1) Guard de admin
    const { userId, error } = await getAdminUserId();

    if (error === "UNAUTHENTICATED") {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    if (error === "FORBIDDEN") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // userId neste momento não é usado na query, mas pode ser útil no futuro
    void userId;

    // 2) Ler query params
    const url = new URL(req.url);
    const searchParam = url.searchParams.get("search");
    const statusParam = url.searchParams.get("status");
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    const page = parsePositiveInt(pageParam, 1);
    const pageSizeRaw = parsePositiveInt(pageSizeParam, 20);
    const pageSize = Math.min(pageSizeRaw, 100);

    const skip = (page - 1) * pageSize;

    // 3) Construir filtros
    let statusFilter: OrganizationStatus | undefined;

    if (
      statusParam &&
      (Object.values(OrganizationStatus) as string[]).includes(statusParam)
    ) {
      statusFilter = statusParam as OrganizationStatus;
    }

    const where: Prisma.OrganizationWhereInput = {};

    if (statusFilter) {
      where.status = statusFilter;
    }

    if (searchParam && searchParam.trim() !== "") {
      const search = searchParam.trim();
      where.publicName = {
        contains: search,
        mode: "insensitive",
      };
    }

    // 4) Query com paginação
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.organization.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json(
      {
        ok: true,
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[/api/admin/organizacoes/list] Erro inesperado:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
