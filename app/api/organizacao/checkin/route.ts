import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { CheckinResultCode, CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { ensureGroupMemberCheckinAccess } from "@/lib/organizationMemberAccess";
import { appendEventLog } from "@/domain/eventLog/append";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  getCheckinResultFromExisting,
  getEntitlementEffectiveStatus,
} from "@/lib/entitlements/status";
import {
  resolveCheckinMethodForEntitlement,
  resolvePolicyForCheckin,
} from "@/lib/checkin/accessPolicy";
import { parseQrToken } from "@/lib/qr";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureEventChatInvite } from "@/lib/chat/invites";
import { createNotification } from "@/lib/notifications";
import { logWarn } from "@/lib/observability/logger";

type Body = { qrToken?: string; eventId?: number; deviceId?: string };

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function ensureOrganization(userId: string, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!event) return { ok: false as const, reason: "EVENT_NOT_FOUND" };
  if (!event.organizationId) return { ok: false as const, reason: "FORBIDDEN_CHECKIN_ACCESS" };

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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return fail(401, "Not authenticated");
  }
  const userId = data.user.id;

  const limiter = await rateLimit(req, {
    windowMs: 60 * 1000,
    max: 300,
    keyPrefix: "checkin:org",
    identifier: userId,
  });
  if (!limiter.allowed) {
    logWarn("checkin.org.rate_limited", { requestId: ctx.requestId, userId, retryAfter: limiter.retryAfter });
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
  const qrTokenRaw = typeof body?.qrToken === "string" ? body.qrToken.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  const eventId = Number(body?.eventId);

  if (!qrTokenRaw || !deviceId || !Number.isFinite(eventId)) {
    return fail(400, "INVALID_INPUT");
  }

  const access = await ensureOrganization(userId, eventId);
  if (!access.ok) {
    if ("error" in access) {
      return respondError(
        ctx,
        {
          errorCode: access.error ?? "FORBIDDEN",
          message: access.message ?? access.error ?? "Sem permissões.",
          retryable: false,
          details: access as Record<string, unknown>,
        },
        { status: access.status ?? 403 },
      );
    }
    return fail(access.reason === "EVENT_NOT_FOUND" ? 404 : 403, access.reason);
  }

  let qrToken = qrTokenRaw;
  const parsed = qrTokenRaw.startsWith("ORYA2:") ? parseQrToken(qrTokenRaw) : null;
  if (parsed && !parsed.ok) {
    return respondOk(ctx, { code: CheckinResultCode.INVALID }, { status: 200 });
  }
  if (parsed && parsed.ok) {
    qrToken = parsed.payload.tok;
    if (typeof parsed.payload.eid === "number" && parsed.payload.eid !== eventId) {
      return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
    }
  }

  const tokenHash = hashToken(qrToken);
  const tokenRow = await prisma.entitlementQrToken.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      entitlement: {
        select: {
          id: true,
          eventId: true,
          type: true,
          status: true,
          ownerUserId: true,
          ownerIdentityId: true,
          purchaseId: true,
          policyVersionApplied: true,
          checkins: { select: { resultCode: true } },
        },
      },
    },
  });

  if (!tokenRow || !tokenRow.entitlement) {
    logWarn("checkin.org.invalid_token", { requestId: ctx.requestId, eventId });
    return respondOk(ctx, { code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const ent = tokenRow.entitlement;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, slug: true, startsAt: true, endsAt: true, organizationId: true },
  });
  const orgId = event?.organizationId ?? null;
  if (!orgId) {
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }
  const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
  if (isOutsideWindow(window)) {
    return respondOk(ctx, { code: CheckinResultCode.OUTSIDE_WINDOW }, { status: 200 });
  }

  if (!ent.eventId || ent.eventId !== eventId) {
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const now = new Date();
  if (tokenRow.expiresAt && tokenRow.expiresAt < now) {
    logWarn("checkin.org.expired_token", { requestId: ctx.requestId, eventId });
    return respondOk(ctx, { code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const policyResolution = await resolvePolicyForCheckin(eventId, ent.policyVersionApplied);
  if (!policyResolution.ok) {
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }
  if (policyResolution.policy) {
    const method = resolveCheckinMethodForEntitlement(ent.type);
    if (!method || !policyResolution.policy.checkinMethods.includes(method)) {
      return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
    }
  }

  // blocked statuses
  const effectiveStatus = getEntitlementEffectiveStatus({
    status: ent.status,
    checkins: ent.checkins,
  });
    if (effectiveStatus === "SUSPENDED") {
      return respondOk(ctx, { code: CheckinResultCode.SUSPENDED }, { status: 200 });
    }
    if (effectiveStatus === "REVOKED") {
      return respondOk(ctx, { code: CheckinResultCode.REVOKED }, { status: 200 });
    }
    if (effectiveStatus !== "ACTIVE") {
      return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
    }

  const idempotencyKey = `${eventId}:${ent.id}:${deviceId}`;
  const causationId = idempotencyKey;
  const correlationId = ent.purchaseId ?? null;

  // Idempotência e audit
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Se já existe check-in, retorna ALREADY_USED
      const existing = await tx.entitlementCheckin.findUnique({
        where: { eventId_entitlementId: { eventId, entitlementId: ent.id } },
        select: { resultCode: true },
      });
      if (existing) {
        await appendEventLog(
          {
            organizationId: orgId,
            eventType: "checkin.duplicate",
            idempotencyKey: `checkin:${eventId}:${ent.id}:${deviceId}:duplicate`,
            payload: {
              entitlementId: ent.id,
              eventId,
              deviceId,
              resultCode: existing.resultCode,
            },
            actorUserId: userId,
            correlationId: ent.purchaseId ?? null,
          },
          tx,
        );
        return getCheckinResultFromExisting(existing) ?? CheckinResultCode.ALREADY_USED;
      }

      await tx.entitlementCheckin.create({
        data: {
          entitlementId: ent.id,
          eventId,
          deviceId,
          resultCode: CheckinResultCode.OK,
          checkedInBy: userId,
          purchaseId: ent.purchaseId,
          idempotencyKey,
          causationId,
          correlationId,
        },
      });

      await appendEventLog(
        {
          organizationId: orgId,
          eventType: "checkin.success",
          idempotencyKey: `checkin:${eventId}:${ent.id}:${deviceId}:ok`,
          payload: {
            entitlementId: ent.id,
            eventId,
            deviceId,
            resultCode: CheckinResultCode.OK,
          },
          actorUserId: userId,
          correlationId: ent.purchaseId ?? null,
        },
        tx,
      );

      return CheckinResultCode.OK;
    });

    if (result === CheckinResultCode.OK && event?.organizationId && ent.ownerUserId) {
      try {
        await ingestCrmInteraction({
          organizationId: event.organizationId,
          userId: ent.ownerUserId,
          type: CrmInteractionType.EVENT_CHECKIN,
          sourceType: CrmInteractionSource.CHECKIN,
          sourceId: ent.id,
          occurredAt: new Date(),
          metadata: {
            eventId,
            entitlementId: ent.id,
            purchaseId: ent.purchaseId,
          },
        });
      } catch (err) {
        console.warn("[organização/checkin] Falha ao criar interação CRM", err);
      }
    }

    if (
      result === CheckinResultCode.OK ||
      result === CheckinResultCode.ALREADY_USED
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
        console.warn("[organização/checkin] Falha ao criar convite de chat", err);
      }
    }

    return respondOk(ctx, { code: result }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // unique constraint hit
      return respondOk(ctx, { code: CheckinResultCode.ALREADY_USED }, { status: 200 });
    }
    console.error("[organização/checkin] error", err);
    return fail(500, "INTERNAL_ERROR");
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
