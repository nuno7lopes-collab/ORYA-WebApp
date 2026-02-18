import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { SourceType, OrganizationMemberRole } from "@prisma/client";
import { buildAgendaOverlapFilter } from "@/domain/agendaReadModel/overlap";

function parsePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function parseIsoDate(raw: string | null) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseOrgIds(raw: string | null) {
  if (!raw) return [] as number[];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
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

async function _GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(ctx, { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false }, { status: 400 });
    }

    const group = await prisma.organizationGroup.findUnique({
      where: { id: groupId },
      select: { id: true, ownerUserId: true },
    });
    if (!group) {
      return respondError(ctx, { errorCode: "GROUP_NOT_FOUND", message: "GROUP_NOT_FOUND", retryable: false }, { status: 404 });
    }

    const isOwner = group.ownerUserId === user.id;
    if (!isOwner) {
      const governanceMember = await prisma.organizationGroupMember.findFirst({
        where: {
          groupId,
          userId: user.id,
          isGovernance: true,
          scopeAllOrgs: true,
          role: { in: [OrganizationMemberRole.OWNER, OrganizationMemberRole.CO_OWNER, OrganizationMemberRole.ADMIN] },
        },
        select: { id: true },
      });
      if (!governanceMember) {
        return respondError(ctx, { errorCode: "FORBIDDEN", message: "FORBIDDEN", retryable: false }, { status: 403 });
      }
    }

    const url = new URL(req.url);
    const from = parseIsoDate(url.searchParams.get("from"));
    const to = parseIsoDate(url.searchParams.get("to"));
    if (!from || !to) {
      return respondError(ctx, { errorCode: "MISSING_RANGE", message: "MISSING_RANGE", retryable: false }, { status: 400 });
    }

    const requestedOrgIds = parseOrgIds(url.searchParams.get("orgIds"));
    const sourceTypes = parseSourceTypes(url.searchParams.get("types"));

    const organizations = await prisma.organization.findMany({
      where: { groupId },
      select: { id: true, publicName: true, businessName: true },
      orderBy: { id: "asc" },
    });
    const orgById = new Map(
      organizations.map((org) => [org.id, org.publicName?.trim() || org.businessName?.trim() || `Organização #${org.id}`]),
    );

    const allowedOrgIds = organizations.map((org) => org.id);
    const scopedOrgIds = requestedOrgIds.length
      ? requestedOrgIds.filter((id) => allowedOrgIds.includes(id))
      : allowedOrgIds;

    if (scopedOrgIds.length === 0) {
      return respondOk(ctx, { items: [], organizations: [] }, { status: 200 });
    }

    const items = await prisma.agendaItem.findMany({
      where: {
        organizationId: { in: scopedOrgIds },
        ...buildAgendaOverlapFilter({ from, to }),
        sourceType: { in: sourceTypes },
        status: { not: "DELETED" },
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
        organizationName: orgById.get(item.organizationId) ?? `Organização #${item.organizationId}`,
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
        organizations: scopedOrgIds.map((id) => ({ id, name: orgById.get(id) ?? `Organização #${id}` })),
        items: mapped,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[org-hub/groups/dashboard/agenda][GET]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
