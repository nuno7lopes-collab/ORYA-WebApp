export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { computePadelPlan } from "@/domain/padel/formatEngine/capacity";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolvePadelCourtSelection } from "@/domain/padel/courtSelection";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseAmMxProgressionMode = (value: unknown): "ROUND_BY_ROUND" | undefined =>
  value === "ROUND_BY_ROUND" ? "ROUND_BY_ROUND" : undefined;

const parseNonStopMode = (value: unknown): "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST" | undefined =>
  value === "ACTIVE_QUEUE" || value === "HARD_CAP_WAITLIST" ? value : undefined;

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventIdRaw = parseNumber(body.eventId);
  const eventId = eventIdRaw && eventIdRaw > 0 ? Math.floor(eventIdRaw) : null;
  const organizationIdRaw = parseNumber(body.organizationId);
  const organizationId = organizationIdRaw && organizationIdRaw > 0 ? Math.floor(organizationIdRaw) : null;

  let resolvedOrganizationId: number | null = null;
  let eventDefaults:
    | {
        startsAt: Date | null;
        endsAt: Date | null;
        format: string | null;
        numberOfCourts: number | null;
      advancedSettings: Record<string, unknown>;
      padelClubId: number | null;
      partnerClubIds: number[];
    }
    | null = null;

  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: {
        id: true,
        organizationId: true,
        startsAt: true,
        endsAt: true,
        padelTournamentConfig: {
          select: {
            format: true,
            numberOfCourts: true,
            advancedSettings: true,
            padelClubId: true,
            partnerClubIds: true,
          },
        },
      },
    });
    if (!event?.organizationId) {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }
    resolvedOrganizationId = event.organizationId;
    eventDefaults = {
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      format: event.padelTournamentConfig?.format ?? null,
      numberOfCourts: event.padelTournamentConfig?.numberOfCourts ?? null,
      advancedSettings: ((event.padelTournamentConfig?.advancedSettings as Record<string, unknown> | null) ?? {}),
      padelClubId: event.padelTournamentConfig?.padelClubId ?? null,
      partnerClubIds: event.padelTournamentConfig?.partnerClubIds ?? [],
    };
  } else if (organizationId) {
    resolvedOrganizationId = organizationId;
  }

  if (!resolvedOrganizationId) {
    return jsonWrap({ ok: false, error: "ORGANIZATION_OR_EVENT_REQUIRED" }, { status: 400 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: resolvedOrganizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const permission = await ensureMemberModuleAccess({
    organizationId: resolvedOrganizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const advanced = eventDefaults?.advancedSettings ?? {};
  const scheduleDefaults = (advanced.scheduleDefaults ?? {}) as Record<string, unknown>;

  const windowStart =
    parseDate(body.windowStart ?? body.startAt) ??
    parseDate(scheduleDefaults.windowStart) ??
    eventDefaults?.startsAt ??
    null;
  const windowEnd =
    parseDate(body.windowEnd ?? body.endAt) ??
    parseDate(scheduleDefaults.windowEnd) ??
    eventDefaults?.endsAt ??
    null;

  if (!windowStart || !windowEnd || windowEnd <= windowStart) {
    return jsonWrap({ ok: false, error: "INVALID_WINDOW" }, { status: 400 });
  }

  const durationMinutes =
    parseNumber(body.durationMinutes) ??
    parseNumber(scheduleDefaults.durationMinutes) ??
    parseNumber(advanced.gameDurationMinutes) ??
    60;
  const bufferMinutes = parseNumber(body.bufferMinutes) ?? parseNumber(scheduleDefaults.bufferMinutes) ?? 5;

  const requestedCourtIds = Array.isArray(body.courtIds)
    ? body.courtIds
        .map((value) => parseNumber(value))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    : [];
  const requestedCourtPriorityOrder = Array.isArray(body.courtPriorityOrder)
    ? body.courtPriorityOrder
        .map((value) => parseNumber(value))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    : [];

  const courtSelection = await resolvePadelCourtSelection({
    db: prisma,
    organizationId: resolvedOrganizationId,
    padelClubId: eventDefaults?.padelClubId ?? null,
    partnerClubIds: eventDefaults?.partnerClubIds ?? [],
    advancedSettings: advanced,
    requestedCourtIds,
    requestedCourtPriorityOrder,
  });
  const courtIds = courtSelection.courtIds;

  const categories = Array.isArray(body.categories)
    ? body.categories
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry, idx) => {
          const categoryIdRaw = parseNumber(entry.categoryId);
          const teamsRaw = parseNumber(entry.teams);
          const categoryId =
            typeof categoryIdRaw === "number" && Number.isFinite(categoryIdRaw) && categoryIdRaw > 0
              ? Math.floor(categoryIdRaw)
              : null;
          const key = categoryId != null ? String(categoryId) : `category:${idx + 1}`;
          const profilesByCategory =
            advanced.formatProfilesByCategory && typeof advanced.formatProfilesByCategory === "object"
              ? (advanced.formatProfilesByCategory as Record<string, unknown>)
              : null;
          const profileForCategory =
            profilesByCategory && profilesByCategory[key] && typeof profilesByCategory[key] === "object"
              ? (profilesByCategory[key] as Record<string, unknown>)
              : profilesByCategory && profilesByCategory.global && typeof profilesByCategory.global === "object"
                ? (profilesByCategory.global as Record<string, unknown>)
                : null;

          return {
            categoryId,
            label: typeof entry.label === "string" ? entry.label : null,
            teams: Math.max(0, Math.floor(teamsRaw ?? 0)),
            format:
              typeof entry.format === "string"
                ? entry.format
                : typeof profileForCategory?.format === "string"
                  ? profileForCategory.format
                  : undefined,
            amMxMode:
              entry.amMxMode === "FIXED_PAIR" || entry.amMxMode === "INDIVIDUAL_ROTATION"
                ? entry.amMxMode
                : profileForCategory?.amMxMode === "FIXED_PAIR" || profileForCategory?.amMxMode === "INDIVIDUAL_ROTATION"
                  ? (profileForCategory.amMxMode as "FIXED_PAIR" | "INDIVIDUAL_ROTATION")
                  : undefined,
            amMxProgressionMode:
              parseAmMxProgressionMode(entry.amMxProgressionMode) ??
              parseAmMxProgressionMode(profileForCategory?.amMxProgressionMode),
            nonStopMode: parseNonStopMode(entry.nonStopMode) ?? parseNonStopMode(profileForCategory?.nonStopMode),
            nonStopRounds: parseNumber(entry.nonStopRounds ?? profileForCategory?.nonStopRounds),
            nonStopQueueRules:
              entry.nonStopQueueRules && typeof entry.nonStopQueueRules === "object"
                ? (entry.nonStopQueueRules as Record<string, unknown>)
                : profileForCategory?.nonStopQueueRules && typeof profileForCategory.nonStopQueueRules === "object"
                  ? (profileForCategory.nonStopQueueRules as Record<string, unknown>)
                  : undefined,
            roundsHint: parseNumber(entry.roundsHint),
            groupCount: parseNumber(entry.groupCount),
            groupSize: parseNumber(entry.groupSize),
            qualifyPerGroup: parseNumber(entry.qualifyPerGroup),
            extraQualifiers: parseNumber(entry.extraQualifiers),
          };
        })
    : undefined;

  const categoryWeightsRaw =
    body.categoryWeights && typeof body.categoryWeights === "object" && !Array.isArray(body.categoryWeights)
      ? (body.categoryWeights as Record<string, unknown>)
      : advanced.categoryWeights && typeof advanced.categoryWeights === "object" && !Array.isArray(advanced.categoryWeights)
        ? (advanced.categoryWeights as Record<string, unknown>)
        : null;

  const categoryWeights = categoryWeightsRaw
    ? Object.entries(categoryWeightsRaw).reduce<Record<string, number>>((acc, [key, value]) => {
        const parsed = parseNumber(value);
        if (parsed && parsed > 0) acc[key] = parsed;
        return acc;
      }, {})
    : undefined;

  const plan = computePadelPlan({
    format:
      typeof body.format === "string"
        ? body.format
        : eventDefaults?.format
          ? eventDefaults.format
          : "TODOS_CONTRA_TODOS",
    categories,
    teams: parseNumber(body.teams),
    windowStart,
    windowEnd,
    durationMinutes,
    bufferMinutes,
    courtIds,
    courtsCount:
      parseNumber(body.courtsCount) ?? (courtSelection.courts.length > 0 ? courtSelection.courts.length : eventDefaults?.numberOfCourts ?? null),
    categoryWeights,
    roundsHint: parseNumber(body.roundsHint),
    groupCount: parseNumber(body.groupCount),
    groupSize: parseNumber(body.groupSize),
    qualifyPerGroup: parseNumber(body.qualifyPerGroup),
    extraQualifiers: parseNumber(body.extraQualifiers),
  });

  return jsonWrap(
    {
      ok: true,
      plan,
      defaults: {
        eventId,
        organizationId: resolvedOrganizationId,
        courtIds,
        courtPriorityOrder: courtSelection.courtPriorityOrder,
        courtSelectionSource: courtSelection.source,
      },
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
