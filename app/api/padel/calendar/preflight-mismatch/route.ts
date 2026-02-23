export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationModule, Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

function parsePositiveInt(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function parseNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeReasonMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, count]) => {
    const numeric = Number(count);
    acc[key] = Number.isFinite(numeric) ? numeric : 0;
    return acc;
  }, {});
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = parsePositiveInt(body.eventId);
  if (!eventId) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const requestFingerprint = parseNonEmptyString(body.requestFingerprint);
  if (!requestFingerprint) return jsonWrap({ ok: false, error: "REQUEST_FINGERPRINT_REQUIRED" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true, templateType: true },
  });
  if (!event?.organizationId || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    allowFallback: true,
  });
  if (!organization || !membership) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const access = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!access.ok) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const dedupeWindowStart = new Date(Date.now() - 5 * 60 * 1000);
  const duplicateRows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM app_v3.organization_audit_logs audit
      WHERE audit.organization_id = ${event.organizationId}
        AND audit.actor_user_id = ${user.id}::uuid
        AND audit.action = 'PADEL_CALENDAR_PREFLIGHT_MISMATCH'
        AND audit.created_at >= ${dedupeWindowStart}
        AND COALESCE(audit.metadata->>'eventId', '') = ${String(eventId)}
        AND COALESCE(audit.metadata->>'requestFingerprint', '') = ${requestFingerprint}
    ) AS "exists"
  `);
  const isDuplicate = duplicateRows[0]?.exists === true;
  if (isDuplicate) {
    return jsonWrap({ ok: true, deduped: true }, { status: 200 });
  }

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: user.id,
    action: "PADEL_CALENDAR_PREFLIGHT_MISMATCH",
    metadata: {
      eventId: event.id,
      requestFingerprint,
      previewScheduledCount: parseNumber(body.previewScheduledCount),
      previewSkippedCount: parseNumber(body.previewSkippedCount),
      applyScheduledCount: parseNumber(body.applyScheduledCount),
      applySkippedCount: parseNumber(body.applySkippedCount),
      previewUnscheduledByReason: sanitizeReasonMap(body.previewUnscheduledByReason),
      applyUnscheduledByReason: sanitizeReasonMap(body.applyUnscheduledByReason),
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap({ ok: true, recorded: true }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
