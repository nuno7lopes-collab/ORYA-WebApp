export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  PadelPartnershipPriorityMode,
  PadelPartnershipStatus,
  PadelClubKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  ensurePartnershipOrganization,
  parseBoolean,
  parseOptionalDate,
  parsePositiveInt,
} from "@/app/api/padel/partnerships/_shared";

const ACTIVE_AGREEMENT_STATUSES: PadelPartnershipStatus[] = ["PENDING", "APPROVED", "PAUSED"];
const PRIORITY_MODES = new Set<PadelPartnershipPriorityMode>([
  "FIRST_CONFIRMED_WITH_OWNER_OVERRIDE",
  "OWNER_PRIORITY",
  "MANUAL_APPROVAL",
]);
const PARTNERSHIP_STATUSES = new Set<PadelPartnershipStatus>([
  "PENDING",
  "APPROVED",
  "PAUSED",
  "REVOKED",
  "EXPIRED",
]);

async function _GET(req: NextRequest) {
  const check = await ensurePartnershipOrganization({ req, required: "VIEW" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const statusRaw = req.nextUrl.searchParams.get("status");
  const status = statusRaw ? statusRaw.trim().toUpperCase() : null;
  if (status && !PARTNERSHIP_STATUSES.has(status as PadelPartnershipStatus)) {
    return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const items = await prisma.padelPartnershipAgreement.findMany({
    where: {
      OR: [
        { ownerOrganizationId: check.organization.id },
        { partnerOrganizationId: check.organization.id },
      ],
      ...(status ? { status: status as PadelPartnershipStatus } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });

  const agreementIds = items.map((item) => item.id);
  const [policies, windows, grants] = agreementIds.length
    ? await Promise.all([
        prisma.padelPartnershipBookingPolicy.findMany({
          where: { agreementId: { in: agreementIds } },
        }),
        prisma.padelPartnershipWindow.findMany({
          where: { agreementId: { in: agreementIds } },
          select: { agreementId: true, isActive: true },
        }),
        prisma.padelPartnerRoleGrant.findMany({
          where: { agreementId: { in: agreementIds } },
          select: { agreementId: true, isActive: true, revokedAt: true, expiresAt: true },
        }),
      ])
    : [[], [], []];
  const policyByAgreementId = new Map(policies.map((policy) => [policy.agreementId, policy]));
  const windowsCountByAgreementId = new Map<number, number>();
  const activeWindowsCountByAgreementId = new Map<number, number>();
  windows.forEach((window) => {
    windowsCountByAgreementId.set(window.agreementId, (windowsCountByAgreementId.get(window.agreementId) ?? 0) + 1);
    if (window.isActive) {
      activeWindowsCountByAgreementId.set(
        window.agreementId,
        (activeWindowsCountByAgreementId.get(window.agreementId) ?? 0) + 1,
      );
    }
  });

  const activeGrantsCountByAgreementId = new Map<number, number>();
  const now = new Date();
  grants.forEach((grant) => {
    const active = grant.isActive && !grant.revokedAt && grant.expiresAt > now;
    if (!active) return;
    activeGrantsCountByAgreementId.set(
      grant.agreementId,
      (activeGrantsCountByAgreementId.get(grant.agreementId) ?? 0) + 1,
    );
  });

  return jsonWrap(
    {
      ok: true,
      items: items.map((item) => ({
        ...item,
        policy: policyByAgreementId.get(item.id) ?? null,
        windowsCount: windowsCountByAgreementId.get(item.id) ?? 0,
        activeWindowsCount: activeWindowsCountByAgreementId.get(item.id) ?? 0,
        activeGrantsCount: activeGrantsCountByAgreementId.get(item.id) ?? 0,
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

  const ownerClubId = parsePositiveInt(body.ownerClubId);
  if (!ownerClubId) {
    return jsonWrap({ ok: false, error: "OWNER_CLUB_REQUIRED" }, { status: 400 });
  }

  const ownerClub = await prisma.padelClub.findFirst({
    where: { id: ownerClubId, deletedAt: null, isActive: true },
    select: { id: true, organizationId: true, kind: true },
  });
  if (!ownerClub) {
    return jsonWrap({ ok: false, error: "OWNER_CLUB_NOT_FOUND" }, { status: 404 });
  }
  if (ownerClub.kind !== PadelClubKind.OWN) {
    return jsonWrap({ ok: false, error: "OWNER_CLUB_KIND_INVALID" }, { status: 400 });
  }

  const ownerOrganizationId = ownerClub.organizationId;
  const requestedPartnerOrganizationId = parsePositiveInt(body.partnerOrganizationId);
  const partnerOrganizationId = requestedPartnerOrganizationId ?? check.organization.id;

  if (!partnerOrganizationId || partnerOrganizationId === ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "PARTNER_ORGANIZATION_INVALID" }, { status: 400 });
  }

  if (check.organization.id !== ownerOrganizationId && check.organization.id !== partnerOrganizationId) {
    return jsonWrap({ ok: false, error: "ORGANIZATION_SCOPE_MISMATCH" }, { status: 403 });
  }

  const partnerOrganization = await prisma.organization.findUnique({
    where: { id: partnerOrganizationId },
    select: { id: true },
  });
  if (!partnerOrganization) {
    return jsonWrap({ ok: false, error: "PARTNER_ORGANIZATION_NOT_FOUND" }, { status: 404 });
  }

  const requestedPartnerClubId = parsePositiveInt(body.partnerClubId);
  const inferredPartnerClub = requestedPartnerClubId
    ? await prisma.padelClub.findFirst({
        where: {
          id: requestedPartnerClubId,
          organizationId: partnerOrganizationId,
          kind: PadelClubKind.PARTNER,
          sourceClubId: ownerClub.id,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      })
    : await prisma.padelClub.findFirst({
        where: {
          organizationId: partnerOrganizationId,
          kind: PadelClubKind.PARTNER,
          sourceClubId: ownerClub.id,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

  if (requestedPartnerClubId && !inferredPartnerClub) {
    return jsonWrap({ ok: false, error: "PARTNER_CLUB_NOT_FOUND" }, { status: 404 });
  }

  const startsAt = parseOptionalDate(body.startsAt);
  const endsAt = parseOptionalDate(body.endsAt);
  if ((body.startsAt && !startsAt) || (body.endsAt && !endsAt)) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const note = typeof body.notes === "string" ? body.notes.trim() : "";
  const autoApprove = parseBoolean(body.autoApprove, true);
  const status: PadelPartnershipStatus =
    check.organization.id === ownerOrganizationId && autoApprove ? "APPROVED" : "PENDING";

  const existing = await prisma.padelPartnershipAgreement.findFirst({
    where: {
      ownerClubId: ownerClub.id,
      partnerOrganizationId,
      status: { in: ACTIVE_AGREEMENT_STATUSES },
      revokedAt: null,
    },
    select: { id: true, status: true },
  });
  if (existing) {
    return jsonWrap(
      {
        ok: false,
        error: "ACTIVE_AGREEMENT_ALREADY_EXISTS",
        agreementId: existing.id,
        agreementStatus: existing.status,
      },
      { status: 409 },
    );
  }

  const policyInput =
    body.policy && typeof body.policy === "object" && !Array.isArray(body.policy)
      ? (body.policy as Record<string, unknown>)
      : {};
  const priorityModeRaw =
    typeof policyInput.priorityMode === "string" ? policyInput.priorityMode.trim().toUpperCase() : "";
  const priorityMode = PRIORITY_MODES.has(priorityModeRaw as PadelPartnershipPriorityMode)
    ? (priorityModeRaw as PadelPartnershipPriorityMode)
    : "FIRST_CONFIRMED_WITH_OWNER_OVERRIDE";

  const agreement = await prisma.$transaction(async (tx) => {
    const created = await tx.padelPartnershipAgreement.create({
      data: {
        ownerOrganizationId,
        partnerOrganizationId,
        ownerClubId: ownerClub.id,
        partnerClubId: inferredPartnerClub?.id ?? null,
        status,
        startsAt,
        endsAt,
        requestedByUserId: check.userId,
        approvedByUserId: status === "APPROVED" ? check.userId : null,
        approvedAt: status === "APPROVED" ? new Date() : null,
        notes: note || null,
      },
    });

    const policy = await tx.padelPartnershipBookingPolicy.create({
      data: {
        agreementId: created.id,
        priorityMode,
        ownerOverrideAllowed: parseBoolean(policyInput.ownerOverrideAllowed, true),
        ownerOverrideRequiresAudit: parseBoolean(policyInput.ownerOverrideRequiresAudit, true),
        autoCompensationOnOverride: parseBoolean(policyInput.autoCompensationOnOverride, true),
        protectExternalReservations: parseBoolean(policyInput.protectExternalReservations, true),
        hardStopMinutesBeforeBooking: Math.max(
          0,
          Math.floor(parsePositiveInt(policyInput.hardStopMinutesBeforeBooking) ?? 30),
        ),
      },
    });

    return { created, policy };
  });

  return jsonWrap(
    {
      ok: true,
      agreement: agreement.created,
      policy: agreement.policy,
    },
    { status: 201 },
  );
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
