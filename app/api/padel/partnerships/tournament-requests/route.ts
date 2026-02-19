export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PadelClubKind, PadelPartnershipTournamentRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  ensurePartnershipOrganization,
  parseOptionalDate,
  parsePositiveInt,
} from "@/app/api/padel/partnerships/_shared";

const REQUEST_STATUSES = new Set<PadelPartnershipTournamentRequestStatus>([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);

async function _GET(req: NextRequest) {
  const check = await ensurePartnershipOrganization({ req, required: "VIEW" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const statusRaw = req.nextUrl.searchParams.get("status");
  const status = statusRaw ? statusRaw.trim().toUpperCase() : null;
  if (status && !REQUEST_STATUSES.has(status as PadelPartnershipTournamentRequestStatus)) {
    return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const items = await prisma.padelPartnershipTournamentRequest.findMany({
    where: {
      OR: [
        { ownerOrganizationId: check.organization.id },
        { partnerOrganizationId: check.organization.id },
      ],
      ...(status ? { status: status as PadelPartnershipTournamentRequestStatus } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 300,
  });

  const organizationIds = Array.from(
    new Set(
      items
        .flatMap((item) => [item.ownerOrganizationId, item.partnerOrganizationId])
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    ),
  );
  const clubIds = Array.from(
    new Set(
      items
        .flatMap((item) => [item.ownerClubId, item.partnerClubId])
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    ),
  );

  const [organizations, clubs] = await Promise.all([
    organizationIds.length > 0
      ? prisma.organization.findMany({
          where: { id: { in: organizationIds } },
          select: { id: true, publicName: true, businessName: true, username: true },
        })
      : Promise.resolve([]),
    clubIds.length > 0
      ? prisma.padelClub.findMany({
          where: { id: { in: clubIds }, deletedAt: null },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const organizationNameById = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.publicName || organization.businessName || organization.username || `Org #${organization.id}`,
    ]),
  );
  const clubNameById = new Map(clubs.map((club) => [club.id, club.name]));

  return jsonWrap(
    {
      ok: true,
      items: items.map((item) => ({
        ...item,
        ownerOrganizationName: organizationNameById.get(item.ownerOrganizationId) ?? null,
        partnerOrganizationName: organizationNameById.get(item.partnerOrganizationId) ?? null,
        ownerClubName: clubNameById.get(item.ownerClubId) ?? null,
        partnerClubName: clubNameById.get(item.partnerClubId) ?? null,
      })),
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const check = await ensurePartnershipOrganization({ req, required: "EDIT", body });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const partnerClubId = parsePositiveInt(body.partnerClubId ?? body.clubId);
  if (!partnerClubId) {
    return jsonWrap({ ok: false, error: "CLUB_REQUIRED" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return jsonWrap({ ok: false, error: "TITLE_REQUIRED" }, { status: 400 });
  }

  const startsAt = parseOptionalDate(typeof body.startsAt === "string" ? body.startsAt : null);
  const endsAt = parseOptionalDate(typeof body.endsAt === "string" ? body.endsAt : null);
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const requestedPayload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : null;

  const partnerClub = await prisma.padelClub.findFirst({
    where: {
      id: partnerClubId,
      organizationId: check.organization.id,
      kind: PadelClubKind.PARTNER,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, sourceClubId: true },
  });
  if (!partnerClub || !partnerClub.sourceClubId) {
    return jsonWrap({ ok: false, error: "CLUB_INVALID" }, { status: 400 });
  }

  const agreement = await prisma.padelPartnershipAgreement.findFirst({
    where: {
      ownerClubId: partnerClub.sourceClubId,
      partnerOrganizationId: check.organization.id,
      status: "APPROVED",
      revokedAt: null,
      OR: [{ partnerClubId: partnerClub.id }, { partnerClubId: null }],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: endsAt } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }] },
      ],
    },
    select: {
      id: true,
      ownerOrganizationId: true,
      ownerClubId: true,
      partnerOrganizationId: true,
      partnerClubId: true,
    },
    orderBy: [{ approvedAt: "desc" }, { id: "desc" }],
  });
  if (!agreement) {
    return jsonWrap({ ok: false, error: "AGREEMENT_REQUIRED" }, { status: 409 });
  }

  if (agreement.partnerClubId && agreement.partnerClubId !== partnerClub.id) {
    return jsonWrap({ ok: false, error: "AGREEMENT_CLUB_MISMATCH" }, { status: 409 });
  }

  const overlappingPending = await prisma.padelPartnershipTournamentRequest.count({
    where: {
      agreementId: agreement.id,
      partnerClubId: partnerClub.id,
      status: "PENDING",
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (overlappingPending > 0) {
    return jsonWrap({ ok: false, error: "PENDING_REQUEST_ALREADY_EXISTS" }, { status: 409 });
  }

  const expiresAt = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const created = await prisma.padelPartnershipTournamentRequest.create({
    data: {
      agreementId: agreement.id,
      ownerOrganizationId: agreement.ownerOrganizationId,
      partnerOrganizationId: agreement.partnerOrganizationId,
      ownerClubId: agreement.ownerClubId,
      partnerClubId: partnerClub.id,
      title,
      startsAt,
      endsAt,
      requestedPayload: requestedPayload ?? {},
      requestedByUserId: check.userId,
      status: "PENDING",
      expiresAt,
    },
  });

  return jsonWrap({ ok: true, request: created }, { status: 201 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
