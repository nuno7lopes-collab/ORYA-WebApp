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

function parseGrantId(req: NextRequest, body?: Record<string, unknown> | null) {
  const fromBody = parsePositiveInt(body?.grantId ?? body?.id ?? null);
  if (fromBody) return fromBody;
  const fromQuery = parsePositiveInt(req.nextUrl.searchParams.get("grantId"));
  if (fromQuery) return fromQuery;
  return null;
}

async function readAgreement(agreementId: number) {
  return prisma.padelPartnershipAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
      status: true,
    },
  });
}

async function _GET(req: NextRequest) {
  const agreementId = readNumericParam(undefined, req, "agreements");
  if (agreementId === null) {
    return jsonWrap({ ok: false, error: "INVALID_AGREEMENT_ID" }, { status: 400 });
  }

  const check = await ensurePartnershipOrganization({ req, required: "VIEW" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const agreement = await readAgreement(agreementId);
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (![agreement.ownerOrganizationId, agreement.partnerOrganizationId].includes(check.organization.id)) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const includeInactive = parseBoolean(req.nextUrl.searchParams.get("includeInactive"), false);
  const now = new Date();
  const items = await prisma.padelPartnerRoleGrant.findMany({
    where: {
      agreementId,
      ...(includeInactive
        ? {}
        : { isActive: true, revokedAt: null, expiresAt: { gt: now } }),
    },
    orderBy: [{ isActive: "desc" }, { expiresAt: "asc" }, { id: "desc" }],
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}

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

  const agreement = await readAgreement(agreementId);
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

async function _PATCH(req: NextRequest) {
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

  const agreement = await readAgreement(agreementId);
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== agreement.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }

  const grantId = parseGrantId(req, body);
  if (!grantId) return jsonWrap({ ok: false, error: "GRANT_ID_REQUIRED" }, { status: 400 });
  const existing = await prisma.padelPartnerRoleGrant.findFirst({
    where: { id: grantId, agreementId: agreement.id },
    select: {
      id: true,
      partnerOrganizationId: true,
      eventId: true,
      userId: true,
      role: true,
      startsAt: true,
      expiresAt: true,
      autoRevoke: true,
      isActive: true,
      scope: true,
      revokedAt: true,
    },
  });
  if (!existing) return jsonWrap({ ok: false, error: "GRANT_NOT_FOUND" }, { status: 404 });

  const roleRaw = typeof body.role === "string" ? body.role.trim().toUpperCase() : existing.role;
  const role = ROLE_SET.has(roleRaw as PadelTournamentRole) ? (roleRaw as PadelTournamentRole) : null;
  if (!role) return jsonWrap({ ok: false, error: "INVALID_ROLE" }, { status: 400 });

  const startsAt = body.startsAt !== undefined ? parseOptionalDate(body.startsAt) : existing.startsAt;
  const expiresAt = body.expiresAt !== undefined ? parseOptionalDate(body.expiresAt) : existing.expiresAt;
  if ((body.startsAt !== undefined && body.startsAt !== null && !startsAt) || (body.expiresAt !== undefined && body.expiresAt !== null && !expiresAt)) {
    return jsonWrap({ ok: false, error: "INVALID_GRANT_WINDOW" }, { status: 400 });
  }
  if (!startsAt || !expiresAt || expiresAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_GRANT_WINDOW" }, { status: 400 });
  }

  const eventIdRaw = body.eventId !== undefined ? body.eventId : existing.eventId;
  const eventId = eventIdRaw === null ? null : parsePositiveInt(eventIdRaw);
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

  const shouldRevoke = body.revoke === true || parseBoolean(body.isActive, true) === false;
  const now = new Date();
  const updated = await prisma.padelPartnerRoleGrant.update({
    where: { id: existing.id },
    data: {
      role,
      eventId,
      startsAt,
      expiresAt,
      autoRevoke: body.autoRevoke !== undefined ? parseBoolean(body.autoRevoke, existing.autoRevoke) : existing.autoRevoke,
      isActive: shouldRevoke ? false : parseBoolean(body.isActive, existing.isActive),
      revokedByUserId: shouldRevoke ? check.userId : null,
      revokedAt: shouldRevoke ? now : null,
      scope:
        body.scope && typeof body.scope === "object" && !Array.isArray(body.scope)
          ? (body.scope as Prisma.InputJsonValue)
          : (existing.scope as Prisma.InputJsonValue),
    },
  });

  return jsonWrap({ ok: true, grant: updated }, { status: 200 });
}

async function _DELETE(req: NextRequest) {
  const agreementId = readNumericParam(undefined, req, "agreements");
  if (agreementId === null) {
    return jsonWrap({ ok: false, error: "INVALID_AGREEMENT_ID" }, { status: 400 });
  }

  const check = await ensurePartnershipOrganization({ req, required: "EDIT" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const agreement = await readAgreement(agreementId);
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== agreement.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }

  const grantId = parseGrantId(req);
  if (!grantId) return jsonWrap({ ok: false, error: "GRANT_ID_REQUIRED" }, { status: 400 });
  const existing = await prisma.padelPartnerRoleGrant.findFirst({
    where: { id: grantId, agreementId: agreement.id },
    select: { id: true },
  });
  if (!existing) return jsonWrap({ ok: false, error: "GRANT_NOT_FOUND" }, { status: 404 });

  const grant = await prisma.padelPartnerRoleGrant.update({
    where: { id: existing.id },
    data: {
      isActive: false,
      revokedByUserId: check.userId,
      revokedAt: new Date(),
    },
  });

  return jsonWrap({ ok: true, grant }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
