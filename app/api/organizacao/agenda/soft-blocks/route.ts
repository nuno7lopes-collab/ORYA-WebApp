import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { prisma } from "@/lib/prisma";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { SoftBlockScope } from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { createSoftBlock, deleteSoftBlock, updateSoftBlock } from "@/domain/softBlocks/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] as const;

const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseScopeType = (value: unknown) => {
  if (typeof value !== "string") return SoftBlockScope.ORGANIZATION;
  const raw = value.trim().toUpperCase();
  if (raw === "PROFESSIONAL") return SoftBlockScope.PROFESSIONAL;
  if (raw === "RESOURCE") return SoftBlockScope.RESOURCE;
  if (raw === "COURT") return SoftBlockScope.COURT;
  return SoftBlockScope.ORGANIZATION;
};

const parseScopeId = (value: unknown) => {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
};

const isActiveBooking = (booking: { status: string; pendingExpiresAt: Date | null }) => {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(booking.status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > new Date() : false;
  }
  return false;
};

const buildMatchWindow = (match: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
}) => {
  const start = match.plannedStartAt ?? match.startTime;
  const end =
    match.plannedEndAt ||
    (start && match.plannedDurationMinutes
      ? new Date(start.getTime() + Number(match.plannedDurationMinutes) * 60 * 1000)
      : match.startTime);
  return { start, end: end ?? start };
};

function agendaConflictResponse(decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"]) {
  return {
    ok: false,
    ...buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" }),
  };
}

