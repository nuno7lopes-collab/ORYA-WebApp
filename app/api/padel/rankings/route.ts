export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  applyInactivityToVisual,
  computeVisualLevel,
  rebuildPadelRatingsForEvent,
} from "@/domain/padel/ratingEngine";

const DEFAULT_LIMIT = 50;
const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const clampLimit = (raw: string | null) => {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 200);
};

async function ensureUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function _GET(req: NextRequest) {
  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_rankings",
    max: 120,
  });
  if (rateLimited) return rateLimited;

  const organizationId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const eventId = req.nextUrl.searchParams.get("eventId");
  const scope = (req.nextUrl.searchParams.get("scope") || "global").toLowerCase();
  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
  const periodDaysRaw = Number(req.nextUrl.searchParams.get("periodDays"));
  const periodDays = Number.isFinite(periodDaysRaw) && periodDaysRaw > 0 ? Math.floor(periodDaysRaw) : null;
  const since = periodDays ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;

  if (eventId) {
    const eId = Number(eventId);
    if (!Number.isFinite(eId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

    const event = await prisma.event.findUnique({
      where: { id: eId, isDeleted: false },
      select: {
        status: true,
        padelTournamentConfig: { select: { advancedSettings: true, lifecycleStatus: true } },
        accessPolicies: {
          orderBy: { policyVersion: "desc" },
          take: 1,
          select: { mode: true },
        },
      },
    });
    if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

    const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
    const competitionState = resolvePadelCompetitionState({
      eventStatus: event.status,
      competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
      lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
    });
    const isPublicEvent =
      isPublicAccessMode(accessMode) &&
      ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
      competitionState === "PUBLIC";
    if (!isPublicEvent) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const entries = await prisma.padelRankingEntry.findMany({
      where: {
        eventId: eId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      include: { player: true },
      orderBy: [{ points: "desc" }, { playerId: "asc" }],
      take: limit,
    });

    const items = entries.map((row, idx) => ({
      position: idx + 1,
      points: row.points,
      rating: row.points,
      player: {
        id: row.player.id,
        fullName: row.player.fullName,
        level: row.level ?? row.player.level,
      },
    }));

    return jsonWrap({ ok: true, items }, { status: 200 });
  }

  if (scope === "organization") {
    const user = await ensureUser();
    if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    if (!organizationId) return jsonWrap({ ok: false, error: "MISSING_ORGANIZATION" }, { status: 400 });

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const leader = await prisma.padelRatingProfile.aggregate({ _max: { rating: true } });
    const leaderRating = leader._max.rating ?? 1200;

    const profiles = await prisma.padelRatingProfile.findMany({
      where: {
        organizationId,
        ...(since ? { lastActivityAt: { gte: since } } : {}),
      },
      include: {
        player: {
          select: { id: true, fullName: true, level: true },
        },
      },
      orderBy: [{ rating: "desc" }, { playerId: "asc" }],
      take: limit,
    });

    const items = profiles.map((profile, idx) => {
      const computed = computeVisualLevel(profile.rating, leaderRating);
      const drifted = applyInactivityToVisual(computed, profile.lastActivityAt ?? null);
      return {
        position: idx + 1,
        points: Math.round(profile.rating),
        rating: profile.rating,
        rd: profile.rd,
        sigma: profile.sigma,
        player: {
          id: profile.player.id,
          fullName: profile.player.fullName,
          level: drifted.toFixed(2),
        },
      };
    });

    return jsonWrap({ ok: true, items }, { status: 200 });
  }

  const leader = await prisma.padelRatingProfile.aggregate({ _max: { rating: true } });
  const leaderRating = leader._max.rating ?? 1200;

  const profiles = await prisma.padelRatingProfile.findMany({
    where: {
      ...(since ? { lastActivityAt: { gte: since } } : {}),
      leaderboardEligible: true,
    },
    include: {
      player: {
        select: { id: true, fullName: true, level: true },
      },
    },
    orderBy: [{ rating: "desc" }, { playerId: "asc" }],
    take: limit,
  });

  const items = profiles.map((profile, idx) => {
    const computed = computeVisualLevel(profile.rating, leaderRating);
    const drifted = applyInactivityToVisual(computed, profile.lastActivityAt ?? null);
    return {
      position: idx + 1,
      points: Math.round(profile.rating),
      rating: profile.rating,
      rd: profile.rd,
      sigma: profile.sigma,
      player: {
        id: profile.player.id,
        fullName: profile.player.fullName,
        level: drifted.toFixed(2),
      },
    };
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const user = await ensureUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true },
  });
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  const organizationId = event.organizationId;

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const permission = await ensureMemberModuleAccess({
    organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const tier = typeof body.tier === "string" ? body.tier : null;

  const result = await prisma.$transaction(async (tx) => {
    return rebuildPadelRatingsForEvent({
      tx,
      organizationId,
      eventId: event.id,
      actorUserId: user.id,
      tier,
    });
  });

  return jsonWrap({ ok: true, result }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
