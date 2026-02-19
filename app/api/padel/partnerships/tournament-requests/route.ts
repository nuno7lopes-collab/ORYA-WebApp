export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PadelClubKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  ensurePartnershipOrganization,
  parseOptionalDate,
  parsePositiveInt,
} from "@/app/api/padel/partnerships/_shared";

type PartnershipTournamentRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";

type PartnershipTournamentRequestDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<any[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
  create: (args: Record<string, unknown>) => Promise<any>;
};

const partnershipTournamentRequestDelegate =
  (prisma as unknown as { padelPartnershipTournamentRequest?: PartnershipTournamentRequestDelegate })
    .padelPartnershipTournamentRequest ?? null;

const REQUEST_STATUSES = new Set<PartnershipTournamentRequestStatus>([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);

async function resolveOwnerOrganizationId(params: {
  partnerOrganizationId?: number | null;
  partnerOrganizationUsername?: string | null;
}) {
  if (params.partnerOrganizationId && Number.isFinite(params.partnerOrganizationId) && params.partnerOrganizationId > 0) {
    return params.partnerOrganizationId;
  }
  const normalizedUsername = params.partnerOrganizationUsername?.trim().toLowerCase() ?? "";
  if (!normalizedUsername) return null;
  const organization = await prisma.organization.findFirst({
    where: {
      username: { equals: normalizedUsername, mode: "insensitive" },
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return organization?.id ?? null;
}

async function _GET(req: NextRequest) {
  const check = await ensurePartnershipOrganization({ req, required: "VIEW" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }
  if (!partnershipTournamentRequestDelegate) {
    return jsonWrap({ ok: false, error: "PARTNERSHIP_REQUESTS_UNAVAILABLE" }, { status: 503 });
  }

  const statusRaw = req.nextUrl.searchParams.get("status");
  const status = statusRaw ? statusRaw.trim().toUpperCase() : null;
  if (status && !REQUEST_STATUSES.has(status as PartnershipTournamentRequestStatus)) {
    return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const items = await partnershipTournamentRequestDelegate.findMany({
    where: {
      OR: [
        { ownerOrganizationId: check.organization.id },
        { partnerOrganizationId: check.organization.id },
      ],
      ...(status ? { status: status as PartnershipTournamentRequestStatus } : {}),
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
      : Promise.resolve([] as Array<{ id: number; publicName: string | null; businessName: string | null; username: string | null }>),
    clubIds.length > 0
      ? prisma.padelClub.findMany({
          where: { id: { in: clubIds }, deletedAt: null },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as Array<{ id: number; name: string }>),
  ]);

  const organizationNameById = new Map<number, string>(
    organizations.map((organization): [number, string] => [
      organization.id,
      organization.publicName || organization.businessName || organization.username || "Organização",
    ]),
  );
  const clubNameById = new Map<number, string>(clubs.map((club): [number, string] => [club.id, club.name]));

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
  if (!partnershipTournamentRequestDelegate) {
    return jsonWrap({ ok: false, error: "PARTNERSHIP_REQUESTS_UNAVAILABLE" }, { status: 503 });
  }

  const agreementId = parsePositiveInt(body.agreementId);
  const ownerOrganizationIdInput = parsePositiveInt(body.partnerOrganizationId);
  const ownerOrganizationUsernameInput =
    typeof body.partnerOrganizationUsername === "string" ? body.partnerOrganizationUsername.trim() : "";

  const partnerClub = await prisma.padelClub.findFirst({
    where: {
      organizationId: check.organization.id,
      kind: PadelClubKind.OWN,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!partnerClub) {
    return jsonWrap({ ok: false, error: "PARTNER_ORGANIZATION_CLUB_REQUIRED" }, { status: 409 });
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

  const ownerOrganizationId = await resolveOwnerOrganizationId({
    partnerOrganizationId: ownerOrganizationIdInput,
    partnerOrganizationUsername: ownerOrganizationUsernameInput || null,
  });
  if (!agreementId && (ownerOrganizationIdInput || ownerOrganizationUsernameInput) && !ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "PARTNER_ORGANIZATION_NOT_FOUND" }, { status: 404 });
  }

  const agreementDateClauses = [
    { OR: [{ startsAt: null }, { startsAt: { lte: endsAt } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }] },
  ];

  const agreementWhere = {
    partnerOrganizationId: check.organization.id,
    status: "APPROVED" as const,
    revokedAt: null,
    ...(agreementId ? { id: agreementId } : {}),
    ...(ownerOrganizationId ? { ownerOrganizationId } : {}),
    AND: agreementDateClauses,
  };

  const agreements = await prisma.padelPartnershipAgreement.findMany({
    where: agreementWhere,
    select: {
      id: true,
      ownerOrganizationId: true,
      ownerClubId: true,
      partnerOrganizationId: true,
      partnerClubId: true,
      approvedAt: true,
    },
    orderBy: [{ approvedAt: "desc" }, { id: "desc" }],
    take: agreementId ? 1 : 5,
  });

  if (agreements.length === 0) {
    return jsonWrap({ ok: false, error: "AGREEMENT_REQUIRED" }, { status: 409 });
  }
  if (!agreementId && !ownerOrganizationId && agreements.length > 1) {
    return jsonWrap(
      { ok: false, error: "AGREEMENT_REQUIRED", reason: "MULTIPLE_APPROVED_AGREEMENTS" },
      { status: 409 },
    );
  }
  const agreement = agreements[0]!;
  if (agreement.partnerClubId && agreement.partnerClubId !== partnerClub.id) {
    return jsonWrap({ ok: false, error: "AGREEMENT_CLUB_MISMATCH" }, { status: 409 });
  }

  const overlappingPending = await partnershipTournamentRequestDelegate.count({
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
  const created = await partnershipTournamentRequestDelegate.create({
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
