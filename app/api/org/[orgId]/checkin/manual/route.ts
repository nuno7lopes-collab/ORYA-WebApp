import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { CheckinMethod, CheckinResultCode, CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { ensureGroupMemberCheckinAccess } from "@/lib/organizationMemberAccess";
import { appendEventLog } from "@/domain/eventLog/append";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getCheckinResultFromExisting, getEntitlementEffectiveStatus } from "@/lib/entitlements/status";
import { resolvePolicyForCheckin } from "@/lib/checkin/accessPolicy";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureEventChatInvite } from "@/lib/chat/invites";
import { createNotification } from "@/lib/notifications";
import { logWarn } from "@/lib/observability/logger";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";
import { isEventCancelledStatus, isEventOperationalStatus } from "@/domain/events/lifecycle";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
type Body = {
  eventId?: number;
  entitlementId?: string;
  deviceId?: string;
  reason?: string;
};

const ENTITLEMENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANUAL_CHECKIN_ENABLED = process.env.CHECKIN_MANUAL_LIST_ENABLED !== "false";

async function ensureOrganization(userId: string, eventId: number, requestOrganizationId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true, status: true, isDeleted: true },
  });
  if (!event) return { ok: false as const, reason: "EVENT_NOT_FOUND" };
  if (!event.organizationId || event.organizationId !== requestOrganizationId) {
    return { ok: false as const, reason: "EVENT_NOT_FOUND" };
  }
  if (event.isDeleted) {
    return { ok: false as const, reason: "EVENT_CLOSED" };
  }
  if (isEventCancelledStatus(event.status)) {
    return { ok: false as const, reason: "EVENT_CANCELLED_TERMINAL" };
  }
  if (!isEventOperationalStatus(event.status)) {
    return { ok: false as const, reason: "EVENT_CLOSED" };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: event.organizationId },
    select: { officialEmail: true, officialEmailVerifiedAt: true },
  });
  if (!organization) return { ok: false as const, reason: "FORBIDDEN_CHECKIN_ACCESS" };
  const emailGate = ensureOrganizationEmailVerified(organization, {
    reasonCode: "CHECKIN",
    organizationId: event.organizationId,
  });
  if (!emailGate.ok) {
    return { ...emailGate, status: 403 };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true, onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) {
    return { ok: false as const, reason: "FORBIDDEN_CHECKIN_ACCESS" };
  }
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");
  if (isAdmin) return { ok: true as const, isAdmin };

  const access = await ensureGroupMemberCheckinAccess({
    organizationId: event.organizationId,
    userId,
    required: "EDIT",
  });
  if (access.ok) {
    return { ok: true as const, isAdmin };
  }

  return { ok: false as const, reason: "FORBIDDEN_CHECKIN_ACCESS" };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };

  if (!MANUAL_CHECKIN_ENABLED) {
    return respondError(
      ctx,
      {
        errorCode: "FEATURE_DISABLED",
        message: "Check-in manual desativado.",
        retryable: false,
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (error || !data?.user) {
    return fail(401, "Not authenticated");
  }
  const userId = data.user.id;

  const limiter = await rateLimit(req, {
    windowMs: 60 * 1000,
    max: 300,
    keyPrefix: "checkin:manual",
    identifier: userId,
  });
  if (!limiter.allowed) {
    logWarn("checkin.manual.rate_limited", { requestId: ctx.requestId, userId, retryAfter: limiter.retryAfter });
    return respondError(
      ctx,
      {
        errorCode: "RATE_LIMITED",
        message: "Demasiados pedidos. Tenta novamente dentro de alguns minutos.",
        retryable: true,
      },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const eventId = Number(body?.eventId);
  const entitlementId = typeof body?.entitlementId === "string" ? body.entitlementId.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  const reasonRaw = typeof body?.reason === "string" ? body.reason.trim() : "";
  const reason = reasonRaw.slice(0, 600);

  const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
  if (!orgResolution.ok) {
    return fail(400, "ORG_ID_REQUIRED");
  }
  const requestOrganizationId = orgResolution.organizationId;

  if (!Number.isFinite(eventId) || !ENTITLEMENT_ID_RE.test(entitlementId) || !deviceId || reason.length < 4) {
    return fail(400, "INVALID_INPUT");
  }

  const access = await ensureOrganization(userId, eventId, requestOrganizationId);
  if (!access.ok) {
    if ("errorCode" in access) {
      return respondError(
        ctx,
        {
          errorCode: access.errorCode ?? "FORBIDDEN",
          message: access.message ?? access.errorCode ?? "Sem permissões.",
          retryable: false,
          details: access as Record<string, unknown>,
        },
        { status: access.status ?? 403 },
      );
    }
    const status =
      access.reason === "EVENT_NOT_FOUND"
        ? 404
        : access.reason === "EVENT_CLOSED" || access.reason === "EVENT_CANCELLED_TERMINAL"
          ? 409
          : 403;
    return fail(status, access.reason);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, slug: true, startsAt: true, endsAt: true, organizationId: true, status: true, isDeleted: true },
  });
  if (!event?.organizationId || event.organizationId !== requestOrganizationId) {
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }
  if (event.isDeleted) {
    return fail(409, "EVENT_CLOSED");
  }
  if (isEventCancelledStatus(event.status)) {
    return fail(409, "EVENT_CANCELLED_TERMINAL");
  }
  if (!isEventOperationalStatus(event.status)) {
    return fail(409, "EVENT_CLOSED");
  }
  const orgId = event?.organizationId ?? null;
  if (!orgId) {
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const ent = await prisma.entitlement.findUnique({
    where: { id: entitlementId },
    select: {
      id: true,
      eventId: true,
      status: true,
      type: true,
      ownerUserId: true,
      ownerIdentityId: true,
      purchaseId: true,
      policyVersionApplied: true,
      checkins: { select: { resultCode: true, checkedInAt: true } },
    },
  });
  if (!ent || ent.eventId !== eventId) {
    await appendManualLog({
      eventId,
      orgId,
      actorUserId: userId,
      entitlementId,
      deviceId,
      reasonCode: CheckinResultCode.NOT_ALLOWED,
      eventType: "checkin.manual.denied",
      reasonText: reason,
      purchaseId: null,
    });
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
  if (isOutsideWindow(window)) {
    await appendManualLog({
      eventId,
      orgId,
      actorUserId: userId,
      entitlementId,
      deviceId,
      reasonCode: CheckinResultCode.OUTSIDE_WINDOW,
      eventType: "checkin.manual.denied",
      reasonText: reason,
      purchaseId: ent.purchaseId ?? null,
    });
    return respondOk(ctx, { code: CheckinResultCode.OUTSIDE_WINDOW }, { status: 200 });
  }

  const policyResolution = await resolvePolicyForCheckin(eventId, ent.policyVersionApplied);
  if (!policyResolution.ok || (policyResolution.policy && !policyResolution.policy.checkinMethods.includes(CheckinMethod.MANUAL))) {
    await appendManualLog({
      eventId,
      orgId,
      actorUserId: userId,
      entitlementId: ent.id,
      deviceId,
      reasonCode: CheckinResultCode.NOT_ALLOWED,
      eventType: "checkin.manual.denied",
      reasonText: reason,
      purchaseId: ent.purchaseId ?? null,
    });
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const effectiveStatus = getEntitlementEffectiveStatus({
    status: ent.status,
    checkins: ent.checkins,
  });
  if (effectiveStatus === "SUSPENDED") {
    await appendManualLog({
      eventId,
      orgId,
      actorUserId: userId,
      entitlementId: ent.id,
      deviceId,
      reasonCode: CheckinResultCode.SUSPENDED,
      eventType: "checkin.manual.denied",
      reasonText: reason,
      purchaseId: ent.purchaseId ?? null,
    });
    return respondOk(ctx, { code: CheckinResultCode.SUSPENDED }, { status: 200 });
  }
  if (effectiveStatus === "REVOKED") {
    await appendManualLog({
      eventId,
      orgId,
      actorUserId: userId,
      entitlementId: ent.id,
      deviceId,
      reasonCode: CheckinResultCode.REVOKED,
      eventType: "checkin.manual.denied",
      reasonText: reason,
      purchaseId: ent.purchaseId ?? null,
    });
    return respondOk(ctx, { code: CheckinResultCode.REVOKED }, { status: 200 });
  }
  if (effectiveStatus !== "ACTIVE") {
    await appendManualLog({
      eventId,
      orgId,
      actorUserId: userId,
      entitlementId: ent.id,
      deviceId,
      reasonCode: CheckinResultCode.NOT_ALLOWED,
      eventType: "checkin.manual.denied",
      reasonText: reason,
      purchaseId: ent.purchaseId ?? null,
    });
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const fallbackKey = `manual:${eventId}:${ent.id}:${deviceId}`;
  const causationId = fallbackKey;
  const correlationId = ent.purchaseId ?? null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.entitlementCheckin.findUnique({
        where: { eventId_entitlementId: { eventId, entitlementId: ent.id } },
        select: { resultCode: true, checkedInAt: true },
      });
      if (existing) {
        await appendEventLog(
          {
            organizationId: orgId,
            eventType: "checkin.manual.duplicate",
            idempotencyKey: `checkin:manual:${eventId}:${ent.id}:${deviceId}:duplicate`,
            payload: {
              entitlementId: ent.id,
              eventId,
              deviceId,
              resultCode: existing.resultCode,
              reason,
            },
            actorUserId: userId,
            correlationId: ent.purchaseId ?? null,
          },
          tx,
        );
        return {
          code: getCheckinResultFromExisting(existing) ?? CheckinResultCode.ALREADY_USED,
          checkedInAt: existing.checkedInAt ?? null,
        };
      }

      const created = await tx.entitlementCheckin.create({
        data: {
          entitlementId: ent.id,
          eventId,
          deviceId,
          method: CheckinMethod.MANUAL,
          manualReason: reason,
          resultCode: CheckinResultCode.OK,
          checkedInBy: userId,
          purchaseId: ent.purchaseId,
          idempotencyKey: fallbackKey,
          causationId,
          correlationId,
        },
        select: { checkedInAt: true },
      });

      await appendEventLog(
        {
          organizationId: orgId,
          eventType: "checkin.manual.success",
          idempotencyKey: `checkin:manual:${eventId}:${ent.id}:${deviceId}:ok`,
          payload: {
            entitlementId: ent.id,
            eventId,
            deviceId,
            resultCode: CheckinResultCode.OK,
            reason,
          },
          actorUserId: userId,
          correlationId: ent.purchaseId ?? null,
        },
        tx,
      );

      return {
        code: CheckinResultCode.OK,
        checkedInAt: created.checkedInAt,
      };
    });

    if (result.code === CheckinResultCode.OK && event?.organizationId && (ent.ownerUserId || ent.ownerIdentityId)) {
      try {
        await ingestCrmInteraction({
          organizationId: event.organizationId,
          userId: ent.ownerUserId ?? undefined,
          emailIdentityId: ent.ownerIdentityId ?? undefined,
          type: CrmInteractionType.EVENT_CHECKIN,
          sourceType: CrmInteractionSource.CHECKIN,
          sourceId: ent.id,
          occurredAt: new Date(),
          metadata: {
            eventId,
            entitlementId: ent.id,
            purchaseId: ent.purchaseId,
            method: CheckinMethod.MANUAL,
          },
        });
      } catch (err) {
        console.warn("[organização/checkin/manual] Falha ao criar interação CRM", err);
      }
    }

    if (
      result.code === CheckinResultCode.OK ||
      result.code === CheckinResultCode.ALREADY_USED
    ) {
      try {
        const inviteResult = await ensureEventChatInvite({
          eventId,
          entitlementId: ent.id,
          ownerUserId: ent.ownerUserId ?? null,
          startsAt: event?.startsAt ?? null,
          endsAt: event?.endsAt ?? null,
        });
        if (inviteResult.ok && inviteResult.created && ent.ownerUserId && event) {
          await createNotification({
            userId: ent.ownerUserId,
            type: "CHAT_AVAILABLE",
            title: "Chat disponível",
            body: `O chat do evento ${event.title ?? "Evento"} está disponível.`,
            ctaUrl: event.slug ? `/eventos/${event.slug}` : "/eventos",
            ctaLabel: "Entrar no chat",
            organizationId: event.organizationId ?? null,
            eventId: event.id,
            inviteId: inviteResult.inviteId,
          });
        }
      } catch (err) {
        console.warn("[organização/checkin/manual] Falha ao criar convite de chat", err);
      }
    }

    return respondOk(ctx, { code: result.code, checkedInAt: result.checkedInAt }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return respondOk(ctx, { code: CheckinResultCode.ALREADY_USED }, { status: 200 });
    }
    console.error("[organização/checkin/manual] error", err);
    return fail(500, "INTERNAL_ERROR");
  }
}

async function appendManualLog({
  eventId,
  orgId,
  actorUserId,
  entitlementId,
  deviceId,
  reasonCode,
  eventType,
  reasonText,
  purchaseId,
}: {
  eventId: number;
  orgId: number;
  actorUserId: string;
  entitlementId: string;
  deviceId: string;
  reasonCode: CheckinResultCode;
  eventType: "checkin.manual.denied";
  reasonText: string;
  purchaseId: string | null;
}) {
  try {
    await appendEventLog({
      organizationId: orgId,
      eventType,
      idempotencyKey: `checkin:manual:${eventId}:${entitlementId}:${deviceId}:${reasonCode}:${crypto.randomUUID()}`,
      payload: {
        entitlementId,
        eventId,
        deviceId,
        resultCode: reasonCode,
        reason: reasonText,
      },
      actorUserId,
      correlationId: purchaseId,
    });
  } catch (err) {
    console.warn("[organização/checkin/manual] Falha ao registar event log", err);
  }
}

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

export const POST = withApiEnvelope(_POST);
