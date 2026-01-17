export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, PadelEligibilityType, padel_format } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId } from "@/lib/organizationId";
import { normalizePadelScoreRules, type PadelScoreRules } from "@/domain/padel/score";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  // Garantir que o requester tem permissão no organization deste evento
  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: allowedRoles,
  });
  if (!organization || !membership) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const [config, tournament] = await Promise.all([
    prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      include: {
        ruleSet: true,
        category: true,
      },
    }),
    prisma.tournament.findUnique({
      where: { eventId },
      select: { generatedAt: true, generatedByUserId: true },
    }),
  ]);

  return NextResponse.json(
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

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const organizationIdBody = parseOrganizationId(body.organizationId);
  const format =
    typeof body.format === "string" && Object.values(padel_format).includes(body.format as padel_format)
      ? (body.format as padel_format)
      : null;
  const numberOfCourts = typeof body.numberOfCourts === "number" ? body.numberOfCourts : 1;
  const ruleSetId = typeof body.ruleSetId === "number" ? body.ruleSetId : null;
  const defaultCategoryId = typeof body.defaultCategoryId === "number" ? body.defaultCategoryId : null;
  const eligibilityType =
    typeof body.eligibilityType === "string" && Object.values(PadelEligibilityType).includes(body.eligibilityType as PadelEligibilityType)
      ? (body.eligibilityType as PadelEligibilityType)
      : null;
  const splitDeadlineHours =
    typeof body.splitDeadlineHours === "number" && Number.isFinite(body.splitDeadlineHours)
      ? Math.max(48, Math.min(168, Math.floor(body.splitDeadlineHours)))
      : null;
  const enabledFormats = Array.isArray(body.enabledFormats)
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
        return NextResponse.json({ ok: false, error: "INVALID_SCORE_RULES" }, { status: 400 });
      }
    }
  }

  if (!Number.isFinite(eventId) || !organizationIdBody || !format) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationIdBody,
    roles: allowedRoles,
  });
  if (!organization || organization.id !== organizationIdBody) {
    return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  }

  // Formatos suportados (alinhados com geração de jogos)
  const allowedFormats = new Set<padel_format>([
    padel_format.TODOS_CONTRA_TODOS,
    padel_format.QUADRO_ELIMINATORIO,
    padel_format.GRUPOS_ELIMINATORIAS,
    padel_format.QUADRO_AB,
    padel_format.NON_STOP,
    padel_format.CAMPEONATO_LIGA,
  ]);
  if (!allowedFormats.has(format)) {
    return NextResponse.json({ ok: false, error: "FORMAT_NOT_SUPPORTED" }, { status: 400 });
  }

  const formatEffective = format;

  try {
    const existing = await prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      select: { advancedSettings: true },
    });
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
      formatRequested: format,
      formatEffective,
      generationVersion: "v1-groups-ko",
    };

    const config = await prisma.padelTournamentConfig.upsert({
      where: { eventId },
      create: {
        eventId,
        organizationId: organizationIdBody,
        numberOfCourts: Math.max(1, numberOfCourts || 1),
        ruleSetId: ruleSetId || undefined,
        defaultCategoryId: defaultCategoryId || undefined,
        eligibilityType: eligibilityType || undefined,
        splitDeadlineHours: splitDeadlineHours ?? undefined,
        enabledFormats: enabledFormats?.filter((f) => allowedFormats.has(f as padel_format)) ?? undefined,
        advancedSettings: mergedAdvanced,
        format: formatEffective,
      },
      update: {
        format: formatEffective,
        numberOfCourts: Math.max(1, numberOfCourts || 1),
        ruleSetId: ruleSetId || undefined,
        defaultCategoryId: defaultCategoryId || undefined,
        eligibilityType: eligibilityType || undefined,
        splitDeadlineHours: splitDeadlineHours ?? undefined,
        enabledFormats: enabledFormats?.filter((f) => allowedFormats.has(f as padel_format)) ?? undefined,
        advancedSettings: mergedAdvanced,
      },
    });

    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (err) {
    console.error("[padel/tournaments/config][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
