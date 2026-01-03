import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { EntitlementStatus, CheckinResultCode } from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";
import { canManageEvents } from "@/lib/organizationPermissions";

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

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");
  if (isAdmin) return { ok: true as const, isAdmin };

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: event.organizationId, userId } },
    select: { id: true, role: true },
  });
  if (membership && canManageEvents(membership.role)) {
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
    include: { entitlement: true },
  });

  if (!tokenRow || !tokenRow.entitlement) {
    return NextResponse.json({ code: CheckinResultCode.INVALID }, { status: 200 });
  }

  const ent = tokenRow.entitlement;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true },
  });
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

  // blocked statuses
  if (ent.status === EntitlementStatus.REFUNDED) {
    return NextResponse.json({ code: CheckinResultCode.REFUNDED }, { status: 200 });
  }
  if (ent.status === EntitlementStatus.REVOKED) {
    return NextResponse.json({ code: CheckinResultCode.REVOKED }, { status: 200 });
  }
  if (ent.status === EntitlementStatus.SUSPENDED) {
    return NextResponse.json({ code: CheckinResultCode.SUSPENDED }, { status: 200 });
  }

  // Idempotência e audit
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Se já existe check-in, retorna ALREADY_USED
      const existing = await tx.entitlementCheckin.findUnique({
        where: { eventId_entitlementId: { eventId, entitlementId: ent.id } },
        select: { resultCode: true },
      });
      if (existing) {
        return existing.resultCode === CheckinResultCode.OK
          ? CheckinResultCode.ALREADY_USED
          : existing.resultCode;
      }

      await tx.entitlementCheckin.create({
        data: {
          entitlementId: ent.id,
          eventId,
          deviceId,
          resultCode: CheckinResultCode.OK,
          checkedInBy: userId,
          purchaseId: ent.purchaseId,
        },
      });

      await tx.entitlement.update({
        where: { id: ent.id },
        data: { status: EntitlementStatus.USED },
      });

      return CheckinResultCode.OK;
    });

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
