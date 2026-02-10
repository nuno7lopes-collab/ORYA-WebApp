export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CheckinResultCode } from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";
import {
  getCheckinResultFromExisting,
  getEntitlementEffectiveStatus,
  isConsumed,
} from "@/lib/entitlements/status";
import {
  resolveCheckinMethodForEntitlement,
  resolvePolicyForCheckin,
} from "@/lib/checkin/accessPolicy";
import { parseQrToken } from "@/lib/qr";
import { rateLimit } from "@/lib/auth/rateLimit";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { logError, logWarn } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureEventChatInvite } from "@/lib/chat/invites";
import { createNotification } from "@/lib/notifications";

type Body = {
  qrPayload?: string;
  eventId?: number;
  deviceId?: string | null;
  scannerIdentityRef?: string | null;
  idempotencyKey?: string | null;
  causationId?: string | null;
  correlationId?: string | null;
};

function ensureInternalSecret(req: NextRequest, ctx: { requestId: string; correlationId: string }) {
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }
  return null;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const allow = (data: Record<string, unknown>, status = 200) =>
    respondOk(ctx, data, { status });

  const body = (await req.json().catch(() => null)) as Body | null;
  const qrPayloadRaw = typeof body?.qrPayload === "string" ? body.qrPayload.trim() : "";
  const eventId = Number(body?.eventId);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : null;
  const idempotencyKey =
    typeof body?.idempotencyKey === "string" && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : null;
  const causationId =
    typeof body?.causationId === "string" && body.causationId.trim()
      ? body.causationId.trim()
      : null;
  const correlationId =
    typeof body?.correlationId === "string" && body.correlationId.trim()
      ? body.correlationId.trim()
      : null;

  if (!qrPayloadRaw || !Number.isFinite(eventId)) {
    return allow({ allow: false, reasonCode: "INVALID" });
  }

  const limiter = await rateLimit(req, {
    windowMs: 60 * 1000,
    max: 600,
    keyPrefix: "checkin:internal",
    identifier: deviceId ?? undefined,
  });
  if (!limiter.allowed) {
    logWarn("checkin.internal.rate_limited", {
      requestId: ctx.requestId,
      deviceId: deviceId ?? null,
      retryAfter: limiter.retryAfter,
    });
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

  let qrPayload = qrPayloadRaw;
  const parsed = qrPayloadRaw.startsWith("ORYA2:") ? parseQrToken(qrPayloadRaw) : null;
  if (parsed && !parsed.ok) {
    return allow({ allow: false, reasonCode: "INVALID" });
  }
  if (parsed && parsed.ok) {
    qrPayload = parsed.payload.tok;
    if (typeof parsed.payload.eid === "number" && parsed.payload.eid !== eventId) {
      return allow({ allow: false, reasonCode: "NOT_ALLOWED" });
    }
  }

  const tokenHash = hashToken(qrPayload);
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
          checkins: { select: { resultCode: true, checkedInAt: true } },
        },
      },
    },
  });

  if (!tokenRow?.entitlement) {
    logWarn("checkin.internal.invalid_token", { requestId: ctx.requestId, eventId });
    return allow({ allow: false, reasonCode: "INVALID" });
  }

  const ent = tokenRow.entitlement;
  if (!ent.eventId || ent.eventId !== eventId) {
    return allow({ allow: false, reasonCode: "NOT_ALLOWED" });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, slug: true, startsAt: true, endsAt: true, organizationId: true },
  });
  const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
  if (isOutsideWindow(window)) {
    return allow({ allow: false, reasonCode: "OUTSIDE_WINDOW" });
  }

  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
    logWarn("checkin.internal.expired_token", { requestId: ctx.requestId, eventId });
    return allow({ allow: false, reasonCode: "INVALID" });
  }

  const policyResolution = await resolvePolicyForCheckin(eventId, ent.policyVersionApplied);
  if (!policyResolution.ok) {
    return allow({
      allow: false,
      reasonCode: "NOT_ALLOWED",
      policyVersionApplied: ent.policyVersionApplied ?? null,
    });
  }
  if (policyResolution.policy) {
    const method = resolveCheckinMethodForEntitlement(ent.type);
    if (!method || !policyResolution.policy.checkinMethods.includes(method)) {
      return allow({
        allow: false,
        reasonCode: "NOT_ALLOWED",
        policyVersionApplied: ent.policyVersionApplied ?? null,
      });
    }
  }

  const effectiveStatus = getEntitlementEffectiveStatus({
    status: ent.status,
    checkins: ent.checkins,
  });
  if (effectiveStatus === "SUSPENDED") {
    return allow({
      allow: false,
      reasonCode: "SUSPENDED",
      policyVersionApplied: ent.policyVersionApplied ?? null,
    });
  }
  if (effectiveStatus === "REVOKED") {
    return allow({
      allow: false,
      reasonCode: "REVOKED",
      policyVersionApplied: ent.policyVersionApplied ?? null,
    });
  }
  if (effectiveStatus !== "ACTIVE") {
    return allow({
      allow: false,
      reasonCode: "NOT_ALLOWED",
      policyVersionApplied: ent.policyVersionApplied ?? null,
    });
  }

  const alreadyConsumed = isConsumed({ status: ent.status, checkins: ent.checkins });
  if (alreadyConsumed) {
    const existing = ent.checkins?.[0] ?? null;
    const duplicate = getCheckinResultFromExisting(existing) ?? CheckinResultCode.ALREADY_USED;
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
      logError("internal.checkin.invite_failed", err, { requestId: ctx.requestId });
    }
    return allow({
      allow: false,
      reasonCode: duplicate,
      entitlementId: ent.id,
      policyVersionApplied: ent.policyVersionApplied ?? null,
      duplicate: {
        duplicateOfConsumedAt: existing?.checkedInAt ?? null,
        duplicateCount: ent.checkins?.length ?? 1,
      },
    });
  }

  const fallbackKey = `${eventId}:${ent.id}:${deviceId ?? "unknown"}`;
  const finalIdempotencyKey = idempotencyKey ?? fallbackKey;
  const finalCausationId = causationId ?? finalIdempotencyKey;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.entitlementCheckin.findUnique({
        where: { eventId_entitlementId: { eventId, entitlementId: ent.id } },
        select: { resultCode: true, checkedInAt: true },
      });
      if (existing) return existing;

      return tx.entitlementCheckin.create({
        data: {
          entitlementId: ent.id,
          eventId,
          deviceId: deviceId ?? "unknown",
          resultCode: CheckinResultCode.OK,
          checkedInBy: null,
          purchaseId: ent.purchaseId,
          idempotencyKey: finalIdempotencyKey,
          causationId: finalCausationId,
          correlationId: correlationId ?? ent.purchaseId ?? null,
        },
        select: { resultCode: true, checkedInAt: true },
      });
    });

    if (event?.organizationId) {
      await recordOrganizationAuditSafe({
        organizationId: event.organizationId,
        actorUserId: null,
        action: "CHECKIN_CONSUMED",
        metadata: {
          eventId,
          entitlementId: ent.id,
          resultCode: created.resultCode,
        },
      });
    }

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
      logError("internal.checkin.invite_failed", err, { requestId: ctx.requestId });
    }

    return allow({
      allow: true,
      entitlementId: ent.id,
      consumedAt: created.checkedInAt,
      policyVersionApplied: ent.policyVersionApplied ?? null,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return allow({
        allow: false,
        reasonCode: "ALREADY_USED",
        policyVersionApplied: ent.policyVersionApplied ?? null,
      });
    }
    logError("internal.checkin.consume_error", err, { requestId: ctx.requestId });
    return respondError(
      ctx,
      { errorCode: "CHECKIN_FAILED", message: "Erro ao consumir check-in.", retryable: true },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
