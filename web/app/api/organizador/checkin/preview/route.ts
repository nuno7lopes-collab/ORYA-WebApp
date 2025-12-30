import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import {
  CheckinResultCode,
  EntitlementStatus,
  OrganizerMemberRole,
  StaffScope,
  StaffStatus,
} from "@prisma/client";
import { buildDefaultCheckinWindow, isOutsideWindow } from "@/lib/checkin/policy";

type Body = { qrToken?: string; eventId?: number };

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function ensureCheckinAccess(userId: string, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });
  if (!event) return { ok: false as const, reason: "EVENT_NOT_FOUND" };

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");
  if (isAdmin) return { ok: true as const, isAdmin };

  const membership = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId: event.organizerId, userId } },
    select: { id: true, role: true },
  });
  if (membership && membership.role !== OrganizerMemberRole.VIEWER) {
    return { ok: true as const, isAdmin };
  }

  const staffAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      status: StaffStatus.ACCEPTED,
      revokedAt: null,
      OR: [
        { scope: StaffScope.GLOBAL, organizerId: event.organizerId },
        { scope: StaffScope.EVENT, eventId },
      ],
    },
    select: { id: true },
  });
  if (staffAssignment) {
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
  const eventId = Number(body?.eventId);

  if (!qrToken || !Number.isFinite(eventId)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const access = await ensureCheckinAccess(userId, eventId);
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
    return NextResponse.json({ code: CheckinResultCode.OUTSIDE_WINDOW, window }, { status: 200 });
  }

  if (!ent.eventId || ent.eventId !== eventId) {
    return NextResponse.json({ code: CheckinResultCode.NOT_ALLOWED }, { status: 200 });
  }

  const now = new Date();
  if (tokenRow.expiresAt && tokenRow.expiresAt < now) {
    return NextResponse.json({ code: CheckinResultCode.INVALID }, { status: 200 });
  }

  if (ent.status === EntitlementStatus.REFUNDED) {
    return NextResponse.json({ code: CheckinResultCode.REFUNDED }, { status: 200 });
  }
  if (ent.status === EntitlementStatus.REVOKED) {
    return NextResponse.json({ code: CheckinResultCode.REVOKED }, { status: 200 });
  }
  if (ent.status === EntitlementStatus.SUSPENDED) {
    return NextResponse.json({ code: CheckinResultCode.SUSPENDED }, { status: 200 });
  }

  const existing = await prisma.entitlementCheckin.findUnique({
    where: { eventId_entitlementId: { eventId, entitlementId: ent.id } },
    select: { resultCode: true, checkedInAt: true },
  });
  if (existing) {
    return NextResponse.json(
      { code: CheckinResultCode.ALREADY_USED, checkedInAt: existing.checkedInAt },
      { status: 200 },
    );
  }

  return NextResponse.json(
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
