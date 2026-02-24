import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";
import { buildAgendaOverlapFilter } from "@/domain/agendaReadModel/overlap";
import { parseOrgIds, parsePositiveInt, resolveGroupDashboardScope } from "../_helpers";

function parseIsoDate(raw: string | null) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseSourceTypes(raw: string | null) {
  if (!raw) return [SourceType.EVENT, SourceType.TOURNAMENT, SourceType.BOOKING];
  const values = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const mapped: SourceType[] = [];
  for (const value of values) {
    if (value === "EVENT") mapped.push(SourceType.EVENT);
    if (value === "TOURNAMENT") mapped.push(SourceType.TOURNAMENT);
    if (value === "RESERVATION" || value === "BOOKING") mapped.push(SourceType.BOOKING);
  }
  return mapped.length > 0 ? mapped : [SourceType.EVENT, SourceType.TOURNAMENT, SourceType.BOOKING];
}

function parseStatuses(raw: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^[A-Z0-9_\\-]+$/.test(value));
}

async function _GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(ctx, { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false }, { status: 400 });
    }

    const url = new URL(req.url);
    const from = parseIsoDate(url.searchParams.get("from"));
    const to = parseIsoDate(url.searchParams.get("to"));
    if (!from || !to) {
      return respondError(ctx, { errorCode: "MISSING_RANGE", message: "MISSING_RANGE", retryable: false }, { status: 400 });
    }

    const requestedOrgIds = parseOrgIds(url.searchParams.get("orgIds"));
    const sourceTypes = parseSourceTypes(url.searchParams.get("types"));
    const statuses = parseStatuses(url.searchParams.get("statuses"));
    const scope = await resolveGroupDashboardScope({
      groupId,
      userId: user.id,
      requestedOrgIds,
    });
    if (!scope.ok) {
      return respondError(
        ctx,
        { errorCode: scope.errorCode, message: scope.message, retryable: false },
        { status: scope.status },
      );
    }

    if (scope.scopedOrgIds.length === 0) {
      return respondOk(ctx, { items: [], organizations: [] }, { status: 200 });
    }

    const items = await prisma.agendaItem.findMany({
      where: {
        organizationId: { in: scope.scopedOrgIds },
        ...buildAgendaOverlapFilter({ from, to }),
        sourceType: { in: sourceTypes },
        ...(statuses.length > 0
          ? { status: { in: statuses } }
          : { status: { not: "DELETED" } }),
      },
      select: {
        organizationId: true,
        title: true,
        startsAt: true,
        endsAt: true,
        sourceType: true,
        sourceId: true,
        status: true,
        padelClubId: true,
        courtId: true,
        resourceId: true,
        professionalId: true,
      },
      orderBy: { startsAt: "asc" },
      take: 2500,
    });

    const mapped = items.map((item) => {
      const base = {
        organizationId: item.organizationId,
        organizationName: scope.orgById.get(item.organizationId) ?? `Organização #${item.organizationId}`,
        title: item.title,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        status: item.status,
        padelClubId: item.padelClubId ?? null,
        courtId: item.courtId ?? null,
        resourceId: item.resourceId ?? null,
        professionalId: item.professionalId ?? null,
      };
      if (item.sourceType === SourceType.TOURNAMENT) {
        return { ...base, kind: "TOURNAMENT", tournamentId: Number(item.sourceId) };
      }
      if (item.sourceType === SourceType.BOOKING) {
        return { ...base, kind: "RESERVATION", reservationId: Number(item.sourceId) };
      }
      return { ...base, kind: "EVENT", eventId: Number(item.sourceId) };
    });

    return respondOk(
      ctx,
      {
        organizations: scope.organizations,
        items: mapped,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return respondError(
        ctx,
        { errorCode: err.code, message: err.code, retryable: false },
        { status: err.status ?? 401 },
      );
    }
    console.error("[org-hub/groups/dashboard/agenda][GET]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
