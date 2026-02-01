export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { OrganizationMemberRole, PadelTeamEntryStatus, PadelTeamMemberStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: readRoles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const eventIdRaw = req.nextUrl.searchParams.get("eventId");
  const teamIdRaw = req.nextUrl.searchParams.get("teamId");
  const eventId = eventIdRaw && Number.isFinite(Number(eventIdRaw)) ? Number(eventIdRaw) : null;
  const teamId = teamIdRaw && Number.isFinite(Number(teamIdRaw)) ? Number(teamIdRaw) : null;
  if (!eventId && !teamId) {
    return jsonWrap({ ok: false, error: "MISSING_FILTER" }, { status: 400 });
  }

  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: organization.id },
      select: { id: true },
    });
    if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  if (teamId) {
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
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: writeRoles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const eventId =
    typeof body.eventId === "number"
      ? body.eventId
      : typeof body.eventId === "string"
        ? Number(body.eventId)
        : null;
  const teamId =
    typeof body.teamId === "number"
      ? body.teamId
      : typeof body.teamId === "string"
        ? Number(body.teamId)
        : null;
  const categoryId =
    typeof body.categoryId === "number"
      ? body.categoryId
      : typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : null;

  if (!Number.isFinite(eventId ?? NaN) || !Number.isFinite(teamId ?? NaN)) {
    return jsonWrap({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId as number, organizationId: organization.id },
    select: {
      id: true,
      templateType: true,
      padelTournamentConfig: { select: { isInterclub: true, teamSize: true } },
    },
  });
  if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  if (event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_PADEL" }, { status: 409 });
  }
  if (!event.padelTournamentConfig?.isInterclub) {
    return jsonWrap({ ok: false, error: "INTERCLUB_DISABLED" }, { status: 409 });
  }

  const team = await prisma.padelTeam.findFirst({
    where: { id: teamId as number, organizationId: organization.id },
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

  const categoryIdValue = Number.isFinite(categoryId ?? NaN) ? (categoryId as number) : null;
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
