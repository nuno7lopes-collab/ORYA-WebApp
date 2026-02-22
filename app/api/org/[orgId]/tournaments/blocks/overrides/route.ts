import crypto from "crypto";
import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { OrganizationModule } from "@prisma/client";

const DEFAULT_CONFLICT_POLICY = "CASCADE_SAME_COURT" as const;
const SUPPORTED_OVERRIDE_POLICIES = ["REJECT_ON_CONFLICT", "FORCE_OVERRIDE"] as const;
const REASON_CODE_PATTERN = /^[A-Z0-9_]{3,64}$/;

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parseLimit(value: string | null) {
  const parsed = value ? Number(value) : 50;
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
}

function parseCursor(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseReasonCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!REASON_CODE_PATTERN.test(normalized)) return null;
  return normalized;
}

function parseOverridePolicy(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === DEFAULT_CONFLICT_POLICY) return null;
  if (!SUPPORTED_OVERRIDE_POLICIES.includes(normalized as (typeof SUPPORTED_OVERRIDE_POLICIES)[number])) {
    return null;
  }
  return normalized as (typeof SUPPORTED_OVERRIDE_POLICIES)[number];
}

async function resolveOrgContext(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!profile) return null;

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
    organizationId: organizationId ?? undefined,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization || !membership) return null;

  const moduleAccess = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!moduleAccess.ok) {
    return { user, profile, organization, membership, moduleAccess, reservasAccess: null, emailGate: null };
  }

  const reservasAccess = await ensureReservasModuleAccess(organization);
  if (!reservasAccess.ok) {
    return { user, profile, organization, membership, moduleAccess, reservasAccess, emailGate: null };
  }

  const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TOURNAMENT_BLOCKS_OVERRIDE" });
  return { user, profile, organization, membership, moduleAccess, reservasAccess, emailGate };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const context = await resolveOrgContext(req);
    if (!context) return fail(ctx, 403, "FORBIDDEN");
    if (!context.moduleAccess?.ok) return fail(ctx, 403, "FORBIDDEN");
    if (!context.reservasAccess?.ok) {
      return fail(ctx, 403, context.reservasAccess?.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");
    }
    if (!context.emailGate?.ok) {
      return fail(
        ctx,
        403,
        context.emailGate?.errorCode ?? "FORBIDDEN",
        context.emailGate?.errorCode ?? "FORBIDDEN",
        false,
        { reason: context.emailGate?.message ?? null },
      );
    }

    const payload = (await req.json().catch(() => null)) as
      | {
          eventId?: unknown;
          operationId?: unknown;
          softBlockId?: unknown;
          conflictPolicy?: unknown;
          reasonCode?: unknown;
          reason?: unknown;
        }
      | null;
    if (!payload) return fail(ctx, 400, "INVALID_PAYLOAD");

    const eventId = parsePositiveInt(payload.eventId);
    const operationId = typeof payload.operationId === "string" ? payload.operationId.trim() : "";
    const softBlockId = parsePositiveInt(payload.softBlockId);
    const conflictPolicy = parseOverridePolicy(payload.conflictPolicy);
    const reasonCode = parseReasonCode(payload.reasonCode);
    const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

    if (!eventId || (!operationId && !softBlockId) || !conflictPolicy || !reasonCode) {
      return fail(ctx, 400, "INVALID_PAYLOAD");
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: context.organization.id, isDeleted: false, templateType: "PADEL" },
      select: { id: true },
    });
    if (!event) return fail(ctx, 404, "EVENT_NOT_FOUND");

    if (softBlockId) {
      const block = await prisma.softBlock.findFirst({
        where: {
          id: softBlockId,
          organizationId: context.organization.id,
          scopeType: "COURT",
        },
        select: { id: true },
      });
      if (!block) return fail(ctx, 404, "SOFT_BLOCK_NOT_FOUND");
    }

    const overrideId = crypto.randomUUID();
    await recordOrganizationAudit(prisma, {
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      action: "tournament.blocks.override.created",
      entityType: "TOURNAMENT_BLOCK_OVERRIDE",
      entityId: overrideId,
      correlationId: operationId || overrideId,
      metadata: {
        overrideId,
        eventId,
        operationId: operationId || null,
        softBlockId: softBlockId ?? null,
        conflictPolicy,
        reasonCode,
        reason: reason || null,
      },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    return respondOk(
      ctx,
      {
        data: {
          overrideId,
          eventId,
          operationId: operationId || null,
          softBlockId: softBlockId ?? null,
          conflictPolicy,
          reasonCode,
          reason: reason || null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("POST /api/org/[orgId]/tournaments/blocks/overrides error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const context = await resolveOrgContext(req);
    if (!context) return fail(ctx, 403, "FORBIDDEN");
    if (!context.moduleAccess?.ok) return fail(ctx, 403, "FORBIDDEN");

    const eventId = parsePositiveInt(req.nextUrl.searchParams.get("eventId"));
    const cursor = parseCursor(req.nextUrl.searchParams.get("cursor"));
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    if (!eventId) return fail(ctx, 400, "INVALID_EVENT");

    const rows = await prisma.organizationAuditLog.findMany({
      where: {
        organizationId: context.organization.id,
        action: "tournament.blocks.override.created",
        ...(cursor ? { createdAt: { lt: cursor } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit * 4,
      select: {
        id: true,
        action: true,
        entityId: true,
        actorUserId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const filtered = rows
      .filter((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        const metadataEventId = parsePositiveInt(metadata.eventId);
        return metadataEventId === eventId;
      })
      .slice(0, limit)
      .map((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        return {
          auditId: row.id,
          overrideId: typeof metadata.overrideId === "string" ? metadata.overrideId : row.entityId,
          eventId,
          operationId: typeof metadata.operationId === "string" ? metadata.operationId : null,
          softBlockId: parsePositiveInt(metadata.softBlockId),
          conflictPolicy: typeof metadata.conflictPolicy === "string" ? metadata.conflictPolicy : null,
          reasonCode: typeof metadata.reasonCode === "string" ? metadata.reasonCode : null,
          reason: typeof metadata.reason === "string" ? metadata.reason : null,
          actorUserId: row.actorUserId,
          createdAt: row.createdAt?.toISOString() ?? null,
        };
      });

    const nextCursor =
      filtered.length === limit
        ? filtered[filtered.length - 1]?.createdAt ?? null
        : null;

    return respondOk(ctx, {
      data: {
        items: filtered,
        nextCursor,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("GET /api/org/[orgId]/tournaments/blocks/overrides error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const POST = withApiEnvelope(_POST);
export const GET = withApiEnvelope(_GET);
