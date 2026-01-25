import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { CheckinResultCode, CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { ensureGroupMemberCheckinAccess } from "@/lib/organizationMemberAccess";
import { appendEventLog } from "@/domain/eventLog/append";
import {
  getCheckinResultFromExisting,
  getEntitlementEffectiveStatus,
} from "@/lib/entitlements/status";
import {
  resolveCheckinMethodForEntitlement,
  resolvePolicyForCheckin,
} from "@/lib/checkin/accessPolicy";

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
    required: "EDIT",
  });
  if (access.ok) {
    return { ok: true as const, isAdmin };
  }

  return { ok: false as const, reason: "FORBIDDEN_CHECKIN_ACCESS" };
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = data.user.id;

  const body = (await req.json().catch(() => null)) as Body | null;
  const qrToken = typeof body?.qrToken === "string" ? body.qrToken.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  const eventId = Number(body?.eventId);

  if (!qrToken || !deviceId || !Number.isFinite(eventId)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const access = await ensureOrganization(userId, eventId);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.reason === "EVENT_NOT_FOUND" ? 404 : 403 });
  }

  const tokenHash = hashToken(qrToken);
  const tokenRow = await prisma.entitlementQrToken.findUnique({
    where: { tokenHash },
    include: { entitlement: { include: { checkins: { select: { resultCode: true } } } } },
  });

  if (!tokenRow || !tokenRow.entitlement) {
    return NextResponse.json({ code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const ent = tokenRow.entitlement;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true, organizationId: true },
  });
  const orgId = event?.organizationId ?? null;
  if (!orgId) {
    return NextResponse.json({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }
  const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
  if (isOutsideWindow(window)) {
    return NextResponse.json({ code: CheckinResultCode.OUTSIDE_WINDOW }, { status: 200 });
  }

  if (!ent.eventId || ent.eventId !== eventId) {
    return NextResponse.json({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const now = new Date();
  if (tokenRow.expiresAt && tokenRow.expiresAt < now) {
    return NextResponse.json({ code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const policyResolution = await resolvePolicyForCheckin(eventId, ent.policyVersionApplied);
  if (!policyResolution.ok) {
    return NextResponse.json({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }
  if (policyResolution.policy) {
    const method = resolveCheckinMethodForEntitlement(ent.type);
    if (!method || !policyResolution.policy.checkinMethods.includes(method)) {
      return NextResponse.json({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
    }
  }

  // blocked statuses
  const effectiveStatus = getEntitlementEffectiveStatus({
    status: ent.status,
    checkins: ent.checkins,
  });
  if (effectiveStatus === "SUSPENDED") {
    return NextResponse.json({ code: CheckinResultCode.SUSPENDED }, { status: 200 });
  }
  if (effectiveStatus === "REVOKED") {
    return NextResponse.json({ code: CheckinResultCode.REVOKED }, { status: 200 });
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
        const sourceType = ent.sourceType ?? null;
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
            sourceType,
            sourceId: sourceType ? ent.sourceId ?? null : null,
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
          sourceType: ent.sourceType ?? null,
          sourceId: ent.sourceType ? ent.sourceId ?? null : null,
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

    return NextResponse.json({ code: result }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // unique constraint hit
      return NextResponse.json({ code: CheckinResultCode.ALREADY_USED }, { status: 200 });
    }
    console.error("[organização/checkin] error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
