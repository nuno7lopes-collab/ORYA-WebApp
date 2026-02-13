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

export const POST = withApiEnvelope(_POST);
