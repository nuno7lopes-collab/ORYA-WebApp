export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelClubKind, PadelPartnershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { ensurePartnershipOrganization, parseOptionalDate } from "@/app/api/padel/partnerships/_shared";

async function _POST(req: NextRequest) {
  const agreementId = readNumericParam(undefined, req, "agreements");
  if (agreementId === null) return jsonWrap({ ok: false, error: "INVALID_AGREEMENT_ID" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const check = await ensurePartnershipOrganization({ req, required: "EDIT", body });
  if (!check.ok) return jsonWrap({ ok: false, error: check.error }, { status: check.status });

  const agreement = await prisma.padelPartnershipAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
      ownerClubId: true,
      partnerClubId: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== agreement.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }

  if (agreement.status === PadelPartnershipStatus.REVOKED || agreement.status === PadelPartnershipStatus.EXPIRED) {
    return jsonWrap({ ok: false, error: "AGREEMENT_NOT_ACTIVABLE" }, { status: 409 });
  }

  const startsAt = parseOptionalDate(body.startsAt) ?? agreement.startsAt;
  const endsAt = parseOptionalDate(body.endsAt) ?? agreement.endsAt;
  if (startsAt && endsAt && endsAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const now = new Date();
  const ownerClub = await prisma.padelClub.findUnique({
    where: { id: agreement.ownerClubId },
    select: { id: true },
  });
  if (!ownerClub) {
    return jsonWrap({ ok: false, error: "OWNER_CLUB_NOT_FOUND" }, { status: 409 });
  }

  const partnerClub = await prisma.padelClub.findFirst({
    where: {
      organizationId: agreement.partnerOrganizationId,
      kind: PadelClubKind.OWN,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!partnerClub) {
    return jsonWrap({ ok: false, error: "PARTNER_CLUB_NOT_FOUND" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextAgreement = await tx.padelPartnershipAgreement.update({
      where: { id: agreement.id },
      data: {
        status: PadelPartnershipStatus.APPROVED,
        startsAt,
        endsAt,
        approvedByUserId: check.userId,
        approvedAt: now,
        partnerClubId: partnerClub.id,
      },
    });

    return {
      agreement: nextAgreement,
      partnerClubId: partnerClub.id,
      partnerCourtSync: null,
    };
  });

  await recordOrganizationAuditSafe({
    organizationId: agreement.ownerOrganizationId,
    actorUserId: check.userId,
    action: "PADEL_PARTNERSHIP_AGREEMENT_APPROVED",
    entityType: "padel_partnership_agreement",
    entityId: String(agreement.id),
    metadata: {
      agreementId: agreement.id,
      previousStatus: agreement.status,
      newStatus: updated.agreement.status,
      startsAt: updated.agreement.startsAt,
      endsAt: updated.agreement.endsAt,
      partnerClubId: updated.partnerClubId,
      partnerCourtSync: updated.partnerCourtSync,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap(
    {
      ok: true,
      agreement: updated.agreement,
      partnerClubId: updated.partnerClubId,
      partnerCourtSync: updated.partnerCourtSync,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
