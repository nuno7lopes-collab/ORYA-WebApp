import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { CheckinResultCode } from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberCheckinAccess } from "@/lib/organizationMemberAccess";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
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
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logWarn } from "@/lib/observability/logger";

type Body = { qrToken?: string; eventId?: number };

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function ensureCheckinAccess(userId: string, eventId: number) {
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
    required: "VIEW",
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
    keyPrefix: "checkin:preview",
    identifier: userId,
  });
  if (!limiter.allowed) {
    logWarn("checkin.preview.rate_limited", { requestId: ctx.requestId, userId, retryAfter: limiter.retryAfter });
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
  const eventId = Number(body?.eventId);

  if (!qrTokenRaw || !Number.isFinite(eventId)) {
    return fail(400, "INVALID_INPUT");
  }

  const access = await ensureCheckinAccess(userId, eventId);
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
          ownerKey: true,
          policyVersionApplied: true,
          snapshotTitle: true,
          snapshotVenueName: true,
          snapshotStartAt: true,
          snapshotTimezone: true,
          checkins: { select: { resultCode: true, checkedInAt: true } },
        },
      },
    },
  });

  if (!tokenRow || !tokenRow.entitlement) {
    logWarn("checkin.preview.invalid_token", { requestId: ctx.requestId, eventId });
    return respondOk(ctx, { code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const ent = tokenRow.entitlement;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true },
  });
  const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
  if (isOutsideWindow(window)) {
    return respondOk(ctx, { code: CheckinResultCode.OUTSIDE_WINDOW, window }, { status: 200 });
  }

  if (!ent.eventId || ent.eventId !== eventId) {
    return respondOk(ctx, { code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const now = new Date();
  if (tokenRow.expiresAt && tokenRow.expiresAt < now) {
    logWarn("checkin.preview.expired_token", { requestId: ctx.requestId, eventId });
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

  const consumed = isConsumed({ status: ent.status, checkins: ent.checkins });
  if (consumed) {
    const existingCheckin = ent.checkins?.[0] ?? null;
    const resultCode = getCheckinResultFromExisting(existingCheckin) ?? CheckinResultCode.ALREADY_USED;
    return respondOk(
      ctx,
      { code: resultCode, checkedInAt: existingCheckin?.checkedInAt },
      { status: 200 },
    );
  }

  return respondOk(
    ctx,
    {
      code: CheckinResultCode.OK,
      window,
      entitlement: {
        id: ent.id,
        status: ent.status,
        holderKey: ent.ownerKey,
        snapshotTitle: ent.snapshotTitle,
        snapshotVenue: ent.snapshotVenueName,
        snapshotStartAt: ent.snapshotStartAt,
        snapshotTimezone: ent.snapshotTimezone,
      },
    },
    { status: 200 },
  );
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
