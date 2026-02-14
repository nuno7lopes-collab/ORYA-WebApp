import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { getAgendaItemsForOrganization } from "@/domain/agendaReadModel/query";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { resolveReservasScopesForMember, resolveTrainerProfessionalIds, intersectIds } from "@/lib/reservas/memberScopes";

async function _GET(req: NextRequest) {
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const padelClubParam = url.searchParams.get("padelClubId");
  const courtParam = url.searchParams.get("courtId");
  if (!fromParam || !toParam) {
    return jsonWrap({ ok: false, error: "MISSING_RANGE" }, { status: 400 });
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return jsonWrap({ ok: false, error: "INVALID_RANGE" }, { status: 400 });
  }
  const padelClubId = padelClubParam ? Number(padelClubParam) : null;
  const courtId = courtParam ? Number(courtParam) : null;
  if (padelClubParam && !Number.isFinite(padelClubId)) {
    return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });
  }
  if (courtParam && !Number.isFinite(courtId)) {
    return jsonWrap({ ok: false, error: "INVALID_COURT" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF", "TRAINER"],
  });
  if (!organization || !membership) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const reservasAccess = await ensureReservasModuleAccess(organization);
  if (!reservasAccess.ok) {
    return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
  }

  const tournamentsAccess = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  const eventsAccess = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.EVENTOS,
    required: "VIEW",
  });
  if (!tournamentsAccess.ok && !eventsAccess.ok) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const now = new Date();
  const limitEnd = new Date(Date.UTC(now.getUTCFullYear() + 2, 11, 31, 23, 59, 59, 999));
  const boundedTo = to.getTime() > limitEnd.getTime() ? limitEnd : to;
  if (from.getTime() > boundedTo.getTime()) {
    return jsonWrap({ ok: true, items: [] }, { status: 200 });
  }

  let resolvedClubId: number | null = padelClubId && Number.isFinite(padelClubId) ? padelClubId : null;
  const resolvedCourtId: number | null = courtId && Number.isFinite(courtId) ? courtId : null;
  if (resolvedClubId) {
    const club = await prisma.padelClub.findFirst({
      where: { id: resolvedClubId, organizationId: organization.id, deletedAt: null },
      select: { id: true },
    });
    if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });
  }
  if (resolvedCourtId) {
    const court = await prisma.padelClubCourt.findFirst({
      where: { id: resolvedCourtId, club: { organizationId: organization.id, deletedAt: null } },
      select: { id: true, padelClubId: true },
    });
    if (!court) return jsonWrap({ ok: false, error: "COURT_NOT_FOUND" }, { status: 404 });
    if (resolvedClubId && court.padelClubId !== resolvedClubId) {
      return jsonWrap({ ok: false, error: "COURT_CLUB_MISMATCH" }, { status: 400 });
    }
    if (!resolvedClubId) {
      resolvedClubId = court.padelClubId;
    }
  }

  let scopeFilter: { courtIds?: number[]; resourceIds?: number[]; professionalIds?: number[] } | null = null;
  let scopeMode: "OR" | "AND" = "OR";
  if (membership.role === OrganizationMemberRole.STAFF || membership.role === OrganizationMemberRole.TRAINER) {
    const scopes = await resolveReservasScopesForMember({
      organizationId: organization.id,
      userId: user.id,
    });
    if (!scopes.hasAny) {
      return jsonWrap({ ok: true, items: [] }, { status: 200 });
    }
    if (membership.role === OrganizationMemberRole.TRAINER) {
      const trainerProfessionalIds = await resolveTrainerProfessionalIds({
        organizationId: organization.id,
        userId: user.id,
      });
      if (trainerProfessionalIds.length === 0) {
        return jsonWrap({ ok: true, items: [] }, { status: 200 });
      }
      scopeFilter = {
        courtIds: scopes.courtIds,
        resourceIds: scopes.resourceIds,
        professionalIds: intersectIds(trainerProfessionalIds, scopes.professionalIds),
      };
      scopeMode = "AND";
    } else {
      scopeFilter = {
        courtIds: scopes.courtIds,
        resourceIds: scopes.resourceIds,
        professionalIds: scopes.professionalIds,
      };
    }
  }

  const items = await getAgendaItemsForOrganization({
    organizationId: organization.id,
    from,
    to: boundedTo,
    padelClubId: resolvedClubId,
    courtId: resolvedCourtId,
    scopeFilter,
    scopeMode,
  });
  return jsonWrap({ ok: true, items }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
