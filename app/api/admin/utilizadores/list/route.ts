import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
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

    return jsonWrap({
      ok: true,
      total,
      limit,
      offset,
      items,
    });
  } catch (err) {
    logError("admin.utilizadores.list_failed", err);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
