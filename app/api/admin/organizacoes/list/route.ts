import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/observability/logger";
import { AnalyticsDimensionKey, AnalyticsMetricKey, EntitlementType, OrganizationStatus, OrgType, Prisma as PrismaTypes } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

type CursorPayload = { createdAt: Date; id: number };

function parseLimit(value: string | null) {
  const raw = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(raw, 1), MAX_LIMIT);
}

function parseEnum<T extends string>(raw: string | null, allowed: Set<T>) {
  if (!raw) return null;
  return allowed.has(raw as T) ? (raw as T) : null;
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(`${payload.createdAt.toISOString()}::${payload.id}`, "utf8").toString("base64");
}

function parseCursor(raw: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const [createdAtRaw, idRaw] = decoded.split("::");
    if (!createdAtRaw || !idRaw) return null;
    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime())) return null;
    const id = Number(idRaw);
    if (!Number.isFinite(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const params = req.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const status = parseEnum(
      params.get("status")?.trim() ?? null,
      new Set(Object.values(OrganizationStatus)),
    );
    const orgType = parseEnum(params.get("orgType")?.trim() ?? null, new Set(Object.values(OrgType)));
    const query = params.get("q")?.trim();
    const cursor = parseCursor(params.get("cursor"));
    if (params.get("cursor") && !cursor) {
      return jsonWrap({ ok: false, error: "INVALID_CURSOR" }, { status: 400 });
    }

    const andFilters: Prisma.OrganizationWhereInput[] = [];
    if (status) {
      andFilters.push({ status });
    }
    if (orgType) {
      andFilters.push({ orgType });
    }
    if (query) {
      andFilters.push({
        OR: [
          { publicName: { contains: query, mode: "insensitive" } },
          { officialEmail: { contains: query, mode: "insensitive" } },
        ],
      });
    }
    if (cursor) {
      andFilters.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    }

    const where = andFilters.length > 0 ? { AND: andFilters } : undefined;

    const organizations = await prisma.organization.findMany({
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where,
      select: {
        id: true,
        publicName: true,
        status: true,
        createdAt: true,
        orgType: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        members: {
          where: { role: "OWNER" },
          take: 1,
          select: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                users: { select: { email: true } },
              },
            },
          },
        },
      },
    });

    const hasMore = organizations.length > limit;
    const slice = organizations.slice(0, limit);
    const nextCursor = hasMore && slice.length > 0 ? encodeCursor(slice[slice.length - 1]) : null;
    const orgIds = slice.map((org) => org.id);
    const eventsCounts = orgIds.length
      ? await prisma.event.groupBy({
          by: ["organizationId"],
          where: { organizationId: { in: orgIds } },
          _count: { _all: true },
        })
      : [];
    const eventsCountMap = new Map(eventsCounts.map((row) => [row.organizationId, row._count._all ?? 0]));

    const ticketsRows = orgIds.length
      ? await prisma.$queryRaw<{ organization_id: number; total: bigint }[]>(PrismaTypes.sql`
          SELECT ev.organization_id, COUNT(*)::bigint AS total
          FROM app_v3.entitlements ent
          JOIN app_v3.events ev ON ev.id = ent.event_id
          WHERE ev.organization_id IN (${PrismaTypes.join(orgIds)})
            AND ent.type IN (${PrismaTypes.join([EntitlementType.EVENT_TICKET, EntitlementType.PADEL_ENTRY])})
          GROUP BY ev.organization_id
        `)
      : [];
    const ticketsMap = new Map(ticketsRows.map((row) => [row.organization_id, Number(row.total ?? 0)]));

    const revenueRows = orgIds.length
      ? await prisma.$queryRaw<{ organization_id: number; total: bigint }[]>(PrismaTypes.sql`
          SELECT organization_id, SUM(value)::bigint AS total
          FROM app_v3.analytics_rollups
          WHERE organization_id IN (${PrismaTypes.join(orgIds)})
            AND metric_key = ${AnalyticsMetricKey.NET_TO_ORG}
            AND dimension_key = ${AnalyticsDimensionKey.CURRENCY}
          GROUP BY organization_id
        `)
      : [];
    const revenueMap = new Map(revenueRows.map((row) => [row.organization_id, Number(row.total ?? 0)]));

    const normalized = slice.map((org) => {
      const ownerUser = org.members[0]?.user ?? null;
      return {
        id: org.id,
        publicName: org.publicName,
        status: org.status,
        createdAt: org.createdAt.toISOString(),
        orgType: org.orgType,
        stripeAccountId: org.stripeAccountId,
        stripeChargesEnabled: org.stripeChargesEnabled,
        stripePayoutsEnabled: org.stripePayoutsEnabled,
        officialEmail: org.officialEmail,
        officialEmailVerifiedAt: org.officialEmailVerifiedAt?.toISOString() ?? null,
        owner: ownerUser
          ? {
              id: ownerUser.id,
              username: ownerUser.username,
              fullName: ownerUser.fullName,
              email: ownerUser.users?.email ?? null,
            }
          : null,
        eventsCount: eventsCountMap.get(org.id) ?? 0,
        totalTickets: ticketsMap.get(org.id) ?? 0,
        totalRevenueCents: revenueMap.get(org.id) ?? 0,
      };
    });

    return jsonWrap({ ok: true, organizations: normalized, page: { nextCursor } });
  } catch (err) {
    logError("admin.organizacoes.list_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
