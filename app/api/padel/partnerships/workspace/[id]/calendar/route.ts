export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensurePartnershipOrganization } from "@/app/api/padel/partnerships/_shared";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

async function _GET(req: NextRequest) {
  const agreementId = readNumericParam(undefined, req, "workspace");
  if (agreementId === null) {
    return jsonWrap({ ok: false, error: "INVALID_AGREEMENT_ID" }, { status: 400 });
  }

  const check = await ensurePartnershipOrganization({ req, required: "VIEW" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const agreement = await prisma.padelPartnershipAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      status: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
      ownerClubId: true,
      partnerClubId: true,
      startsAt: true,
      endsAt: true,
      approvedAt: true,
      createdAt: true,
      notes: true,
    },
  });
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (![agreement.ownerOrganizationId, agreement.partnerOrganizationId].includes(check.organization.id)) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const now = new Date();
  const rangeStart = parseDate(req.nextUrl.searchParams.get("startAt"), new Date(now.getTime() - 4 * 60 * 60 * 1000));
  const rangeEnd = parseDate(req.nextUrl.searchParams.get("endAt"), new Date(now.getTime() + 72 * 60 * 60 * 1000));
  if (rangeEnd <= rangeStart) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const [ownerCourts, windows, grants, overrides, cases, blocks, claims] = await Promise.all([
    prisma.padelClubCourt.findMany({
      where: {
        padelClubId: agreement.ownerClubId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true, displayOrder: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    }),
    prisma.padelPartnershipWindow.findMany({
      where: { agreementId: agreement.id },
      orderBy: [{ isActive: "desc" }, { startMinute: "asc" }, { id: "asc" }],
    }),
    prisma.padelPartnerRoleGrant.findMany({
      where: { agreementId: agreement.id },
      orderBy: [{ isActive: "desc" }, { expiresAt: "asc" }, { id: "desc" }],
    }),
    prisma.padelPartnershipOverride.findMany({
      where: { agreementId: agreement.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
    prisma.padelPartnershipCompensationCase.findMany({
      where: { agreementId: agreement.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
    prisma.calendarBlock.findMany({
      where: {
        padelClubId: agreement.ownerClubId,
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
      },
      select: {
        id: true,
        eventId: true,
        courtId: true,
        label: true,
        note: true,
        kind: true,
        startAt: true,
        endAt: true,
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
    }),
    prisma.agendaResourceClaim.findMany({
      where: {
        organizationId: agreement.partnerOrganizationId,
        resourceType: "COURT",
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        status: "CLAIMED",
      },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        resourceId: true,
        startsAt: true,
        endsAt: true,
        metadata: true,
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const ownerCourtIds = ownerCourts.map((court) => court.id);
  const courtIdSet = new Set(ownerCourtIds.map((id) => String(id)));
  const filteredClaims = claims.filter((claim) => courtIdSet.has(claim.resourceId));

  const matches = ownerCourtIds.length
    ? await prisma.eventMatchSlot.findMany({
        where: {
          courtId: { in: ownerCourtIds },
          OR: [
            { plannedStartAt: { gte: rangeStart, lt: rangeEnd } },
            { startTime: { gte: rangeStart, lt: rangeEnd } },
            {
              plannedStartAt: { lt: rangeStart },
              plannedEndAt: { gt: rangeStart },
            },
          ],
        },
        select: {
          id: true,
          eventId: true,
          courtId: true,
          roundType: true,
          roundLabel: true,
          groupLabel: true,
          status: true,
          plannedStartAt: true,
          plannedEndAt: true,
          startTime: true,
          event: { select: { organizationId: true, title: true } },
        },
        orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
      })
    : [];

  const masterLane = [
    ...blocks.map((block) => ({
      kind: "BLOCK",
      id: `block:${block.id}`,
      courtId: block.courtId,
      startAt: toIso(block.startAt),
      endAt: toIso(block.endAt),
      label: block.label ?? block.note ?? block.kind ?? "Bloqueio",
      eventId: block.eventId,
    })),
    ...matches
      .filter((match) => match.event.organizationId === agreement.ownerOrganizationId)
      .map((match) => ({
        kind: "MATCH",
        id: `match:${match.id}`,
        courtId: match.courtId,
        startAt: toIso(match.plannedStartAt ?? match.startTime),
        endAt: toIso(match.plannedEndAt),
        label: `${match.event.title} · ${match.roundLabel ?? match.roundType ?? "Jogo"}`,
        eventId: match.eventId,
        status: match.status,
      })),
  ];

  const partnerLane = matches
    .filter((match) => match.event.organizationId === agreement.partnerOrganizationId)
    .map((match) => ({
      kind: "MATCH",
      id: `match:${match.id}`,
      courtId: match.courtId,
      startAt: toIso(match.plannedStartAt ?? match.startTime),
      endAt: toIso(match.plannedEndAt),
      label: `${match.event.title} · ${match.roundLabel ?? match.roundType ?? "Jogo"}`,
      eventId: match.eventId,
      status: match.status,
    }));

  const sharedLane = filteredClaims.map((claim) => ({
    kind: "CLAIM",
    id: `claim:${claim.id}`,
    courtId: Number(claim.resourceId),
    startAt: toIso(claim.startsAt),
    endAt: toIso(claim.endsAt),
    sourceType: claim.sourceType,
    sourceId: claim.sourceId,
    metadata: claim.metadata,
  }));

  return jsonWrap(
    {
      ok: true,
      workspace: {
        agreement,
        windows,
        grants,
        overrides,
        compensationCases: cases,
        courts: ownerCourts,
      },
      range: {
        startAt: rangeStart.toISOString(),
        endAt: rangeEnd.toISOString(),
      },
      calendar: {
        masterLane,
        partnerLane,
        sharedLane,
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);

