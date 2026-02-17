export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { autoGeneratePadelMatches } from "@/domain/padel/autoGenerateMatches";
import { syncPadelCompetitiveCore } from "@/domain/padel/competitiveCoreSync";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";
import { computePadelPlan } from "@/domain/padel/formatEngine/capacity";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";
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

async function _POST(req: NextRequest) {
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const categoryId = typeof body.categoryId === "number" ? body.categoryId : Number(body.categoryId);
  const phase = typeof body.phase === "string" ? body.phase.toUpperCase() : "GROUPS";
  const format = parsePadelFormat(body.format);
  const allowIncomplete = body.allowIncomplete === true;

  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  if (!format) return jsonWrap({ ok: false, error: "INVALID_FORMAT" }, { status: 400 });

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
  if (!event || !event.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const resolvedCategoryId = Number.isFinite(categoryId) ? categoryId : null;
  let categoryFormatOverride: string | null = null;
  if (resolvedCategoryId) {
    const link = await prisma.padelEventCategoryLink.findFirst({
      where: { eventId, padelCategoryId: resolvedCategoryId, isEnabled: true },
      select: { id: true, format: true },
    });
    if (!link) {
      return jsonWrap({ ok: false, error: "CATEGORY_NOT_AVAILABLE" }, { status: 400 });
    }
    categoryFormatOverride = typeof link.format === "string" ? link.format : null;
  }
  const matchCategoryFilter = resolvedCategoryId ? { categoryId: resolvedCategoryId } : {};

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const configAdvanced = (event.padelTournamentConfig?.advancedSettings as Record<string, unknown> | null) ?? {};
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
  const resolvedCourtSelection = await resolvePadelCourtSelection({
    db: prisma,
    organizationId: event.organizationId,
    padelClubId: event.padelTournamentConfig?.padelClubId ?? null,
    partnerClubIds: event.padelTournamentConfig?.partnerClubIds ?? [],
    advancedSettings: configAdvanced,
    requestedCourtIds,
    requestedCourtPriorityOrder,
  });

  const capacityPolicyRaw =
    configAdvanced.capacityPolicy && typeof configAdvanced.capacityPolicy === "object"
      ? (configAdvanced.capacityPolicy as Record<string, unknown>)
      : null;
  const shouldHardBlockGenerate = capacityPolicyRaw?.hardBlockGenerate !== false;
  if (shouldHardBlockGenerate) {
    const scheduleDefaultsRaw =
      configAdvanced.scheduleDefaults && typeof configAdvanced.scheduleDefaults === "object"
        ? (configAdvanced.scheduleDefaults as Record<string, unknown>)
        : {};
    const windowStart =
      parseDate(scheduleDefaultsRaw.windowStart) ??
      (event.startsAt ? new Date(event.startsAt) : null);
    const windowEnd =
      parseDate(scheduleDefaultsRaw.windowEnd) ??
      (event.endsAt ? new Date(event.endsAt) : null);

    if (windowStart && windowEnd && windowEnd > windowStart) {
      const durationMinutes =
        parseNumber(scheduleDefaultsRaw.durationMinutes) ??
        parseNumber(configAdvanced.gameDurationMinutes) ??
        60;
      const bufferMinutes = parseNumber(scheduleDefaultsRaw.bufferMinutes) ?? 5;
      const formatProfilesByCategoryRaw =
        configAdvanced.formatProfilesByCategory && typeof configAdvanced.formatProfilesByCategory === "object"
          ? (configAdvanced.formatProfilesByCategory as Record<string, unknown>)
          : null;
      const profileKey = resolvedCategoryId ? String(resolvedCategoryId) : "global";
      const categoryProfile =
        formatProfilesByCategoryRaw &&
        formatProfilesByCategoryRaw[profileKey] &&
        typeof formatProfilesByCategoryRaw[profileKey] === "object"
          ? (formatProfilesByCategoryRaw[profileKey] as Record<string, unknown>)
          : formatProfilesByCategoryRaw &&
              formatProfilesByCategoryRaw.global &&
              typeof formatProfilesByCategoryRaw.global === "object"
            ? (formatProfilesByCategoryRaw.global as Record<string, unknown>)
            : null;
      const resolvedAmMxProgressionMode =
        categoryProfile?.amMxProgressionMode === "ROUND_BY_ROUND" ? "ROUND_BY_ROUND" : undefined;
      const resolvedNonStopMode =
        categoryProfile?.nonStopMode === "ACTIVE_QUEUE" || categoryProfile?.nonStopMode === "HARD_CAP_WAITLIST"
          ? categoryProfile.nonStopMode
          : undefined;
      const resolvedNonStopRounds =
        parseNumber(categoryProfile?.nonStopRounds) ?? parseNumber(categoryProfile?.roundsHint);
      const confirmedTeams = await prisma.padelPairing.count({
        where: {
          eventId,
          pairingStatus: "COMPLETE",
          ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
        },
      });
      const effectiveFormat =
        typeof categoryProfile?.format === "string"
          ? categoryProfile.format
          : categoryFormatOverride
            ? categoryFormatOverride
            : format;
      const parsedEffectiveFormat = parsePadelFormat(effectiveFormat);

      const plan = computePadelPlan({
        format: parsedEffectiveFormat ?? effectiveFormat,
        categories: [
          {
            categoryId: resolvedCategoryId,
            teams: confirmedTeams,
            format: parsedEffectiveFormat ?? effectiveFormat,
            amMxMode:
              categoryProfile?.amMxMode === "FIXED_PAIR" || categoryProfile?.amMxMode === "INDIVIDUAL_ROTATION"
                ? (categoryProfile.amMxMode as "FIXED_PAIR" | "INDIVIDUAL_ROTATION")
                : undefined,
            amMxProgressionMode: resolvedAmMxProgressionMode,
            nonStopMode: resolvedNonStopMode as "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST" | undefined,
            nonStopRounds: resolvedNonStopRounds,
            roundsHint: parseNumber(categoryProfile?.roundsHint),
            groupCount: parseNumber(categoryProfile?.groupCount),
            groupSize: parseNumber(categoryProfile?.groupSize),
            qualifyPerGroup: parseNumber(categoryProfile?.qualifyPerGroup),
            extraQualifiers: parseNumber(categoryProfile?.extraQualifiers),
          },
        ],
        windowStart,
        windowEnd,
        durationMinutes,
        bufferMinutes,
        courtIds: resolvedCourtSelection.courtIds,
        courtsCount:
          parseNumber(event.padelTournamentConfig?.numberOfCourts) ??
          (resolvedCourtSelection.courts.length > 0 ? resolvedCourtSelection.courts.length : 1),
        categoryWeights:
          configAdvanced.categoryWeights && typeof configAdvanced.categoryWeights === "object"
            ? (configAdvanced.categoryWeights as Record<string, number>)
            : undefined,
      });

      if (!plan.feasible) {
        return jsonWrap(
          {
            ok: false,
            error: "GENERATION_PLAN_INFEASIBLE",
            reason: "Confirmed entries do not fit the configured format plan.",
            plan,
          },
          { status: 409 },
        );
      }
    }
  }

  const formatProfilesByCategoryRaw =
    configAdvanced.formatProfilesByCategory && typeof configAdvanced.formatProfilesByCategory === "object"
      ? (configAdvanced.formatProfilesByCategory as Record<string, unknown>)
      : null;
  const profileKey = resolvedCategoryId ? String(resolvedCategoryId) : "global";
  const categoryProfile =
    formatProfilesByCategoryRaw &&
    formatProfilesByCategoryRaw[profileKey] &&
    typeof formatProfilesByCategoryRaw[profileKey] === "object"
      ? (formatProfilesByCategoryRaw[profileKey] as Record<string, unknown>)
      : formatProfilesByCategoryRaw &&
          formatProfilesByCategoryRaw.global &&
          typeof formatProfilesByCategoryRaw.global === "object"
        ? (formatProfilesByCategoryRaw.global as Record<string, unknown>)
        : null;
  const effectiveFormatForGenerationRaw =
    typeof categoryProfile?.format === "string"
      ? categoryProfile.format
      : categoryFormatOverride
        ? categoryFormatOverride
        : format;
  const effectiveFormatForGeneration = parsePadelFormat(effectiveFormatForGenerationRaw) ?? format;
  const phaseNormalized = phase === "KNOCKOUT" ? "KNOCKOUT" : "GROUPS";
  const isGroupsFormat = effectiveFormatForGeneration === "GRUPOS_ELIMINATORIAS";
  const existingPolicy = isGroupsFormat ? "error" : "replace";
  const notifyUsers = !isGroupsFormat || phaseNormalized === "KNOCKOUT";

  if (isGroupsFormat && phaseNormalized === "KNOCKOUT" && allowIncomplete) {
    if (membership?.role && !["OWNER", "CO_OWNER"].includes(membership.role)) {
      return jsonWrap({ ok: false, error: "OVERRIDE_NOT_ALLOWED" }, { status: 403 });
    }
  }

  const result = await autoGeneratePadelMatches({
    eventId,
    categoryId: resolvedCategoryId ?? null,
    format: effectiveFormatForGeneration,
    phase: isGroupsFormat ? phaseNormalized : undefined,
    allowIncomplete,
    existingPolicy,
    notifyUsers,
    courtIds: resolvedCourtSelection.courtIds,
    courtPriorityOrder: resolvedCourtSelection.courtPriorityOrder,
    actorUserId: user.id,
    auditAction: "PADEL_MATCHES_GENERATED",
  });

  if (!result.ok) {
    if (result.error === "INTERCLUB_TEAM_ENGINE_REQUIRED") {
      return jsonWrap({ ok: false, error: result.error }, { status: 409 });
    }
    return jsonWrap({ ok: false, error: result.error ?? "GENERATION_FAILED" }, { status: 400 });
  }

  try {
    const syncResult = await syncPadelCompetitiveCore({
      eventId,
      categoryId: resolvedCategoryId ?? null,
    });
    if (!syncResult.ok) {
      console.warn("[padel/matches/generate] competitive core sync skipped", {
        eventId,
        categoryId: resolvedCategoryId ?? null,
      });
    }
  } catch (syncError) {
    console.warn("[padel/matches/generate] competitive core sync failed (non-blocking)", syncError);
  }

  if (isGroupsFormat && phaseNormalized !== "KNOCKOUT") {
    return jsonWrap(
      {
        ok: true,
        stage: "GROUPS",
        groups: result.groups ?? [],
        qualifyPerGroup: result.qualifyPerGroup ?? 2,
        extraQualifiers: result.extraQualifiers ?? 0,
        matches: result.matches ?? 0,
        formatEffective: result.formatEffective ?? format,
        generationVersion: result.generationVersion ?? "v1-groups-ko",
      },
      { status: 200 },
    );
  }

  if (isGroupsFormat && phaseNormalized === "KNOCKOUT") {
    return jsonWrap(
      {
        ok: true,
        stage: "KNOCKOUT",
        qualifiers: result.qualifiers ?? 0,
        matches: result.matches ?? 0,
        formatEffective: result.formatEffective ?? format,
        generationVersion: result.generationVersion ?? "v1-groups-ko",
        koGeneratedAt: result.koGeneratedAt ?? null,
        koSeedSnapshot: result.koSeedSnapshot ?? [],
      },
      { status: 200 },
    );
  }

  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId, ...matchCategoryFilter },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  return jsonWrap({ ok: true, matches }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
