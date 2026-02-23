export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { OrganizationMemberRole, OrganizationModule, PadelTeamEntryStatus, PadelTeamMemberStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: readRoles,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const viewPermission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!viewPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const eventIdRaw = req.nextUrl.searchParams.get("eventId");
  const teamIdRaw = req.nextUrl.searchParams.get("teamId");
  const hasEventId = eventIdRaw != null;
  const hasTeamId = teamIdRaw != null;
  const eventId = hasEventId ? parsePositiveInt(eventIdRaw) : null;
  const teamId = hasTeamId ? parsePositiveInt(teamIdRaw) : null;
  if (hasEventId && eventId == null) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }
  if (hasTeamId && teamId == null) {
    return jsonWrap({ ok: false, error: "INVALID_TEAM" }, { status: 400 });
  }
  if (eventId == null && teamId == null) {
    return jsonWrap({ ok: false, error: "MISSING_FILTER" }, { status: 400 });
  }

  if (eventId != null) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: organization.id, isDeleted: false },
      select: { id: true, templateType: true },
    });
    if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    if (event.templateType !== "PADEL") {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }
  }

  if (teamId != null) {
    const team = await prisma.padelTeam.findFirst({
      where: { id: teamId, organizationId: organization.id },
      select: { id: true },
    });
    if (!team) return jsonWrap({ ok: false, error: "TEAM_NOT_FOUND" }, { status: 404 });
  }

  const entries = await prisma.padelTeamEntry.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      ...(teamId ? { teamId } : {}),
      team: { organizationId: organization.id },
    },
    include: {
      team: { select: { id: true, name: true } },
      category: { select: { id: true, label: true } },
      event: { select: { id: true, title: true, startsAt: true, status: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return jsonWrap({ ok: true, items: entries }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: writeRoles,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const editPermission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!editPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const eventId = parsePositiveInt(body.eventId);
  const teamId = parsePositiveInt(body.teamId);
  const hasCategoryId = Object.prototype.hasOwnProperty.call(body, "categoryId");
  const categoryInput = hasCategoryId ? body.categoryId : null;
  const categoryId = categoryInput === null ? null : parsePositiveInt(categoryInput);

  if (eventId == null || teamId == null) {
    return jsonWrap({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (hasCategoryId && categoryInput !== null && categoryId == null) {
    return jsonWrap({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: organization.id, isDeleted: false },
    select: {
      id: true,
      templateType: true,
      padelTournamentConfig: { select: { isInterclub: true, teamSize: true } },
    },
  });
  if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  if (event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  if (!event.padelTournamentConfig?.isInterclub) {
    return jsonWrap({ ok: false, error: "INTERCLUB_DISABLED" }, { status: 409 });
  }

  const team = await prisma.padelTeam.findFirst({
    where: { id: teamId, organizationId: organization.id },
    select: { id: true },
  });
  if (!team) return jsonWrap({ ok: false, error: "TEAM_NOT_FOUND" }, { status: 404 });

  const requiredTeamSize = event.padelTournamentConfig?.teamSize ?? null;
  if (requiredTeamSize && requiredTeamSize > 0) {
    const membersCount = await prisma.padelTeamMember.count({
      where: { teamId: team.id, status: PadelTeamMemberStatus.ACTIVE },
    });
    if (membersCount < requiredTeamSize) {
      return jsonWrap({ ok: false, error: "TEAM_SIZE_NOT_MET" }, { status: 409 });
    }
  }

  const categoryIdValue = categoryId;
  if (categoryIdValue) {
    const link = await prisma.padelEventCategoryLink.findFirst({
      where: { eventId: event.id, padelCategoryId: categoryIdValue },
      select: { id: true },
    });
    if (!link) return jsonWrap({ ok: false, error: "CATEGORY_NOT_ALLOWED" }, { status: 409 });
  }

  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const status: PadelTeamEntryStatus = Object.values(PadelTeamEntryStatus).includes(
    statusRaw as PadelTeamEntryStatus,
  )
    ? (statusRaw as PadelTeamEntryStatus)
    : "PENDING";

  const existing = await prisma.padelTeamEntry.findFirst({
    where: { eventId: event.id, teamId: team.id, categoryId: categoryIdValue },
  });

  const entry = existing
    ? await prisma.padelTeamEntry.update({
        where: { id: existing.id },
        data: { status },
        include: {
          team: { select: { id: true, name: true } },
          category: { select: { id: true, label: true } },
          event: { select: { id: true, title: true } },
        },
      })
    : await prisma.padelTeamEntry.create({
        data: {
          eventId: event.id,
          teamId: team.id,
          categoryId: categoryIdValue,
          status,
        },
        include: {
          team: { select: { id: true, name: true } },
          category: { select: { id: true, label: true } },
          event: { select: { id: true, title: true } },
        },
      });

  return jsonWrap({ ok: true, item: entry }, { status: existing ? 200 : 201 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
