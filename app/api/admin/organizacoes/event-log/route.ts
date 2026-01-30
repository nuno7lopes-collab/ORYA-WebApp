import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";
import type { Prisma } from "@prisma/client";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 12;

type CursorPayload = { createdAt: Date; id: string };

function parseLimit(value: string | null) {
  const raw = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(raw, 1), MAX_LIMIT);
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(`${payload.createdAt.toISOString()}::${payload.id}`, "utf8").toString("base64");
}

function parseCursor(raw: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const [createdAtRaw, id] = decoded.split("::");
    if (!createdAtRaw || !id) return null;
    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function resolveStatus(payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (typeof record.status === "string" && record.status.trim()) return record.status;
    if (typeof record.errorCode === "string" && record.errorCode.trim()) return record.errorCode;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
  }
  return "OK";
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const params = req.nextUrl.searchParams;
    const orgIdParam = params.get("orgId") ?? params.get("organizationId");
    const orgId = orgIdParam ? Number(orgIdParam) : NaN;
    if (!orgIdParam || !Number.isFinite(orgId)) {
      return jsonWrap({ ok: false, error: "INVALID_ORG_ID" }, { status: 400 });
    }

    const limit = parseLimit(params.get("limit"));
    const cursor = parseCursor(params.get("cursor"));
    if (params.get("cursor") && !cursor) {
      return jsonWrap({ ok: false, error: "INVALID_CURSOR" }, { status: 400 });
    }
    const eventType = params.get("eventType")?.trim();

    const andFilters: Prisma.EventLogWhereInput[] = [{ organizationId: orgId }];
    if (eventType) {
      andFilters.push({ eventType });
    }
    if (cursor) {
      andFilters.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    }

    const entries = await prisma.eventLog.findMany({
      where: { AND: andFilters },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        eventType: true,
        actorUserId: true,
        organizationId: true,
        sourceId: true,
        createdAt: true,
        payload: true,
      },
    });

    const hasMore = entries.length > limit;
    const slice = entries.slice(0, limit);
    const nextCursor = hasMore && slice.length > 0 ? encodeCursor(slice[slice.length - 1]) : null;
    const items = slice.map((entry) => ({
      id: entry.id,
      type: entry.eventType,
      actorId: entry.actorUserId ?? null,
      orgId: entry.organizationId,
      sourceEventId: entry.sourceId ?? null,
      status: resolveStatus(entry.payload),
      createdAt: entry.createdAt.toISOString(),
    }));

    return jsonWrap({ ok: true, items, page: { nextCursor } });
  } catch (err) {
    logError("admin.organizacoes.event_log_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
