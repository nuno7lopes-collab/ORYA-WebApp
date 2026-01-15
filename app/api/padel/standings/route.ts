import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { type PadelPointsTable } from "@/lib/padel/validation";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import {
  computePadelStandingsByGroup,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
} from "@/domain/padel/standings";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const eventId = Number(req.nextUrl.searchParams.get("eventId"));
    const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
    }
    const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

    const event = await prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: {
        organizationId: true,
        status: true,
        publicAccessMode: true,
        inviteOnly: true,
        padelTournamentConfig: { select: { ruleSetId: true, advancedSettings: true } },
      },
    });
    if (!event?.organizationId) {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const rateLimited = await enforcePublicRateLimit(req, {
      keyPrefix: "padel_standings",
      identifier: user?.id ?? String(eventId),
      max: 240,
    });
    if (rateLimited) return rateLimited;

    const competitionState = resolvePadelCompetitionState({
      eventStatus: event.status,
      competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    });
    const isPublicEvent =
      event.publicAccessMode !== "INVITE" &&
      !event.inviteOnly &&
      ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
      competitionState === "PUBLIC";

    if (!isPublicEvent) {
      const authUser = user ?? (await ensureAuthenticated(supabase));
      const { organization } = await getActiveOrganizationForUser(authUser.id, {
        organizationId: event.organizationId,
        roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
      });
      if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
    }

    const ruleSet = event.padelTournamentConfig?.ruleSetId
      ? await prisma.padelRuleSet.findUnique({
          where: { id: event.padelTournamentConfig.ruleSetId },
        })
      : null;
    const pointsTable: PadelPointsTable = normalizePadelPointsTable(ruleSet?.pointsTable);
    const tieBreakRules = normalizePadelTieBreakRules(ruleSet?.tieBreakRules);

    const matches = await prisma.padelMatch.findMany({
      where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
      select: {
        id: true,
        pairingAId: true,
        pairingBId: true,
        scoreSets: true,
        score: true,
        groupLabel: true,
        status: true,
      },
    });
    const standingsByGroup = computePadelStandingsByGroup(matches, pointsTable, tieBreakRules);
    const standings = Object.fromEntries(
      Object.entries(standingsByGroup).map(([label, rows]) => [
        label,
        rows.map((row) => ({
          pairingId: row.pairingId,
          points: row.points,
          wins: row.wins,
          losses: row.losses,
          setsFor: row.setsFor,
          setsAgainst: row.setsAgainst,
        })),
      ]),
    );

    return NextResponse.json({ ok: true, standings });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[padel/standings] error", err);
    return NextResponse.json({ ok: false, error: "Erro ao gerar standings." }, { status: 500 });
  }
}
