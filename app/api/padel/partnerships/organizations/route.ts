export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PadelClubKind } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensurePartnershipOrganization } from "@/app/api/padel/partnerships/_shared";

async function _GET(req: NextRequest) {
  const check = await ensurePartnershipOrganization({ req, required: "VIEW" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitRaw) ? Math.min(25, Math.max(1, Math.floor(limitRaw))) : 8;

  const textFilter = query
    ? {
        OR: [
          { username: { contains: query, mode: "insensitive" as const } },
          { publicName: { contains: query, mode: "insensitive" as const } },
          { businessName: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const organizations = await prisma.organization.findMany({
    where: {
      id: { not: check.organization.id },
      ...textFilter,
      padelClubs: {
        some: {
          deletedAt: null,
          isActive: true,
          kind: PadelClubKind.OWN,
        },
      },
    },
    select: {
      id: true,
      username: true,
      publicName: true,
      businessName: true,
      padelClubs: {
        where: {
          deletedAt: null,
          isActive: true,
          kind: PadelClubKind.OWN,
        },
        select: { id: true, name: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
      },
    },
    orderBy: [{ publicName: "asc" }, { businessName: "asc" }, { username: "asc" }],
    take: limit,
  });

  return jsonWrap(
    {
      ok: true,
      items: organizations.map((organization) => ({
        id: organization.id,
        username: organization.username,
        name:
          organization.publicName ||
          organization.businessName ||
          (organization.username ? `@${organization.username}` : "Organização"),
        clubId: organization.padelClubs[0]?.id ?? null,
        clubName: organization.padelClubs[0]?.name ?? null,
      })),
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
