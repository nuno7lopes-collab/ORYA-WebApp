export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPartnershipStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import {
  ensurePartnershipOrganization,
  parseOptionalDate,
  parsePositiveInt,
} from "@/app/api/padel/partnerships/_shared";

function isActiveBooking(status: string, pendingExpiresAt: Date | null) {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(status)) {
    return pendingExpiresAt ? pendingExpiresAt > new Date() : false;
  }
  return false;
}

function buildMatchWindow(match: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
}) {
  const start = match.plannedStartAt ?? match.startTime;
  if (!start) return null;
  const end =
    match.plannedEndAt ??
    (match.plannedDurationMinutes
      ? new Date(start.getTime() + Number(match.plannedDurationMinutes) * 60 * 1000)
      : start);
  return { start, end };
}

async function _POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const check = await ensurePartnershipOrganization({ req, required: "EDIT", body });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const agreementId = parsePositiveInt(body.agreementId);
  if (!agreementId) return jsonWrap({ ok: false, error: "AGREEMENT_ID_REQUIRED" }, { status: 400 });

  const agreement = await prisma.padelPartnershipAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
      ownerClubId: true,
      status: true,
    },
  });
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== agreement.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }
  if (
    agreement.status !== PadelPartnershipStatus.APPROVED &&
    agreement.status !== PadelPartnershipStatus.PAUSED
  ) {
    return jsonWrap({ ok: false, error: "AGREEMENT_NOT_ACTIVE" }, { status: 409 });
  }

  const targetType = typeof body.targetType === "string" ? body.targetType.trim().toUpperCase() : "";
  if (!targetType) return jsonWrap({ ok: false, error: "TARGET_TYPE_REQUIRED" }, { status: 400 });
  const targetSourceId = typeof body.targetSourceId === "string" ? body.targetSourceId.trim() : null;
  const reasonCodeRaw = typeof body.reasonCode === "string" ? body.reasonCode.trim().toUpperCase() : "";
  const reasonCode = /^[A-Z0-9_]{3,64}$/.test(reasonCodeRaw) ? reasonCodeRaw : null;
  if (!reasonCode) return jsonWrap({ ok: false, error: "REASON_CODE_REQUIRED" }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5) return jsonWrap({ ok: false, error: "REASON_REQUIRED" }, { status: 400 });

  const eventId = parsePositiveInt(body.eventId);
  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: { id: true, organizationId: true, templateType: true },
    });
    if (!event || !event.organizationId || event.templateType !== "PADEL") {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }
    if (![agreement.ownerOrganizationId, agreement.partnerOrganizationId].includes(event.organizationId)) {
      return jsonWrap({ ok: false, error: "EVENT_OUTSIDE_PARTNERSHIP_SCOPE" }, { status: 403 });
    }
  }

  const courtId = parsePositiveInt(body.courtId);
  if (courtId) {
    const court = await prisma.padelClubCourt.findFirst({
      where: {
        id: courtId,
        club: {
          id: agreement.ownerClubId,
          organizationId: agreement.ownerOrganizationId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });
    if (!court) {
      return jsonWrap({ ok: false, error: "COURT_NOT_IN_OWNER_SCOPE" }, { status: 400 });
    }
  }

  const startsAt = parseOptionalDate(body.startsAt);
  const endsAt = parseOptionalDate(body.endsAt);
  if ((body.startsAt && !startsAt) || (body.endsAt && !endsAt)) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }
  if ((startsAt && !endsAt) || (!startsAt && endsAt)) {
    return jsonWrap({ ok: false, error: "BOTH_DATES_REQUIRED" }, { status: 400 });
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  let impact: Record<string, unknown> = {
    computedAt: new Date().toISOString(),
    eventId: eventId ?? null,
    courtId: courtId ?? null,
  };

  if (eventId && startsAt && endsAt) {
    const [blocks, matches, bookings] = await Promise.all([
      prisma.calendarBlock.count({
        where: {
          eventId,
          ...(courtId ? { courtId } : {}),
          startAt: { lt: endsAt },
          endAt: { gt: startsAt },
        },
      }),
      prisma.eventMatchSlot.findMany({
        where: {
          eventId,
          ...(courtId ? { courtId } : {}),
          OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
        },
        select: {
          id: true,
          plannedStartAt: true,
          plannedEndAt: true,
          plannedDurationMinutes: true,
          startTime: true,
        },
      }),
      prisma.booking.findMany({
        where: {
          ...(courtId ? { courtId } : {}),
          startsAt: { lt: endsAt },
        },
        select: { id: true, startsAt: true, durationMinutes: true, status: true, pendingExpiresAt: true },
      }),
    ]);

    const overlappingMatches = matches.filter((match) => {
      const window = buildMatchWindow(match);
      if (!window) return false;
      return window.start < endsAt && startsAt < window.end;
    });

    const overlappingBookings = bookings.filter((reservation) => {
      const { status, pendingExpiresAt } = reservation;
      if (!isActiveBooking(status, pendingExpiresAt)) return false;
      const bookingEnd = new Date(reservation.startsAt.getTime() + reservation.durationMinutes * 60 * 1000);
      return reservation.startsAt < endsAt && startsAt < bookingEnd;
    });

    impact = {
      ...impact,
      overlaps: {
        blocks,
        matches: overlappingMatches.length,
        bookings: overlappingBookings.length,
      },
      sampleMatchIds: overlappingMatches.slice(0, 10).map((match) => match.id),
      sampleBookingIds: overlappingBookings.slice(0, 10).map((booking) => booking.id),
    };
  }

  const override = await prisma.padelPartnershipOverride.create({
    data: {
      agreementId: agreement.id,
      ownerOrganizationId: agreement.ownerOrganizationId,
      partnerOrganizationId: agreement.partnerOrganizationId,
      eventId: eventId ?? null,
      targetType,
      targetSourceId: targetSourceId || null,
      reasonCode,
      courtId: courtId ?? null,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      reason,
      impact: impact as Prisma.InputJsonValue,
      createdByUserId: check.userId,
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: agreement.ownerOrganizationId,
    actorUserId: check.userId,
    action: "PADEL_PARTNERSHIP_OVERRIDE_CREATED",
    entityType: "padel_partnership_override",
    entityId: String(override.id),
    metadata: {
      agreementId: agreement.id,
      eventId: eventId ?? null,
      courtId: courtId ?? null,
      targetType,
      targetSourceId: targetSourceId ?? null,
      reasonCode,
      impact,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap({ ok: true, override }, { status: 201 });
}

export const POST = withApiEnvelope(_POST);
