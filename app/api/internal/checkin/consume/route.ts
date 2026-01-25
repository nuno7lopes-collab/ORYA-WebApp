export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
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
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

type Body = {
  qrPayload?: string;
  eventId?: number;
  deviceId?: string | null;
  scannerIdentityRef?: string | null;
  idempotencyKey?: string | null;
  causationId?: string | null;
  correlationId?: string | null;
};

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => null)) as Body | null;
  const qrPayload = typeof body?.qrPayload === "string" ? body.qrPayload.trim() : "";
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

  if (!qrPayload || !Number.isFinite(eventId)) {
    return NextResponse.json({ allow: false, reasonCode: "INVALID" }, { status: 200 });
  }

  const tokenHash = hashToken(qrPayload);
  const tokenRow = await prisma.entitlementQrToken.findUnique({
    where: { tokenHash },
    include: {
      entitlement: {
        include: { checkins: { select: { resultCode: true, checkedInAt: true } } },
      },
    },
  });

  if (!tokenRow?.entitlement) {
    return NextResponse.json({ allow: false, reasonCode: "INVALID" }, { status: 200 });
  }

  const ent = tokenRow.entitlement;
  if (!ent.eventId || ent.eventId !== eventId) {
    return NextResponse.json({ allow: false, reasonCode: "NOT_ALLOWED" }, { status: 200 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true, organizationId: true },
  });
  const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
  if (isOutsideWindow(window)) {
    return NextResponse.json({ allow: false, reasonCode: "OUTSIDE_WINDOW" }, { status: 200 });
  }

  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
    return NextResponse.json({ allow: false, reasonCode: "INVALID" }, { status: 200 });
  }

  const policyResolution = await resolvePolicyForCheckin(eventId, ent.policyVersionApplied);
  if (!policyResolution.ok) {
    return NextResponse.json(
      { allow: false, reasonCode: "NOT_ALLOWED", policyVersionApplied: ent.policyVersionApplied ?? null },
      { status: 200 },
    );
  }
  if (policyResolution.policy) {
    const method = resolveCheckinMethodForEntitlement(ent.type);
    if (!method || !policyResolution.policy.checkinMethods.includes(method)) {
      return NextResponse.json(
        { allow: false, reasonCode: "NOT_ALLOWED", policyVersionApplied: ent.policyVersionApplied ?? null },
        { status: 200 },
      );
    }
  }

  const effectiveStatus = getEntitlementEffectiveStatus({
    status: ent.status,
    checkins: ent.checkins,
  });
  if (effectiveStatus === "SUSPENDED") {
    return NextResponse.json(
      { allow: false, reasonCode: "SUSPENDED", policyVersionApplied: ent.policyVersionApplied ?? null },
      { status: 200 },
    );
  }
  if (effectiveStatus === "REVOKED") {
    return NextResponse.json(
      { allow: false, reasonCode: "REVOKED", policyVersionApplied: ent.policyVersionApplied ?? null },
      { status: 200 },
    );
  }

  const alreadyConsumed = isConsumed({ status: ent.status, checkins: ent.checkins });
  if (alreadyConsumed) {
    const existing = ent.checkins?.[0] ?? null;
    const duplicate = getCheckinResultFromExisting(existing) ?? CheckinResultCode.ALREADY_USED;
    return NextResponse.json(
      {
        allow: false,
        reasonCode: duplicate,
        entitlementId: ent.id,
        policyVersionApplied: ent.policyVersionApplied ?? null,
        duplicate: {
          duplicateOfConsumedAt: existing?.checkedInAt ?? null,
          duplicateCount: ent.checkins?.length ?? 1,
        },
      },
      { status: 200 },
    );
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

    return NextResponse.json(
      {
        allow: true,
        entitlementId: ent.id,
        consumedAt: created.checkedInAt,
        policyVersionApplied: ent.policyVersionApplied ?? null,
      },
      { status: 200 },
    );
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { allow: false, reasonCode: "ALREADY_USED", policyVersionApplied: ent.policyVersionApplied ?? null },
        { status: 200 },
      );
    }
    console.error("[internal/checkin/consume] error", err);
    return NextResponse.json({ allow: false, reasonCode: "INVALID" }, { status: 200 });
  }
}
