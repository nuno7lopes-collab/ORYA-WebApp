export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  OrganizationMemberRole,
  OrganizationModule,
  PadelEligibilityType,
  PadelRegistrationStatus,
  Prisma,
  TournamentFormat,
  padel_format,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { normalizePadelScoreRules, type PadelScoreRules } from "@/domain/padel/score";
import { ensurePadelRuleSetVersion } from "@/domain/padel/ruleSetSnapshot";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createTournamentForEvent, updateTournament } from "@/domain/tournaments/commands";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const TOURNAMENT_CONFIG_SELECT = {
  id: true,
  eventId: true,
  organizationId: true,
  format: true,
  numberOfCourts: true,
  ruleSetId: true,
  ruleSetVersionId: true,
  defaultCategoryId: true,
  enabledFormats: true,
  isInterclub: true,
  teamSize: true,
  createdAt: true,
  updatedAt: true,
  padelV2Enabled: true,
  splitDeadlineHours: true,
  padelClubId: true,
  partnerClubIds: true,
  advancedSettings: true,
  lifecycleStatus: true,
  publishedAt: true,
  lockedAt: true,
  liveAt: true,
  completedAt: true,
  cancelledAt: true,
  lifecycleUpdatedAt: true,
  eligibilityType: true,
  ruleSet: {
    select: {
      id: true,
      organizationId: true,
      name: true,
      tieBreakRules: true,
      pointsTable: true,
      enabledFormats: true,
      season: true,
      year: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  ruleSetVersion: {
    select: {
      id: true,
      tournamentConfigId: true,
      version: true,
      sourceRuleSetId: true,
      name: true,
      tieBreakRules: true,
      pointsTable: true,
      enabledFormats: true,
      season: true,
      year: true,
      createdAt: true,
      createdByUserId: true,
    },
  },
  category: {
    select: {
      id: true,
      label: true,
      genderRestriction: true,
      minLevel: true,
      maxLevel: true,
      isDefault: true,
      isActive: true,
      season: true,
      year: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.PadelTournamentConfigSelect;

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  // Garantir que o requester tem permissão no organization deste evento
  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true },
  });
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const viewPermission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!viewPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const [initialConfig, tournament] = await Promise.all([
    prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      select: TOURNAMENT_CONFIG_SELECT,
    }),
    prisma.tournament.findUnique({
      where: { eventId },
      select: { generatedAt: true, generatedByUserId: true },
    }),
  ]);
  let config = initialConfig;

  if (config?.ruleSetId && !config.ruleSetVersionId) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.padelTournamentConfig.findUnique({
        where: { id: config!.id },
        select: { id: true, ruleSetId: true, ruleSetVersionId: true },
      });
      if (!fresh?.ruleSetId || fresh.ruleSetVersionId) return;
      const version = await ensurePadelRuleSetVersion({
        tx,
        tournamentConfigId: fresh.id,
        ruleSetId: fresh.ruleSetId,
        actorUserId: user.id,
      });
      await tx.padelTournamentConfig.update({
        where: { id: fresh.id },
        data: { ruleSetVersionId: version.id },
      });
    });
    config = await prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      select: TOURNAMENT_CONFIG_SELECT,
    });
  }

  return jsonWrap(
    {
      ok: true,
      config: config
        ? {
            ...config,
            organizationId: config.organizationId,
          }
        : null,
      tournament: tournament
        ? {
            generatedAt: tournament.generatedAt,
            generatedByUserId: tournament.generatedByUserId,
          }
        : null,
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const organizationIdBody = parseOrganizationId(body.organizationId);
  const hasFormat = Object.prototype.hasOwnProperty.call(body, "format");
  const hasIsInterclub = Object.prototype.hasOwnProperty.call(body, "isInterclub");
  const isInterclub = typeof body.isInterclub === "boolean" ? body.isInterclub : null;
  if (hasIsInterclub && typeof body.isInterclub !== "boolean") {
    return jsonWrap({ ok: false, error: "INVALID_INTERCLUB" }, { status: 400 });
  }
  const hasTeamSize = Object.prototype.hasOwnProperty.call(body, "teamSize");
  const teamSizeRaw =
    typeof body.teamSize === "number"
      ? body.teamSize
      : typeof body.teamSize === "string"
        ? Number(body.teamSize)
        : null;
  const teamSizeParsed =
    hasTeamSize && Number.isFinite(teamSizeRaw as number) ? Math.floor(teamSizeRaw as number) : null;
  if (hasTeamSize && (!teamSizeParsed || teamSizeParsed < 2)) {
    return jsonWrap({ ok: false, error: "INVALID_TEAM_SIZE" }, { status: 400 });
  }
  const format =
    hasFormat && typeof body.format === "string" && Object.values(padel_format).includes(body.format as padel_format)
      ? (body.format as padel_format)
      : null;
  const confirmFormatChange = body?.confirmFormatChange === true;
  const hasNumberOfCourts = Object.prototype.hasOwnProperty.call(body, "numberOfCourts");
  const numberOfCourtsRaw =
    hasNumberOfCourts && (typeof body.numberOfCourts === "number" || typeof body.numberOfCourts === "string")
      ? Number(body.numberOfCourts)
      : null;
  const numberOfCourtsParsed =
    hasNumberOfCourts && typeof numberOfCourtsRaw === "number" && Number.isFinite(numberOfCourtsRaw)
      ? Math.max(1, Math.floor(numberOfCourtsRaw))
      : null;
  const hasRuleSetId = Object.prototype.hasOwnProperty.call(body, "ruleSetId");
  const ruleSetIdRaw =
    hasRuleSetId && (typeof body.ruleSetId === "number" || typeof body.ruleSetId === "string")
      ? Number(body.ruleSetId)
      : null;
  const ruleSetId =
    hasRuleSetId && typeof ruleSetIdRaw === "number" && Number.isFinite(ruleSetIdRaw)
      ? Math.floor(ruleSetIdRaw)
      : null;
  const hasDefaultCategoryId = Object.prototype.hasOwnProperty.call(body, "defaultCategoryId");
  const defaultCategoryRaw =
    hasDefaultCategoryId &&
    (typeof body.defaultCategoryId === "number" || typeof body.defaultCategoryId === "string")
      ? Number(body.defaultCategoryId)
      : null;
  const defaultCategoryId =
    hasDefaultCategoryId && typeof defaultCategoryRaw === "number" && Number.isFinite(defaultCategoryRaw)
      ? Math.floor(defaultCategoryRaw)
      : null;
  const hasEligibilityType = Object.prototype.hasOwnProperty.call(body, "eligibilityType");
  const eligibilityType =
    hasEligibilityType &&
    typeof body.eligibilityType === "string" &&
    Object.values(PadelEligibilityType).includes(body.eligibilityType as PadelEligibilityType)
      ? (body.eligibilityType as PadelEligibilityType)
      : null;
  const hasSplitDeadlineHours = Object.prototype.hasOwnProperty.call(body, "splitDeadlineHours");
  const splitDeadlineHours =
    hasSplitDeadlineHours && typeof body.splitDeadlineHours === "number" && Number.isFinite(body.splitDeadlineHours)
      ? Math.max(48, Math.min(168, Math.floor(body.splitDeadlineHours)))
      : null;
  const hasEnabledFormats = Object.prototype.hasOwnProperty.call(body, "enabledFormats");
  const enabledFormats = hasEnabledFormats && Array.isArray(body.enabledFormats)
    ? (body.enabledFormats as unknown[]).map((f) => String(f))
    : null;
  const groupsBody = body.groups && typeof body.groups === "object" ? (body.groups as Record<string, unknown>) : null;
  const hasManualAssignments =
    groupsBody && Object.prototype.hasOwnProperty.call(groupsBody, "manualAssignments");
  let manualAssignments: Record<string, string> | null | undefined = undefined;
  if (hasManualAssignments) {
    if (groupsBody?.manualAssignments && typeof groupsBody.manualAssignments === "object") {
      manualAssignments = Object.entries(groupsBody.manualAssignments as Record<string, unknown>).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          const label = typeof value === "string" ? value.trim().toUpperCase() : "";
          if (/^[A-Z]$/.test(label)) acc[String(key)] = label;
          return acc;
        },
        {},
      );
    } else {
      manualAssignments = null;
    }
  }
  const groupsConfig = groupsBody
    ? {
        mode: groupsBody.mode === "MANUAL" ? "MANUAL" : "AUTO",
        groupCount: Number(groupsBody.groupCount),
        groupSize: Number(groupsBody.groupSize),
        qualifyPerGroup: Number(groupsBody.qualifyPerGroup),
        seeding: groupsBody.seeding === "NONE" ? "NONE" : "SNAKE",
        extraQualifiers: Number.isFinite(Number(groupsBody.extraQualifiers))
          ? Math.max(0, Math.floor(Number(groupsBody.extraQualifiers)))
          : null,
        ...(manualAssignments !== undefined ? { manualAssignments } : {}),
      }
    : null;
  const hasWaitlistEnabled = Object.prototype.hasOwnProperty.call(body, "waitlistEnabled");
  const waitlistEnabled =
    hasWaitlistEnabled && typeof body.waitlistEnabled === "boolean"
      ? body.waitlistEnabled
      : hasWaitlistEnabled
        ? null
        : undefined;
  const hasRegistrationStartsAt = Object.prototype.hasOwnProperty.call(body, "registrationStartsAt");
  const registrationStartsAtRaw = hasRegistrationStartsAt
    ? typeof body.registrationStartsAt === "string"
      ? body.registrationStartsAt
      : null
    : undefined;
  const hasRegistrationEndsAt = Object.prototype.hasOwnProperty.call(body, "registrationEndsAt");
  const registrationEndsAtRaw = hasRegistrationEndsAt
    ? typeof body.registrationEndsAt === "string"
      ? body.registrationEndsAt
      : null
    : undefined;
  const registrationStartsAt =
    registrationStartsAtRaw === undefined
      ? undefined
      : registrationStartsAtRaw && !Number.isNaN(new Date(registrationStartsAtRaw).getTime())
        ? new Date(registrationStartsAtRaw).toISOString()
        : null;
  const registrationEndsAt =
    registrationEndsAtRaw === undefined
      ? undefined
      : registrationEndsAtRaw && !Number.isNaN(new Date(registrationEndsAtRaw).getTime())
        ? new Date(registrationEndsAtRaw).toISOString()
        : null;
  const hasAllowSecondCategory = Object.prototype.hasOwnProperty.call(body, "allowSecondCategory");
  const allowSecondCategory =
    hasAllowSecondCategory && typeof body.allowSecondCategory === "boolean"
      ? body.allowSecondCategory
      : hasAllowSecondCategory
        ? null
        : undefined;
  const hasMaxEntriesTotal = Object.prototype.hasOwnProperty.call(body, "maxEntriesTotal");
  let maxEntriesTotal: number | null | undefined = undefined;
  if (hasMaxEntriesTotal) {
    const raw =
      typeof body.maxEntriesTotal === "number"
        ? body.maxEntriesTotal
        : typeof body.maxEntriesTotal === "string"
          ? Number(body.maxEntriesTotal)
          : null;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      maxEntriesTotal = Math.floor(raw);
    } else {
      maxEntriesTotal = null;
    }
  }
  const hasCompetitionState = Object.prototype.hasOwnProperty.call(body, "competitionState");
  const competitionStateRaw = hasCompetitionState && typeof body.competitionState === "string" ? body.competitionState : null;
  const competitionState =
    hasCompetitionState && ["HIDDEN", "DEVELOPMENT", "PUBLIC", "CANCELLED"].includes(competitionStateRaw ?? "")
      ? competitionStateRaw
      : hasCompetitionState
        ? null
        : undefined;
  const hasSeedRanks = Object.prototype.hasOwnProperty.call(body, "seedRanks");
  let seedRanks: Record<string, number> | null | undefined = undefined;
  if (hasSeedRanks) {
    if (body.seedRanks && typeof body.seedRanks === "object") {
      seedRanks = Object.entries(body.seedRanks as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, value]) => {
        const parsed = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          acc[key] = Math.round(parsed);
        }
        return acc;
      }, {});
    } else {
      seedRanks = null;
    }
  }
  const hasScheduleDefaults = Object.prototype.hasOwnProperty.call(body, "scheduleDefaults");
  let scheduleDefaults:
    | {
        windowStart: string | null;
        windowEnd: string | null;
        durationMinutes: number | null;
        slotMinutes: number | null;
        bufferMinutes: number | null;
        minRestMinutes: number | null;
        priority: "GROUPS_FIRST" | "KNOCKOUT_FIRST" | null;
      }
    | null
    | undefined = undefined;
  if (hasScheduleDefaults) {
    if (body.scheduleDefaults && typeof body.scheduleDefaults === "object") {
      const payload = body.scheduleDefaults as Record<string, unknown>;
      const windowStartRaw = typeof payload.windowStart === "string" ? payload.windowStart : null;
      const windowEndRaw = typeof payload.windowEnd === "string" ? payload.windowEnd : null;
      const durationRaw = typeof payload.durationMinutes === "number" ? payload.durationMinutes : Number(payload.durationMinutes);
      const slotRaw = typeof payload.slotMinutes === "number" ? payload.slotMinutes : Number(payload.slotMinutes);
      const bufferRaw = typeof payload.bufferMinutes === "number" ? payload.bufferMinutes : Number(payload.bufferMinutes);
      const restRaw = typeof payload.minRestMinutes === "number" ? payload.minRestMinutes : Number(payload.minRestMinutes);
      const priorityRaw = typeof payload.priority === "string" ? payload.priority : null;

      scheduleDefaults = {
        windowStart:
          windowStartRaw && !Number.isNaN(new Date(windowStartRaw).getTime()) ? windowStartRaw : null,
        windowEnd: windowEndRaw && !Number.isNaN(new Date(windowEndRaw).getTime()) ? windowEndRaw : null,
        durationMinutes: Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : null,
        slotMinutes: Number.isFinite(slotRaw) && slotRaw > 0 ? Math.round(slotRaw) : null,
        bufferMinutes: Number.isFinite(bufferRaw) && bufferRaw >= 0 ? Math.round(bufferRaw) : null,
        minRestMinutes: Number.isFinite(restRaw) && restRaw >= 0 ? Math.round(restRaw) : null,
        priority: priorityRaw === "KNOCKOUT_FIRST" || priorityRaw === "GROUPS_FIRST" ? priorityRaw : null,
      };
    } else {
      scheduleDefaults = null;
    }
  }
  const hasTemplateId = Object.prototype.hasOwnProperty.call(body, "templateId");
  const templateId =
    hasTemplateId && typeof body.templateId === "string"
      ? body.templateId.trim() || null
      : hasTemplateId
        ? null
        : undefined;
  const hasTvMonitor = Object.prototype.hasOwnProperty.call(body, "tvMonitor");
  let tvMonitor:
    | {
        footerText: string | null;
        sponsors: string[];
      }
    | null
    | undefined = undefined;
  if (hasTvMonitor) {
    if (body.tvMonitor && typeof body.tvMonitor === "object") {
      const payload = body.tvMonitor as Record<string, unknown>;
      const footerRaw = typeof payload.footerText === "string" ? payload.footerText.trim() : "";
      const sponsorsRaw = Array.isArray(payload.sponsors)
        ? (payload.sponsors as string[])
        : typeof payload.sponsors === "string"
          ? payload.sponsors.split(/[\n,;]/g)
          : [];
      const sponsors = sponsorsRaw.map((s) => s.trim()).filter(Boolean);
      tvMonitor = {
        footerText: footerRaw || null,
        sponsors,
      };
    } else {
      tvMonitor = null;
    }
  }
  const hasScoreRules = Object.prototype.hasOwnProperty.call(body, "scoreRules");
  let scoreRules: PadelScoreRules | null | undefined = undefined;
  if (hasScoreRules) {
    if (body.scoreRules === null) {
      scoreRules = null;
    } else {
      scoreRules = normalizePadelScoreRules(body.scoreRules);
      if (!scoreRules) {
        return jsonWrap({ ok: false, error: "INVALID_SCORE_RULES" }, { status: 400 });
      }
    }
  }

  const hasFeaturedMatchId = Object.prototype.hasOwnProperty.call(body, "featuredMatchId");
  let featuredMatchId: number | null | undefined = undefined;
  if (hasFeaturedMatchId) {
    const raw =
      typeof body.featuredMatchId === "number"
        ? body.featuredMatchId
        : typeof body.featuredMatchId === "string"
          ? Number(body.featuredMatchId)
          : null;
    featuredMatchId = Number.isFinite(raw) ? Math.floor(raw as number) : null;
  }

  const hasGoalLimits = Object.prototype.hasOwnProperty.call(body, "goalLimits");
  let goalLimits: { defaultLimit?: number | null; roundLimits?: Record<string, number> | null } | null | undefined =
    undefined;
  if (hasGoalLimits) {
    if (body.goalLimits === null) {
      goalLimits = null;
    } else if (body.goalLimits && typeof body.goalLimits === "object") {
      const payload = body.goalLimits as Record<string, unknown>;
      const defaultLimitRaw =
        typeof payload.defaultLimit === "number"
          ? payload.defaultLimit
          : typeof payload.defaultLimit === "string"
            ? Number(payload.defaultLimit)
            : null;
      const defaultLimit =
        defaultLimitRaw !== null && Number.isFinite(defaultLimitRaw) ? Math.round(defaultLimitRaw) : null;
      const roundLimitsRaw = payload.roundLimits && typeof payload.roundLimits === "object"
        ? (payload.roundLimits as Record<string, unknown>)
        : null;
      const roundLimits: Record<string, number> = {};
      if (roundLimitsRaw) {
        Object.entries(roundLimitsRaw).forEach(([key, value]) => {
          const parsed = typeof value === "number" ? value : Number(value);
          if (Number.isFinite(parsed)) roundLimits[String(key)] = Math.round(parsed);
        });
      }
      goalLimits = {
        defaultLimit,
        roundLimits: Object.keys(roundLimits).length ? roundLimits : null,
      };
    } else {
      goalLimits = null;
    }
  }

  const hasLiveSponsors = Object.prototype.hasOwnProperty.call(body, "liveSponsors");
  let liveSponsors: Record<string, unknown> | null | undefined = undefined;
  if (hasLiveSponsors) {
    if (body.liveSponsors === null) {
      liveSponsors = null;
    } else if (body.liveSponsors && typeof body.liveSponsors === "object") {
      const payload = body.liveSponsors as Record<string, unknown>;
      const sanitizeSlot = (value: unknown) => {
        if (!value || typeof value !== "object") return null;
        const slot = value as Record<string, unknown>;
        const label = typeof slot.label === "string" ? slot.label.trim() : "";
        const logoUrl = typeof slot.logoUrl === "string" ? slot.logoUrl.trim() : "";
        const url = typeof slot.url === "string" ? slot.url.trim() : "";
        if (!label && !logoUrl && !url) return null;
        return {
          label: label || null,
          logoUrl: logoUrl || null,
          url: url || null,
        };
      };
      liveSponsors = {
        hero: sanitizeSlot(payload.hero),
        sideA: sanitizeSlot(payload.sideA),
        sideB: sanitizeSlot(payload.sideB),
        nowPlaying: sanitizeSlot(payload.nowPlaying),
      };
    } else {
      liveSponsors = null;
    }
  }

  if (!Number.isFinite(eventId) || !organizationIdBody) {
    return jsonWrap({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationIdBody,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership || organization.id !== organizationIdBody) {
    return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  }
  const editPermission = await ensureMemberModuleAccess({
    organizationId: organizationIdBody,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!editPermission.ok) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const config = await prisma.$transaction(async (tx) => {
      const existing = await tx.padelTournamentConfig.findUnique({
        where: { eventId },
        select: {
          id: true,
          advancedSettings: true,
          format: true,
          numberOfCourts: true,
          ruleSetId: true,
          ruleSetVersionId: true,
          defaultCategoryId: true,
          eligibilityType: true,
          splitDeadlineHours: true,
          enabledFormats: true,
          isInterclub: true,
          teamSize: true,
        },
      });
      const formatEffective = format ?? existing?.format ?? null;
      if (!formatEffective) {
        throw new Error("MISSING_FIELDS");
      }
      if (hasFormat && existing?.format && formatEffective !== existing.format) {
        const confirmedCount = await tx.padelRegistration.count({
          where: {
            eventId,
            status: PadelRegistrationStatus.CONFIRMED,
          },
        });
        if (confirmedCount > 0 && !confirmFormatChange) {
          throw new Error("FORMAT_CHANGE_CONFIRMATION_REQUIRED");
        }
      }

      const resolvedIsInterclub = hasIsInterclub ? Boolean(isInterclub) : existing?.isInterclub ?? false;
      const resolvedTeamSize = hasTeamSize ? teamSizeParsed : existing?.teamSize ?? null;
      if (resolvedIsInterclub && (!resolvedTeamSize || resolvedTeamSize < 2)) {
        throw new Error("TEAM_SIZE_REQUIRED");
      }
      const normalizedTeamSize = resolvedIsInterclub ? resolvedTeamSize : null;

      // Formatos suportados (alinhados com geração de jogos)
      const allowedFormats = new Set<padel_format>([
        padel_format.TODOS_CONTRA_TODOS,
        padel_format.QUADRO_ELIMINATORIO,
        padel_format.GRUPOS_ELIMINATORIAS,
        padel_format.QUADRO_AB,
        padel_format.DUPLA_ELIMINACAO,
        padel_format.NON_STOP,
        padel_format.CAMPEONATO_LIGA,
      ]);
      if (!allowedFormats.has(formatEffective)) {
        throw new Error("FORMAT_NOT_SUPPORTED");
      }

      const mergedAdvanced = {
        ...((existing?.advancedSettings as Record<string, unknown>) ?? {}),
        ...(groupsConfig ? { groupsConfig } : {}),
        ...(waitlistEnabled !== undefined ? { waitlistEnabled } : {}),
        ...(registrationStartsAt !== undefined ? { registrationStartsAt } : {}),
        ...(registrationEndsAt !== undefined ? { registrationEndsAt } : {}),
        ...(allowSecondCategory !== undefined ? { allowSecondCategory } : {}),
        ...(maxEntriesTotal !== undefined ? { maxEntriesTotal } : {}),
        ...(competitionState !== undefined ? { competitionState } : {}),
        ...(seedRanks !== undefined ? { seedRanks } : {}),
        ...(scheduleDefaults !== undefined ? { scheduleDefaults } : {}),
        ...(templateId !== undefined ? { templateId } : {}),
        ...(tvMonitor !== undefined ? { tvMonitor } : {}),
        ...(scoreRules !== undefined ? { scoreRules } : {}),
        ...(featuredMatchId !== undefined ? { featuredMatchId } : {}),
        ...(goalLimits !== undefined ? { goalLimits } : {}),
        ...(liveSponsors !== undefined ? { liveSponsors } : {}),
        formatRequested: formatEffective,
        formatEffective,
        generationVersion: "v1-groups-ko",
      };

      const normalizedFormats = hasEnabledFormats
        ? (enabledFormats?.filter((f) => allowedFormats.has(f as padel_format)) ?? []).map(
            (f) => f as padel_format,
          )
        : undefined;

      const effectiveRuleSetId = hasRuleSetId ? ruleSetId ?? null : existing?.ruleSetId ?? null;

      const createData: Prisma.PadelTournamentConfigUncheckedCreateInput = {
        eventId,
        organizationId: organizationIdBody,
        numberOfCourts: numberOfCourtsParsed ?? existing?.numberOfCourts ?? 1,
        ruleSetId: effectiveRuleSetId ?? undefined,
        defaultCategoryId: hasDefaultCategoryId ? defaultCategoryId ?? undefined : existing?.defaultCategoryId ?? undefined,
        eligibilityType: hasEligibilityType ? eligibilityType || undefined : existing?.eligibilityType ?? undefined,
        splitDeadlineHours: hasSplitDeadlineHours ? splitDeadlineHours ?? undefined : existing?.splitDeadlineHours ?? undefined,
        enabledFormats: normalizedFormats ?? existing?.enabledFormats ?? undefined,
        isInterclub: resolvedIsInterclub,
        teamSize: normalizedTeamSize ?? undefined,
        advancedSettings: mergedAdvanced as Prisma.InputJsonValue,
        format: formatEffective,
      };
      const updateData: Prisma.PadelTournamentConfigUncheckedUpdateInput = {
        ...(hasFormat ? { format: formatEffective } : {}),
        ...(hasNumberOfCourts && numberOfCourtsParsed !== null ? { numberOfCourts: numberOfCourtsParsed } : {}),
        ...(hasRuleSetId ? { ruleSetId: effectiveRuleSetId } : {}),
        ...(hasDefaultCategoryId ? { defaultCategoryId } : {}),
        ...(hasEligibilityType ? { eligibilityType: eligibilityType || undefined } : {}),
        ...(hasSplitDeadlineHours ? { splitDeadlineHours } : {}),
        ...(hasEnabledFormats ? { enabledFormats: normalizedFormats ?? [] } : {}),
        ...((hasIsInterclub || hasTeamSize) ? { isInterclub: resolvedIsInterclub, teamSize: normalizedTeamSize ?? null } : {}),
        advancedSettings: mergedAdvanced as Prisma.InputJsonValue,
      };

      const upserted = await tx.padelTournamentConfig.upsert({
        where: { eventId },
        create: createData,
        update: updateData,
        select: {
          id: true,
          ruleSetId: true,
          ruleSetVersionId: true,
        },
      });

      if (effectiveRuleSetId && (!upserted.ruleSetVersionId || effectiveRuleSetId !== existing?.ruleSetId)) {
        const version = await ensurePadelRuleSetVersion({
          tx,
          tournamentConfigId: upserted.id,
          ruleSetId: effectiveRuleSetId,
          actorUserId: user.id,
        });
        await tx.padelTournamentConfig.update({
          where: { id: upserted.id },
          data: { ruleSetVersionId: version.id },
        });
      }

      return tx.padelTournamentConfig.findUnique({
        where: { id: upserted.id },
        select: TOURNAMENT_CONFIG_SELECT,
      });
    });

    if (!config) {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const advancedSettings = (config.advancedSettings ?? {}) as Record<string, unknown>;
    const registrationEndsAtRaw =
      typeof advancedSettings.registrationEndsAt === "string" ? advancedSettings.registrationEndsAt : null;
    const registrationEndsAt =
      registrationEndsAtRaw && !Number.isNaN(new Date(registrationEndsAtRaw).getTime())
        ? new Date(registrationEndsAtRaw)
        : null;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        templateType: true,
        startsAt: true,
        tournament: { select: { id: true, inscriptionDeadlineAt: true } },
      },
    });
    if (event?.templateType === "PADEL") {
      const fallbackDeadline =
        event.startsAt && !Number.isNaN(new Date(event.startsAt).getTime())
          ? new Date(event.startsAt.getTime() - 24 * 60 * 60 * 1000)
          : null;
      const targetDeadline = registrationEndsAt ?? fallbackDeadline;
      if (targetDeadline) {
        if (event.tournament?.id) {
          const currentDeadline = event.tournament.inscriptionDeadlineAt;
          const shouldUpdate =
            !currentDeadline || currentDeadline.getTime() !== targetDeadline.getTime();
          if (shouldUpdate) {
            const res = await updateTournament({
              tournamentId: event.tournament.id,
              actorUserId: user.id,
              data: { inscriptionDeadlineAt: targetDeadline },
            });
            if (!res.ok) {
              throw new Error("TOURNAMENT_SYNC_FAILED");
            }
          }
        } else {
          const res = await createTournamentForEvent({
            eventId: event.id,
            format: TournamentFormat.MANUAL,
            config: { padelFormat: config.format ?? "UNKNOWN" },
            actorUserId: user.id,
            inscriptionDeadlineAt: targetDeadline,
          });
          if (!res.ok) {
            throw new Error("TOURNAMENT_SYNC_FAILED");
          }
        }
      }
    }

    return jsonWrap({ ok: true, config }, { status: 200 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "MISSING_FIELDS") {
        return jsonWrap({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
      }
      if (err.message === "FORMAT_NOT_SUPPORTED") {
        return jsonWrap({ ok: false, error: "FORMAT_NOT_SUPPORTED" }, { status: 400 });
      }
      if (err.message === "FORMAT_CHANGE_CONFIRMATION_REQUIRED") {
        return jsonWrap({ ok: false, error: "FORMAT_CHANGE_CONFIRMATION_REQUIRED" }, { status: 409 });
      }
      if (err.message === "TEAM_SIZE_REQUIRED") {
        return jsonWrap({ ok: false, error: "TEAM_SIZE_REQUIRED" }, { status: 400 });
      }
      if (err.message === "TOURNAMENT_SYNC_FAILED") {
        return jsonWrap({ ok: false, error: "TOURNAMENT_SYNC_FAILED" }, { status: 500 });
      }
    }
    console.error("[padel/tournaments/config][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
