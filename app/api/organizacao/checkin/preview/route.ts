import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { CheckinResultCode } from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberCheckinAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  getCheckinResultFromExisting,
  getEntitlementEffectiveStatus,
  isConsumed,
} from "@/lib/entitlements/status";
import {
  resolveCheckinMethodForEntitlement,
  resolvePolicyForCheckin,
} from "@/lib/checkin/accessPolicy";

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
  const emailGate = ensureOrganizationEmailVerified(organization);
  if (!emailGate.ok) {
    return { ok: false as const, reason: "FORBIDDEN_CHECKIN_ACCESS" };
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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return jsonWrap({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = data.user.id;

  const body = (await req.json().catch(() => null)) as Body | null;
  const qrToken = typeof body?.qrToken === "string" ? body.qrToken.trim() : "";
  const eventId = Number(body?.eventId);

  if (!qrToken || !Number.isFinite(eventId)) {
    return jsonWrap({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const access = await ensureCheckinAccess(userId, eventId);
  if (!access.ok) {
    return jsonWrap({ error: access.reason }, { status: access.reason === "EVENT_NOT_FOUND" ? 404 : 403 });
  }

  const tokenHash = hashToken(qrToken);
  const tokenRow = await prisma.entitlementQrToken.findUnique({
    where: { tokenHash },
    include: {
      entitlement: {
        include: { checkins: { select: { resultCode: true, checkedInAt: true } } },
      },
    },
  });

  if (!tokenRow || !tokenRow.entitlement) {
    return jsonWrap({ code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const ent = tokenRow.entitlement;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true },
  });
  const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
  if (isOutsideWindow(window)) {
    return jsonWrap({ code: CheckinResultCode.OUTSIDE_WINDOW, window }, { status: 200 });
  }

  if (!ent.eventId || ent.eventId !== eventId) {
    return jsonWrap({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const now = new Date();
  if (tokenRow.expiresAt && tokenRow.expiresAt < now) {
    return jsonWrap({ code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const policyResolution = await resolvePolicyForCheckin(eventId, ent.policyVersionApplied);
  if (!policyResolution.ok) {
    return jsonWrap({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }
  if (policyResolution.policy) {
    const method = resolveCheckinMethodForEntitlement(ent.type);
    if (!method || !policyResolution.policy.checkinMethods.includes(method)) {
      return jsonWrap({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
    }
  }

  const effectiveStatus = getEntitlementEffectiveStatus({
    status: ent.status,
    checkins: ent.checkins,
  });
  if (effectiveStatus === "SUSPENDED") {
    return jsonWrap({ code: CheckinResultCode.SUSPENDED }, { status: 200 });
  }
  if (effectiveStatus === "REVOKED") {
    return jsonWrap({ code: CheckinResultCode.REVOKED }, { status: 200 });
  }

  const consumed = isConsumed({ status: ent.status, checkins: ent.checkins });
  if (consumed) {
    const existingCheckin = ent.checkins?.[0] ?? null;
    const resultCode = getCheckinResultFromExisting(existingCheckin) ?? CheckinResultCode.ALREADY_USED;
    return jsonWrap(
      { code: resultCode, checkedInAt: existingCheckin?.checkedInAt },
      { status: 200 },
    );
  }

  return jsonWrap(
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
export const POST = withApiEnvelope(_POST);