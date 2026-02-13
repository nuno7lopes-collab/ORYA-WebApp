export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelClubKind, PadelPartnershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { ensurePartnershipOrganization, parseOptionalDate } from "@/app/api/padel/partnerships/_shared";
import { syncPartnerClubCourts } from "@/domain/padel/partnerCourtSync";

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

  const updated = await prisma.$transaction(async (tx) => {
    const ownerClub = await tx.padelClub.findUnique({
      where: { id: agreement.ownerClubId },
      select: {
        id: true,
        name: true,
        shortName: true,
        addressId: true,
        courtsCount: true,
      },
    });
    if (!ownerClub) {
      throw new Error("OWNER_CLUB_NOT_FOUND");
    }

    let partnerClub = agreement.partnerClubId
      ? await tx.padelClub.findFirst({
          where: {
            id: agreement.partnerClubId,
            organizationId: agreement.partnerOrganizationId,
            kind: PadelClubKind.PARTNER,
            sourceClubId: ownerClub.id,
            deletedAt: null,
          },
          select: { id: true },
        })
      : null;

    if (!partnerClub) {
      partnerClub =
        (await tx.padelClub.findFirst({
          where: {
            organizationId: agreement.partnerOrganizationId,
            kind: PadelClubKind.PARTNER,
            sourceClubId: ownerClub.id,
            deletedAt: null,
          },
          select: { id: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })) ??
        (await tx.padelClub.create({
          data: {
            organizationId: agreement.partnerOrganizationId,
            name: ownerClub.name,
            shortName: ownerClub.shortName ?? ownerClub.name,
            addressId: ownerClub.addressId,
            kind: PadelClubKind.PARTNER,
            sourceClubId: ownerClub.id,
            courtsCount: Math.max(1, ownerClub.courtsCount ?? 1),
            hours: null,
            favoriteCategoryIds: [],
            isActive: true,
            isDefault: false,
            slug: null,
          },
          select: { id: true },
        }));
    }

    const synced = await syncPartnerClubCourts({
      db: tx,
      partnerOrganizationId: agreement.partnerOrganizationId,
      partnerClubId: partnerClub.id,
      sourceClubId: ownerClub.id,
      fallbackCount: Math.max(1, ownerClub.courtsCount ?? 1),
    });

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
      partnerCourtSync: synced,
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
