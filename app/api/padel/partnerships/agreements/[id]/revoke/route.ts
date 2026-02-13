export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PadelPartnershipStatus } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { ensurePartnershipOrganization } from "@/app/api/padel/partnerships/_shared";

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
      status: true,
    },
  });
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== agreement.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }
  if (agreement.status === PadelPartnershipStatus.REVOKED) {
    return jsonWrap({ ok: false, error: "AGREEMENT_ALREADY_REVOKED" }, { status: 409 });
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updatedAgreement = await tx.padelPartnershipAgreement.update({
      where: { id: agreement.id },
      data: {
        status: PadelPartnershipStatus.REVOKED,
        revokedByUserId: check.userId,
        revokedAt: now,
      },
    });

    const pausedWindows = await tx.padelPartnershipWindow.updateMany({
      where: { agreementId: agreement.id, isActive: true },
      data: { isActive: false },
    });

    const revokedGrants = await tx.padelPartnerRoleGrant.updateMany({
      where: {
        agreementId: agreement.id,
        isActive: true,
        revokedAt: null,
      },
      data: {
        isActive: false,
        revokedByUserId: check.userId,
        revokedAt: now,
      },
    });

    return { updatedAgreement, pausedWindows: pausedWindows.count, revokedGrants: revokedGrants.count };
  });

  await recordOrganizationAuditSafe({
    organizationId: agreement.ownerOrganizationId,
    actorUserId: check.userId,
    action: "PADEL_PARTNERSHIP_AGREEMENT_REVOKED",
    entityType: "padel_partnership_agreement",
    entityId: String(agreement.id),
    metadata: {
      agreementId: agreement.id,
      previousStatus: agreement.status,
      newStatus: result.updatedAgreement.status,
      deactivatedWindows: result.pausedWindows,
      revokedGrants: result.revokedGrants,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap(
    {
      ok: true,
      agreement: result.updatedAgreement,
      deactivatedWindows: result.pausedWindows,
      revokedGrants: result.revokedGrants,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
