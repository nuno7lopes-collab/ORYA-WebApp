import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

const MAX_LIMIT = 50;

function parseLimit(value: string | null) {
  const raw = Number(value ?? 12);
  if (!Number.isFinite(raw)) return 12;
  return Math.min(Math.max(raw, 1), MAX_LIMIT);
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
    const entries = await prisma.eventLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
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

    const items = entries.map((entry) => ({
      id: entry.id,
      type: entry.eventType,
      actorId: entry.actorUserId ?? null,
      orgId: entry.organizationId,
      sourceEventId: entry.sourceId ?? null,
      status: resolveStatus(entry.payload),
      createdAt: entry.createdAt.toISOString(),
    }));

    return jsonWrap({ ok: true, items });
  } catch (err) {
    logError("admin.organizacoes.event_log_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
