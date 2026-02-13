export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPartnershipStatus, PadelTournamentRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getEffectiveOrganizationMember } from "@/lib/organizationMembers";
import {
  ensurePartnershipOrganization,
  parseBoolean,
  parseOptionalDate,
  parsePositiveInt,
} from "@/app/api/padel/partnerships/_shared";

const ROLE_SET = new Set<PadelTournamentRole>(["DIRETOR_PROVA", "REFEREE", "SCOREKEEPER", "STREAMER"]);

async function _POST(req: NextRequest) {
  const agreementId = readNumericParam(undefined, req, "agreements");
  if (agreementId === null) {
    return jsonWrap({ ok: false, error: "INVALID_AGREEMENT_ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const check = await ensurePartnershipOrganization({ req, required: "EDIT", body });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const agreement = await prisma.padelPartnershipAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
      status: true,
    },
  });
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== agreement.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }
  if (agreement.status !== PadelPartnershipStatus.APPROVED && agreement.status !== PadelPartnershipStatus.PAUSED) {
    return jsonWrap({ ok: false, error: "AGREEMENT_NOT_APPROVED" }, { status: 409 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return jsonWrap({ ok: false, error: "USER_ID_REQUIRED" }, { status: 400 });

  const roleRaw = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";
  const role = ROLE_SET.has(roleRaw as PadelTournamentRole) ? (roleRaw as PadelTournamentRole) : null;
  if (!role) return jsonWrap({ ok: false, error: "INVALID_ROLE" }, { status: 400 });

  const startsAt = parseOptionalDate(body.startsAt) ?? new Date();
  const expiresAt = parseOptionalDate(body.expiresAt);
  if (!expiresAt || expiresAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_GRANT_WINDOW" }, { status: 400 });
  }

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

  const partnerMember = await getEffectiveOrganizationMember({
    organizationId: agreement.partnerOrganizationId,
    userId,
  });
  if (!partnerMember) {
    return jsonWrap({ ok: false, error: "USER_NOT_PARTNER_MEMBER" }, { status: 400 });
  }

  const overlappingGrant = await prisma.padelPartnerRoleGrant.findFirst({
    where: {
      agreementId: agreement.id,
      userId,
      role,
      ...(eventId ? { eventId } : {}),
      isActive: true,
      revokedAt: null,
      startsAt: { lt: expiresAt },
      expiresAt: { gt: startsAt },
    },
    select: { id: true },
  });
  if (overlappingGrant) {
    return jsonWrap({ ok: false, error: "OVERLAPPING_GRANT_EXISTS", grantId: overlappingGrant.id }, { status: 409 });
  }

  const grant = await prisma.padelPartnerRoleGrant.create({
    data: {
      agreementId: agreement.id,
      partnerOrganizationId: agreement.partnerOrganizationId,
      eventId: eventId ?? null,
      userId,
      role,
      startsAt,
      expiresAt,
      autoRevoke: parseBoolean(body.autoRevoke, true),
      isActive: true,
      grantedByUserId: check.userId,
      scope:
        body.scope && typeof body.scope === "object" && !Array.isArray(body.scope)
          ? (body.scope as Prisma.InputJsonValue)
          : {},
    },
  });

  return jsonWrap({ ok: true, grant }, { status: 201 });
}

export const POST = withApiEnvelope(_POST);
