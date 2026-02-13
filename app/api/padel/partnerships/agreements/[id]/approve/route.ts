export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPartnershipStatus } from "@prisma/client";
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

  const updated = await prisma.padelPartnershipAgreement.update({
    where: { id: agreement.id },
    data: {
      status: PadelPartnershipStatus.APPROVED,
      startsAt,
      endsAt,
      approvedByUserId: check.userId,
      approvedAt: new Date(),
    },
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
      newStatus: updated.status,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap({ ok: true, agreement: updated }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