async function loadSoftBlockExistingCandidates(params: {
  organizationId: number;
  scopeType: SoftBlockScope;
  scopeId: number | null;
  startsAt: Date;
  endsAt: Date;
  excludeSoftBlockId?: number;
}) {
  const { organizationId, scopeType, scopeId, startsAt, endsAt, excludeSoftBlockId } = params;
  const candidates: AgendaCandidate[] = [];

  if (scopeType === SoftBlockScope.ORGANIZATION) {
    const softBlocks = await prisma.softBlock.findMany({
      where: {
        organizationId,
        scopeType: SoftBlockScope.ORGANIZATION,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeSoftBlockId ? { id: { not: excludeSoftBlockId } } : {}),
      },
      select: { id: true, startsAt: true, endsAt: true },
    });
    softBlocks.forEach((block) => {
      candidates.push({
        type: "SOFT_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startsAt,
        endsAt: block.endsAt,
      });
    });
    return candidates;
  }

  if (!scopeId) return null;

  if (scopeType === SoftBlockScope.PROFESSIONAL || scopeType === SoftBlockScope.RESOURCE) {
    const [softBlocks, bookings] = await Promise.all([
      prisma.softBlock.findMany({
        where: {
          organizationId,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          OR: [
            { scopeType: SoftBlockScope.ORGANIZATION },
            { scopeType, scopeId },
          ],
          ...(excludeSoftBlockId ? { id: { not: excludeSoftBlockId } } : {}),
        },
        select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId,
          ...(scopeType === SoftBlockScope.RESOURCE ? { resourceId: scopeId } : { professionalId: scopeId }),
          startsAt: { lt: endsAt },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] } },
          ],
        },
        select: { id: true, startsAt: true, durationMinutes: true, status: true, pendingExpiresAt: true },
      }),
    ]);

    softBlocks.forEach((block) => {
      if (block.scopeType !== SoftBlockScope.ORGANIZATION && block.scopeId !== scopeId) return;
      candidates.push({
        type: "SOFT_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startsAt,
        endsAt: block.endsAt,
      });
    });

    bookings.forEach((booking) => {
      if (!isActiveBooking(booking)) return;
      const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
      if (!(booking.startsAt < endsAt && end > startsAt)) return;
      candidates.push({
        type: "BOOKING",
        sourceId: String(booking.id),
        startsAt: booking.startsAt,
        endsAt: end,
      });
    });

    return candidates;
  }

  if (scopeType === SoftBlockScope.COURT) {
    const [softBlocks, blocks, matches, bookings] = await Promise.all([
      prisma.softBlock.findMany({
        where: {
          organizationId,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          OR: [
            { scopeType: SoftBlockScope.ORGANIZATION },
            { scopeType: SoftBlockScope.COURT, scopeId },
          ],
          ...(excludeSoftBlockId ? { id: { not: excludeSoftBlockId } } : {}),
        },
        select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
      }),
      prisma.padelCourtBlock.findMany({
        where: {
          organizationId,
          courtId: scopeId,
          startAt: { lt: endsAt },
          endAt: { gt: startsAt },
        },
        select: { id: true, startAt: true, endAt: true },
      }),
      prisma.padelMatch.findMany({
        where: {
          event: { organizationId },
          courtId: scopeId,
          OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
        },
        select: { id: true, plannedStartAt: true, plannedEndAt: true, plannedDurationMinutes: true, startTime: true },
      }),
      prisma.booking.findMany({
        where: {
          courtId: scopeId,
          startsAt: { lt: endsAt },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] } },
          ],
        },
        select: { id: true, startsAt: true, durationMinutes: true, status: true, pendingExpiresAt: true },
      }),
    ]);

    softBlocks.forEach((block) => {
      if (block.scopeType !== SoftBlockScope.ORGANIZATION && block.scopeId !== scopeId) return;
      candidates.push({
        type: "SOFT_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startsAt,
        endsAt: block.endsAt,
      });
    });

    blocks.forEach((block) => {
      candidates.push({
        type: "HARD_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startAt,
        endsAt: block.endAt,
      });
    });

    matches.forEach((match) => {
      const { start, end } = buildMatchWindow(match);
      if (!start || !end) return;
      if (!(start < endsAt && end > startsAt)) return;
      candidates.push({
        type: "MATCH_SLOT",
        sourceId: String(match.id),
        startsAt: start,
        endsAt: end,
      });
    });

    bookings.forEach((booking) => {
      if (!isActiveBooking(booking)) return;
      const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
      if (!(booking.startsAt < endsAt && end > startsAt)) return;
      candidates.push({
        type: "BOOKING",
        sourceId: String(booking.id),
        startsAt: booking.startsAt,
        endsAt: end,
      });
    });

    return candidates;
  }

  return candidates;
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });
  if (!organization || !membership) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const reservasAccess = await ensureReservasModuleAccess(organization);
  if (!reservasAccess.ok) {
    return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const startsAt = parseDate(body.startsAt);
  const endsAt = parseDate(body.endsAt);
  if (!startsAt || !endsAt) {
    return jsonWrap({ ok: false, error: "INVALID_INTERVAL" }, { status: 400 });
  }
  if (endsAt <= startsAt) {
    return jsonWrap({ ok: false, error: "INVALID_INTERVAL" }, { status: 400 });
  }

  const scopeType = parseScopeType(body.scopeType);
  const scopeId = parseScopeId(body.scopeId);
  if (scopeType !== SoftBlockScope.ORGANIZATION && !scopeId) {
    return jsonWrap({ ok: false, error: "SCOPE_ID_REQUIRED" }, { status: 400 });
  }

  let existing: AgendaCandidate[] | null = null;
  try {
    existing = await loadSoftBlockExistingCandidates({
      organizationId: organization.id,
      scopeType,
      scopeId,
      startsAt,
      endsAt,
    });
  } catch {
    return jsonWrap(agendaConflictResponse(), { status: 503 });
  }
  if (!existing) {
    return jsonWrap(agendaConflictResponse(), { status: 503 });
  }

  const candidate: AgendaCandidate = {
    type: "SOFT_BLOCK",
    sourceId: `soft_block:new:${organization.id}:${startsAt.toISOString()}`,
    startsAt,
    endsAt,
  };
  const decision = evaluateCandidate({ candidate, existing });
  if (!decision.allowed) {
    return jsonWrap(agendaConflictResponse(decision), { status: 409 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  const result = await createSoftBlock({
    organizationId: organization.id,
    startsAt,
    endsAt,
    reason,
    scopeType,
    scopeId,
    actorUserId: user.id,
  });

  if (!result.ok) {
    const status = result.error === "SCOPE_NOT_FOUND" ? 404 : 400;
    return jsonWrap({ ok: false, error: result.error }, { status });
  }

  return jsonWrap({ ok: true, softBlockId: result.data.softBlockId }, { status: 201 });
}

async function _PATCH(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });
  if (!organization || !membership) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const reservasAccess = await ensureReservasModuleAccess(organization);
  if (!reservasAccess.ok) {
    return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const id = parseScopeId(body.id);
  if (!id) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const startsAtInput = body.startsAt !== undefined ? parseDate(body.startsAt) : null;
  const endsAtInput = body.endsAt !== undefined ? parseDate(body.endsAt) : null;
  if ((startsAtInput && !endsAtInput) || (!startsAtInput && endsAtInput)) {
    return jsonWrap({ ok: false, error: "INVALID_INTERVAL" }, { status: 400 });
  }

  const scopeTypeInput = body.scopeType ? parseScopeType(body.scopeType) : null;
  const scopeIdInput = body.scopeId !== undefined ? parseScopeId(body.scopeId) : null;

  const existingBlock = await prisma.softBlock.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true, startsAt: true, endsAt: true, scopeType: true, scopeId: true },
  });
  if (!existingBlock) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const nextStartsAt = startsAtInput ?? existingBlock.startsAt;
  const nextEndsAt = endsAtInput ?? existingBlock.endsAt;
  if (nextEndsAt <= nextStartsAt) {
    return jsonWrap({ ok: false, error: "INVALID_INTERVAL" }, { status: 400 });
  }

  const nextScopeType = scopeTypeInput ?? existingBlock.scopeType;
  const nextScopeId = scopeIdInput ?? existingBlock.scopeId;
  if (nextScopeType !== SoftBlockScope.ORGANIZATION && !nextScopeId) {
    return jsonWrap({ ok: false, error: "SCOPE_ID_REQUIRED" }, { status: 400 });
  }

  let existing: AgendaCandidate[] | null = null;
  try {
    existing = await loadSoftBlockExistingCandidates({
      organizationId: organization.id,
      scopeType: nextScopeType,
      scopeId: nextScopeId,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      excludeSoftBlockId: id,
    });
  } catch {
    return jsonWrap(agendaConflictResponse(), { status: 503 });
  }
  if (!existing) {
    return jsonWrap(agendaConflictResponse(), { status: 503 });
  }

  const candidate: AgendaCandidate = {
    type: "SOFT_BLOCK",
    sourceId: String(id),
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
  };
  const decision = evaluateCandidate({ candidate, existing });
  if (!decision.allowed) {
    return jsonWrap(agendaConflictResponse(decision), { status: 409 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() || null : undefined;
  const result = await updateSoftBlock({
    softBlockId: id,
    organizationId: organization.id,
    startsAt: startsAtInput ?? undefined,
    endsAt: endsAtInput ?? undefined,
    reason,
    scopeType: scopeTypeInput ?? undefined,
    scopeId: scopeIdInput ?? undefined,
    actorUserId: user.id,
  });

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : result.error === "SCOPE_NOT_FOUND" ? 404 : 400;
    return jsonWrap({ ok: false, error: result.error }, { status });
  }

  return jsonWrap({ ok: true, softBlockId: result.data.softBlockId }, { status: 200 });
}

async function _DELETE(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });
  if (!organization || !membership) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const reservasAccess = await ensureReservasModuleAccess(organization);
  if (!reservasAccess.ok) {
    return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const id = parseScopeId(body.id);
  if (!id) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const result = await deleteSoftBlock({
    softBlockId: id,
    organizationId: organization.id,
    actorUserId: user.id,
  });

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 400;
    return jsonWrap({ ok: false, error: result.error }, { status });
  }

  return jsonWrap({ ok: true, softBlockId: result.data.softBlockId }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);