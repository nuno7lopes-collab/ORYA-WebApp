export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPartnershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  ensurePartnershipOrganization,
  parseBoolean,
  parseOptionalDate,
  parsePositiveInt,
} from "@/app/api/padel/partnerships/_shared";

function normalizeMinute(value: unknown, fallback: number) {
  const minute = typeof value === "number" ? Math.floor(value) : Number(value);
  if (!Number.isFinite(minute)) return fallback;
  return Math.min(1440, Math.max(0, Math.floor(minute)));
}

function parseWindowPayloads(body: Record<string, unknown>) {
  if (Array.isArray(body.windows)) {
    return body.windows.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  return [body];
}

function parseWindowId(req: NextRequest, body?: Record<string, unknown> | null) {
  const fromBody = parsePositiveInt(body?.windowId ?? body?.id ?? null);
  if (fromBody) return fromBody;
  const fromQuery = parsePositiveInt(req.nextUrl.searchParams.get("windowId"));
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
      ownerClubId: true,
      status: true,
    },
  });
}

function validateAgreementStatus(status: PadelPartnershipStatus) {
  return status !== PadelPartnershipStatus.REVOKED && status !== PadelPartnershipStatus.EXPIRED;
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
  const items = await prisma.padelPartnershipWindow.findMany({
    where: {
      agreementId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { ownerCourtId: "asc" }, { startMinute: "asc" }, { id: "asc" }],
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

  const agreement = await prisma.padelPartnershipAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      ownerOrganizationId: true,
      ownerClubId: true,
      status: true,
    },
  });
  if (!agreement) return jsonWrap({ ok: false, error: "AGREEMENT_NOT_FOUND" }, { status: 404 });
  if (check.organization.id !== agreement.ownerOrganizationId) {
    return jsonWrap({ ok: false, error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  }
  if (agreement.status === PadelPartnershipStatus.REVOKED || agreement.status === PadelPartnershipStatus.EXPIRED) {
    return jsonWrap({ ok: false, error: "AGREEMENT_NOT_ACTIVE" }, { status: 409 });
  }

  const replaceExisting = parseBoolean(body.replaceExisting, false);
  const timezone =
    typeof body.timezone === "string" && body.timezone.trim().length > 0
      ? body.timezone.trim()
      : "Europe/Lisbon";
  const payloads = parseWindowPayloads(body);
  if (payloads.length === 0) {
    return jsonWrap({ ok: false, error: "WINDOWS_REQUIRED" }, { status: 400 });
  }

  const ownerCourts = await prisma.padelClubCourt.findMany({
    where: {
      padelClubId: agreement.ownerClubId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const ownerCourtIds = new Set(ownerCourts.map((court) => court.id));

  const toCreate: Array<{
    agreementId: number;
    ownerClubId: number;
    ownerCourtId: number | null;
    weekdayMask: number;
    startMinute: number;
    endMinute: number;
    timezone: string;
    startsAt: Date | null;
    endsAt: Date | null;
    requiresApproval: boolean;
    capacityParallelSlots: number;
    isActive: boolean;
  }> = [];

  for (const payload of payloads) {
    const startMinute = normalizeMinute(payload.startMinute, 9 * 60);
    const endMinute = normalizeMinute(payload.endMinute, 23 * 60);
    if (endMinute <= startMinute) {
      return jsonWrap({ ok: false, error: "INVALID_MINUTE_RANGE" }, { status: 400 });
    }

    const weekdayMaskRaw =
      typeof payload.weekdayMask === "number" || typeof payload.weekdayMask === "string"
        ? Number(payload.weekdayMask)
        : 127;
    const weekdayMask = Number.isFinite(weekdayMaskRaw) ? Math.max(0, Math.min(127, Math.floor(weekdayMaskRaw))) : 127;

    const startsAt = parseOptionalDate(payload.startsAt);
    const endsAt = parseOptionalDate(payload.endsAt);
    if ((payload.startsAt && !startsAt) || (payload.endsAt && !endsAt)) {
      return jsonWrap({ ok: false, error: "INVALID_WINDOW_DATE_RANGE" }, { status: 400 });
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      return jsonWrap({ ok: false, error: "INVALID_WINDOW_DATE_RANGE" }, { status: 400 });
    }

    const courtIdsRaw = Array.isArray(payload.courtIds)
      ? payload.courtIds.map((courtId) => parsePositiveInt(courtId)).filter((courtId): courtId is number => Boolean(courtId))
      : [];
    const ownerCourtId = parsePositiveInt(payload.ownerCourtId);
    const resolvedCourtIds =
      courtIdsRaw.length > 0
        ? courtIdsRaw
        : ownerCourtId
          ? [ownerCourtId]
          : [null];

    for (const resolvedCourtId of resolvedCourtIds) {
      if (resolvedCourtId !== null && !ownerCourtIds.has(resolvedCourtId)) {
        return jsonWrap({ ok: false, error: "COURT_NOT_IN_OWNER_CLUB" }, { status: 400 });
      }
      toCreate.push({
        agreementId: agreement.id,
        ownerClubId: agreement.ownerClubId,
        ownerCourtId: resolvedCourtId,
        weekdayMask,
        startMinute,
        endMinute,
        timezone,
        startsAt,
        endsAt,
        requiresApproval: parseBoolean(payload.requiresApproval, false),
        capacityParallelSlots: Math.max(1, Math.floor(parsePositiveInt(payload.capacityParallelSlots) ?? 1)),
        isActive: true,
      });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    if (replaceExisting) {
      await tx.padelPartnershipWindow.updateMany({
        where: { agreementId: agreement.id, isActive: true },
        data: { isActive: false },
      });
    }

    const rows = [] as Awaited<ReturnType<typeof tx.padelPartnershipWindow.create>>[];
    for (const input of toCreate) {
      const row = await tx.padelPartnershipWindow.create({ data: input });
      rows.push(row);
    }
    return rows;
  });

  return jsonWrap(
    {
      ok: true,
      items: created,
    },
    { status: 201 },
  );
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
  if (!validateAgreementStatus(agreement.status)) {
    return jsonWrap({ ok: false, error: "AGREEMENT_NOT_ACTIVE" }, { status: 409 });
  }

  const windowId = parseWindowId(req, body);
  if (!windowId) return jsonWrap({ ok: false, error: "WINDOW_ID_REQUIRED" }, { status: 400 });
  const existing = await prisma.padelPartnershipWindow.findFirst({
    where: { id: windowId, agreementId: agreement.id },
    select: {
      id: true,
      ownerCourtId: true,
      startMinute: true,
      endMinute: true,
      weekdayMask: true,
      timezone: true,
      startsAt: true,
      endsAt: true,
      requiresApproval: true,
      capacityParallelSlots: true,
      isActive: true,
    },
  });
  if (!existing) return jsonWrap({ ok: false, error: "WINDOW_NOT_FOUND" }, { status: 404 });

  const nextStartMinute = body.startMinute !== undefined ? normalizeMinute(body.startMinute, existing.startMinute) : existing.startMinute;
  const nextEndMinute = body.endMinute !== undefined ? normalizeMinute(body.endMinute, existing.endMinute) : existing.endMinute;
  if (nextEndMinute <= nextStartMinute) {
    return jsonWrap({ ok: false, error: "INVALID_MINUTE_RANGE" }, { status: 400 });
  }

  const weekdayMaskRaw =
    body.weekdayMask !== undefined
      ? Number(body.weekdayMask)
      : existing.weekdayMask;
  const weekdayMask = Number.isFinite(weekdayMaskRaw) ? Math.max(0, Math.min(127, Math.floor(weekdayMaskRaw))) : existing.weekdayMask;

  const startsAt = body.startsAt !== undefined ? parseOptionalDate(body.startsAt) : existing.startsAt;
  const endsAt = body.endsAt !== undefined ? parseOptionalDate(body.endsAt) : existing.endsAt;
  if ((body.startsAt !== undefined && body.startsAt !== null && !startsAt) || (body.endsAt !== undefined && body.endsAt !== null && !endsAt)) {
    return jsonWrap({ ok: false, error: "INVALID_WINDOW_DATE_RANGE" }, { status: 400 });
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_WINDOW_DATE_RANGE" }, { status: 400 });
  }

  const ownerCourtIdRaw =
    body.ownerCourtId !== undefined
      ? body.ownerCourtId
      : existing.ownerCourtId;
  const ownerCourtId = ownerCourtIdRaw === null ? null : parsePositiveInt(ownerCourtIdRaw);
  if (ownerCourtId !== null) {
    const court = await prisma.padelClubCourt.findFirst({
      where: {
        id: ownerCourtId,
        padelClubId: agreement.ownerClubId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!court) {
      return jsonWrap({ ok: false, error: "COURT_NOT_IN_OWNER_CLUB" }, { status: 400 });
    }
  }

  const updated = await prisma.padelPartnershipWindow.update({
    where: { id: existing.id },
    data: {
      ownerCourtId,
      weekdayMask,
      startMinute: nextStartMinute,
      endMinute: nextEndMinute,
      timezone:
        body.timezone !== undefined && typeof body.timezone === "string" && body.timezone.trim().length > 0
          ? body.timezone.trim()
          : existing.timezone,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      requiresApproval:
        body.requiresApproval !== undefined ? parseBoolean(body.requiresApproval, existing.requiresApproval) : existing.requiresApproval,
      capacityParallelSlots:
        body.capacityParallelSlots !== undefined
          ? Math.max(1, Math.floor(parsePositiveInt(body.capacityParallelSlots) ?? existing.capacityParallelSlots))
          : existing.capacityParallelSlots,
      isActive: body.isActive !== undefined ? parseBoolean(body.isActive, existing.isActive) : existing.isActive,
    },
  });

  return jsonWrap({ ok: true, item: updated }, { status: 200 });
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

  const windowId = parseWindowId(req);
  if (!windowId) return jsonWrap({ ok: false, error: "WINDOW_ID_REQUIRED" }, { status: 400 });

  const existing = await prisma.padelPartnershipWindow.findFirst({
    where: { id: windowId, agreementId: agreement.id },
    select: { id: true, isActive: true },
  });
  if (!existing) return jsonWrap({ ok: false, error: "WINDOW_NOT_FOUND" }, { status: 404 });

  const item = await prisma.padelPartnershipWindow.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  return jsonWrap({ ok: true, item }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
