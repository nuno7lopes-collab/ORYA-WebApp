export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { getLatestBucketDate, runAnalyticsRollupJob } from "@/domain/analytics/rollup";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";
import { getRequestContext } from "@/lib/http/requestContext";

type RollupPayload = {
  organizationId?: number;
  fromDate?: string;
  toDate?: string;
  maxDays?: number;
};

function normalizeRoles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((role): role is string => typeof role === "string");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((role): role is string => typeof role === "string");
        }
      } catch {
        /* ignore */
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1);
      if (!inner) return [];
      return inner
        .split(",")
        .map((role) => role.trim().replace(/^\"|\"$/g, ""))
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function requireOpsRole(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  const roles = normalizeRoles(profile?.roles);
  return roles.includes("ops");
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

    const latest = await getLatestBucketDate(orgId);
    return jsonWrap({ ok: true, latestBucketDate: latest ? toIsoDate(latest) : null });
  } catch (err) {
    logError("admin.ops.analytics_rollups_get_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    const ctx = getRequestContext(req);
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const hasOps = await requireOpsRole(admin.userId);
    if (!hasOps) {
      return jsonWrap({ ok: false, error: "OPS_FORBIDDEN" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as RollupPayload | null;
    const organizationId =
      typeof payload?.organizationId === "number" ? payload.organizationId : null;
    if (!organizationId || !Number.isFinite(organizationId)) {
      return jsonWrap({ ok: false, error: "INVALID_ORG_ID" }, { status: 400 });
    }

    const fromDate = typeof payload?.fromDate === "string" ? payload.fromDate : undefined;
    const toDate = typeof payload?.toDate === "string" ? payload.toDate : undefined;
    const maxDays = typeof payload?.maxDays === "number" ? payload.maxDays : undefined;

    if (!fromDate && !toDate) {
      const latest = await getLatestBucketDate(organizationId);
      const latestIso = latest ? toIsoDate(latest) : null;
      const todayIso = toIsoDate(new Date());
      if (latestIso && latestIso === todayIso) {
        await auditAdminAction({
          action: "OPS_ANALYTICS_ROLLUP_TRIGGER",
          actorUserId: admin.userId,
          correlationId: ctx.correlationId,
          payload: {
            organizationId,
            status: "ALREADY_FRESH",
            latestBucketDate: latestIso,
          },
        });
        return jsonWrap({ ok: true, status: "ALREADY_FRESH", latestBucketDate: latestIso });
      }
    }

    const result = await runAnalyticsRollupJob({
      organizationId,
      fromDate,
      toDate,
      maxDays,
    });
    const { ok: _ok, ...rest } = result;
    const latest = await getLatestBucketDate(organizationId);
    await auditAdminAction({
      action: "OPS_ANALYTICS_ROLLUP_TRIGGER",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: {
        organizationId,
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
        maxDays: maxDays ?? null,
        status: "TRIGGERED",
        latestBucketDate: latest ? toIsoDate(latest) : null,
      },
    });
    return jsonWrap({
      ok: true,
      status: "TRIGGERED",
      latestBucketDate: latest ? toIsoDate(latest) : null,
      ...rest,
    });
  } catch (err) {
    logError("admin.ops.analytics_rollups_post_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
