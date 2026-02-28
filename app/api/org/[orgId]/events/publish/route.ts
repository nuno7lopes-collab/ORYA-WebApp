import { NextRequest } from "next/server";
import crypto from "crypto";
import { EventStatus, OrganizationModule, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordSearchIndexOutbox } from "@/domain/searchIndex/outbox";
import { EventResourceClaimsError, syncEventResourceClaims } from "@/lib/events/resourceClaims";

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  return respondError(
    ctx,
    { errorCode, message, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "PROFILE_NOT_FOUND", false);
    }

    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return fail(ctx, 400, "ORG_ID_REQUIRED", "ORG_ID_REQUIRED", false);
    }

    const body = (await req.json().catch(() => null)) as { eventId?: number } | null;
    const eventId = Number(body?.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return fail(ctx, 400, "EVENT_ID_REQUIRED", "EVENT_ID_REQUIRED", false);
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        organizationId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        consumesResources: true,
      },
    });
    if (!event || !event.organizationId || event.organizationId !== orgResolution.organizationId) {
      return fail(ctx, 404, "EVENT_NOT_FOUND", "EVENT_NOT_FOUND", false);
    }
    if (!event.endsAt || Number.isNaN(event.endsAt.getTime())) {
      return fail(ctx, 409, "EVENT_ENDS_AT_REQUIRED", "EVENT_ENDS_AT_REQUIRED", false);
    }

    const membership = await resolveGroupMemberForOrg({
      organizationId: event.organizationId,
      userId: profile.id,
    });
    if (!membership) {
      return fail(ctx, 403, "FORBIDDEN", "FORBIDDEN", false);
    }

    const access = await ensureMemberModuleAccess({
      organizationId: event.organizationId,
      userId: profile.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.EVENTOS,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN", "FORBIDDEN", false);
    }

    const nextStatus = EventStatus.PUBLISHED;
    const statusChanged = event.status !== nextStatus;

    await prisma.$transaction(async (tx) => {
      if (statusChanged) {
        await tx.event.update({
          where: { id: eventId },
          data: { status: nextStatus },
        });
      }

      await syncEventResourceClaims({
        tx,
        organizationId: event.organizationId!,
        eventId,
        startsAt: event.startsAt,
        endsAt: event.endsAt!,
        status: nextStatus,
        consumesResources: event.consumesResources,
      });

      const eventLogId = crypto.randomUUID();
      const idempotencyKey = `event.published:${eventId}:${statusChanged ? "1" : "0"}`;
      await appendEventLog(
        {
          eventId: eventLogId,
          organizationId: event.organizationId!,
          eventType: "event.updated",
          idempotencyKey,
          actorUserId: user.id,
          sourceType: SourceType.EVENT,
          sourceId: String(eventId),
          correlationId: String(eventId),
          payload: {
            eventId,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            status: nextStatus,
            organizationId: event.organizationId,
          },
        },
        tx,
      );
      await recordOutboxEvent(
        {
          eventId: eventLogId,
          eventType: "event.updated",
          dedupeKey: idempotencyKey,
          payload: {
            eventId,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            status: nextStatus,
            organizationId: event.organizationId,
          },
          correlationId: String(eventId),
        },
        tx,
      );
      await recordSearchIndexOutbox(
        {
          eventLogId,
          organizationId: event.organizationId!,
          sourceType: SourceType.EVENT,
          sourceId: String(eventId),
          correlationId: String(eventId),
        },
        tx,
      );
    });

    return respondOk(ctx, { published: true, eventId, status: nextStatus });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "Não autenticado.");
    }
    if (err instanceof EventResourceClaimsError) {
      return fail(
        ctx,
        err.status,
        err.message || "Conflito de agenda de recursos do evento.",
        err.code || "EVENT_RESOURCES_CONFLICT",
        false,
        err.details,
      );
    }
    console.error("POST /api/org/[orgId]/events/publish error:", err);
    return fail(ctx, 500, "Erro interno ao publicar evento.");
  }
}

export const POST = withApiEnvelope(_POST);
