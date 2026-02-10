import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTake(value: string | null) {
  const takeRaw = Number(value ?? DEFAULT_TAKE);
  if (!Number.isFinite(takeRaw) || takeRaw <= 0) return DEFAULT_TAKE;
  return Math.min(takeRaw, MAX_TAKE);
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function resolveActorIds(actor?: string | null) {
  const raw = (actor ?? "").trim();
  if (!raw) return null;
  if (UUID_REGEX.test(raw)) return [raw];

  const profiles = await prisma.profile.findMany({
    where: {
      OR: [
        { username: { contains: raw, mode: "insensitive" } },
        { fullName: { contains: raw, mode: "insensitive" } },
        { users: { email: { contains: raw, mode: "insensitive" } } },
      ],
    },
    select: { id: true },
    take: 25,
  });
  return profiles.map((profile) => profile.id);
}

function buildTypeFilter(typeRaw: string | null): Prisma.StringFilter | null {
  const raw = (typeRaw ?? "").trim();
  if (!raw) return null;
  if (raw.includes(",")) {
    const types = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (types.length > 0) {
      return { in: types };
    }
  }
  if (raw.endsWith("*") && raw.length > 1) {
    return { startsWith: raw.slice(0, -1) };
  }
  return { equals: raw };
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const typeRaw = searchParams.get("type");
    const actorRaw = searchParams.get("actor");
    const orgIdRaw = searchParams.get("orgId");
    const scope = (searchParams.get("scope") || "admin").trim().toLowerCase();
    const cursor = searchParams.get("cursor");
    const take = parseTake(searchParams.get("take"));
    const fromDate = parseDate(searchParams.get("from"));
    const toDate = parseDate(searchParams.get("to"));

    const where: Prisma.EventLogWhereInput = {};
    const andFilters: Prisma.EventLogWhereInput[] = [];

    if (scope !== "all") {
      andFilters.push({ eventType: { startsWith: "ADMIN_" } });
    }

    const typeFilter = buildTypeFilter(typeRaw);
    if (typeFilter) {
      andFilters.push({ eventType: typeFilter });
    }

    if (orgIdRaw && Number.isFinite(Number(orgIdRaw))) {
      andFilters.push({ organizationId: Number(orgIdRaw) });
    }

    if (fromDate || toDate) {
      andFilters.push({
        createdAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      });
    }

    const actorIds = await resolveActorIds(actorRaw);
    if (actorRaw && actorIds && actorIds.length === 0) {
      return jsonWrap({ ok: true, items: [], pagination: { nextCursor: null, hasMore: false } }, { status: 200 });
    }
    if (actorIds && actorIds.length > 0) {
      andFilters.push({ actorUserId: { in: actorIds } });
    }

    if (q) {
      if (UUID_REGEX.test(q)) {
        where.OR = [
          { id: q },
          { actorUserId: q },
          { correlationId: q },
          { sourceId: q },
          { subjectId: q },
          { idempotencyKey: q },
        ];
      } else {
        where.OR = [
          { eventType: { contains: q, mode: "insensitive" } },
          { correlationId: { contains: q, mode: "insensitive" } },
          { sourceId: { contains: q, mode: "insensitive" } },
          { subjectId: { contains: q, mode: "insensitive" } },
          { subjectType: { contains: q, mode: "insensitive" } },
          { idempotencyKey: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const logs = await prisma.eventLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        eventType: true,
        eventVersion: true,
        createdAt: true,
        actorUserId: true,
        correlationId: true,
        sourceType: true,
        sourceId: true,
        subjectType: true,
        subjectId: true,
        idempotencyKey: true,
        payload: true,
        organization: { select: { id: true, publicName: true } },
      },
    });

    const hasMore = logs.length > take;
    const trimmed = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    const actorIdsSet = Array.from(
      new Set(trimmed.map((log) => log.actorUserId).filter((id): id is string => Boolean(id))),
    );
    const profiles = actorIdsSet.length
      ? await prisma.profile.findMany({
          where: { id: { in: actorIdsSet } },
          select: { id: true, username: true, fullName: true, users: { select: { email: true } } },
        })
      : [];
    const actorById = new Map(profiles.map((profile) => [profile.id, profile]));

    const items = trimmed.map((log) => {
      const actor = log.actorUserId ? actorById.get(log.actorUserId) : null;
      return {
        id: log.id,
        eventType: log.eventType,
        eventVersion: log.eventVersion,
        createdAt: log.createdAt,
        actorUserId: log.actorUserId,
        actor: actor
          ? {
              id: actor.id,
              name: actor.fullName || actor.username || null,
              email: actor.users?.email ?? null,
            }
          : null,
        correlationId: log.correlationId,
        sourceType: log.sourceType,
        sourceId: log.sourceId,
        subjectType: log.subjectType,
        subjectId: log.subjectId,
        idempotencyKey: log.idempotencyKey,
        payload: log.payload,
        organization: log.organization,
      };
    });

    return jsonWrap({ ok: true, items, pagination: { nextCursor, hasMore } }, { status: 200 });
  } catch (err) {
    logError("admin.audit.list_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
