export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { queueMatchChanged } from "@/domain/notifications/tournament";
import { computeAutoSchedulePlan } from "@/domain/padel/autoSchedule";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_SLOT_MINUTES = 15;
const DEFAULT_BUFFER_MINUTES = 5;
const DEFAULT_REST_MINUTES = 10;

const asScoreObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const normalizeReason = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = Number(resolved?.id);
  if (!Number.isFinite(matchId)) {
    return NextResponse.json({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = normalizeReason(body?.reason);
  const clearSchedule = body?.clearSchedule !== false;
  const autoReschedule = body?.autoReschedule !== false;
  const windowStartOverride = parseDate(body?.windowStart);
  const windowEndOverride = parseDate(body?.windowEnd);

  if (reason && reason.length < 3) {
    return NextResponse.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
  }

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: {
      event: {
        select: {
          id: true,
          organizationId: true,
          startsAt: true,
          endsAt: true,
          padelTournamentConfig: {
            select: {
              padelClubId: true,
              partnerClubIds: true,
              advancedSettings: true,
            },
          },
        },
      },
    },
  });
  if (!match || !match.event?.organizationId) {
    return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: allowedRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  if (match.status !== padel_match_status.PENDING) {
    return NextResponse.json({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
  }

  const score = asScoreObject(match.score);
  const delayStatusRaw = typeof score.delayStatus === "string" ? score.delayStatus : null;
  if (delayStatusRaw === "DELAYED") {
    return NextResponse.json({ ok: false, error: "ALREADY_DELAYED" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const previousStartAt = match.plannedStartAt ?? match.startTime ?? null;
  const previousEndAt = match.plannedEndAt ?? null;
  const nextScore = {
    ...score,
    delayStatus: "DELAYED",
    delayReason: reason || null,
    delayedAt: nowIso,
    delayedBy: user.id,
    delaySnapshot: {
      previousStartAt: previousStartAt ? previousStartAt.toISOString() : null,
      previousEndAt: previousEndAt ? previousEndAt.toISOString() : null,
      previousCourtId: match.courtId ?? null,
      previousDurationMinutes: match.plannedDurationMinutes ?? null,
    },
  };

  const updated = await prisma.padelMatch.update({
    where: { id: match.id },
    data: {
      score: nextScore,
      ...(clearSchedule
        ? {
            plannedStartAt: null,
            plannedEndAt: null,
            startTime: null,
          }
        : {}),
    },
    select: { id: true, plannedStartAt: true, plannedEndAt: true, plannedDurationMinutes: true, courtId: true },
  });
  let responseMatch: typeof updated | null = updated;

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DELAY",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      reason: reason || null,
      clearSchedule,
    },
  });

  const pairingIds = [match.pairingAId, match.pairingBId].filter(Boolean) as number[];
  let userIds: string[] = [];
  if (pairingIds.length > 0) {
    const pairings = await prisma.padelPairing.findMany({
      where: { id: { in: pairingIds } },
      select: { slots: { select: { profileId: true } } },
    });
    userIds = Array.from(
      new Set(
        pairings
          .flatMap((pairing) => pairing.slots.map((slot) => slot.profileId))
          .filter(Boolean) as string[],
      ),
    );
  }

  let rescheduled: { start: string; end: string; courtId: number } | null = null;
  let rescheduleError: string | null = null;
  const now = Date.now();
  const previousStartAtMs = previousStartAt ? previousStartAt.getTime() : null;

  if (autoReschedule && clearSchedule) {
    const advanced = (match.event.padelTournamentConfig?.advancedSettings || {}) as {
      courtIds?: number[];
      gameDurationMinutes?: number | null;
      scheduleDefaults?: {
        windowStart?: string | null;
        windowEnd?: string | null;
        durationMinutes?: number | null;
        slotMinutes?: number | null;
        bufferMinutes?: number | null;
        minRestMinutes?: number | null;
        priority?: "GROUPS_FIRST" | "KNOCKOUT_FIRST";
      };
    };

    const scheduleDefaults = advanced.scheduleDefaults ?? {};
    const fallbackWindowStart = match.event.startsAt ?? new Date();
    const fallbackWindowEnd =
      match.event.endsAt ?? new Date(fallbackWindowStart.getTime() + 6 * 60 * 60 * 1000);
    const windowStartRaw =
      windowStartOverride ??
      (typeof scheduleDefaults.windowStart === "string" ? parseDate(scheduleDefaults.windowStart) : null) ??
      fallbackWindowStart;
    const windowEnd =
      windowEndOverride ??
      (typeof scheduleDefaults.windowEnd === "string" ? parseDate(scheduleDefaults.windowEnd) : null) ??
      fallbackWindowEnd;
    const baselineStart = previousStartAtMs ? Math.max(windowStartRaw.getTime(), previousStartAtMs, now) : Math.max(windowStartRaw.getTime(), now);
    const windowStart = new Date(baselineStart);

    const durationFromDefaults =
      typeof scheduleDefaults.durationMinutes === "number" && Number.isFinite(scheduleDefaults.durationMinutes)
        ? scheduleDefaults.durationMinutes
        : null;
    const durationMinutes = Math.max(
      1,
      Math.round(
        match.plannedDurationMinutes ??
          (typeof advanced.gameDurationMinutes === "number" && Number.isFinite(advanced.gameDurationMinutes)
            ? advanced.gameDurationMinutes
            : durationFromDefaults ?? DEFAULT_DURATION_MINUTES),
      ),
    );

    const slotMinutes = Math.max(
      5,
      Math.round(parseNumber(scheduleDefaults.slotMinutes) ?? DEFAULT_SLOT_MINUTES),
    );
    const bufferMinutes = Math.max(
      0,
      Math.round(parseNumber(scheduleDefaults.bufferMinutes) ?? DEFAULT_BUFFER_MINUTES),
    );
    const minRestMinutes = Math.max(
      0,
      Math.round(parseNumber(scheduleDefaults.minRestMinutes) ?? DEFAULT_REST_MINUTES),
    );
    const priority =
      scheduleDefaults.priority === "KNOCKOUT_FIRST" ? "KNOCKOUT_FIRST" : "GROUPS_FIRST";

    if (windowEnd <= windowStart) {
      rescheduleError = "INVALID_WINDOW";
    } else {
      const configuredCourtIds = Array.isArray(advanced.courtIds)
        ? advanced.courtIds.filter((id) => typeof id === "number" && Number.isFinite(id))
        : [];

      let courts = configuredCourtIds.length
        ? await prisma.padelClubCourt.findMany({
            where: { id: { in: configuredCourtIds }, club: { organizationId: organization.id }, isActive: true },
            select: { id: true, name: true, displayOrder: true },
            orderBy: [{ displayOrder: "asc" }],
          })
        : [];
      if (courts.length === 0) {
        const clubIds = [
          match.event.padelTournamentConfig?.padelClubId ?? null,
          ...(match.event.padelTournamentConfig?.partnerClubIds ?? []),
        ].filter((id): id is number => typeof id === "number" && Number.isFinite(id));
        if (clubIds.length > 0) {
          courts = await prisma.padelClubCourt.findMany({
            where: { padelClubId: { in: clubIds }, isActive: true },
            select: { id: true, name: true, displayOrder: true },
            orderBy: [{ displayOrder: "asc" }],
          });
        }
      }

      if (courts.length === 0) {
        rescheduleError = "NO_COURTS";
      } else {
        const affectedMatches = [];
        const affectedMatchIds = new Set<number>();
        const beforeByMatchId = new Map<
          number,
          { plannedStartAt: Date | null; plannedEndAt: Date | null; plannedDurationMinutes: number | null; courtId: number | null }
        >();

        affectedMatches.push(match);
        affectedMatchIds.add(match.id);
        beforeByMatchId.set(match.id, {
          plannedStartAt: match.plannedStartAt ?? match.startTime ?? null,
          plannedEndAt: match.plannedEndAt ?? null,
          plannedDurationMinutes: match.plannedDurationMinutes ?? null,
          courtId: match.courtId ?? null,
        });

        if (match.courtId && previousStartAt) {
          const laterMatches = await prisma.padelMatch.findMany({
            where: {
              eventId: match.event.id,
              status: "PENDING",
              courtId: match.courtId,
              id: { not: match.id },
              OR: [
                { plannedStartAt: { gte: previousStartAt } },
                { startTime: { gte: previousStartAt } },
              ],
            },
            select: {
              id: true,
              plannedStartAt: true,
              plannedEndAt: true,
              plannedDurationMinutes: true,
              startTime: true,
              courtId: true,
              pairingAId: true,
              pairingBId: true,
              roundLabel: true,
              roundType: true,
              groupLabel: true,
              score: true,
            },
            orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
          });
          laterMatches.forEach((m) => {
            affectedMatches.push(m as typeof match);
            affectedMatchIds.add(m.id);
            beforeByMatchId.set(m.id, {
              plannedStartAt: m.plannedStartAt ?? m.startTime ?? null,
              plannedEndAt: m.plannedEndAt ?? null,
              plannedDurationMinutes: m.plannedDurationMinutes ?? null,
              courtId: m.courtId ?? null,
            });
          });
        }

        const scheduledMatches = await prisma.padelMatch.findMany({
          where: {
            eventId: match.event.id,
            id: { notIn: Array.from(affectedMatchIds) },
            OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
          },
          select: {
            id: true,
            plannedStartAt: true,
            plannedEndAt: true,
            plannedDurationMinutes: true,
            startTime: true,
            courtId: true,
            pairingAId: true,
            pairingBId: true,
          },
        });

        const pairingIdsForSchedule = new Set<number>();
        affectedMatches.forEach((m) => {
          if (m.pairingAId) pairingIdsForSchedule.add(m.pairingAId);
          if (m.pairingBId) pairingIdsForSchedule.add(m.pairingBId);
        });
        scheduledMatches.forEach((m) => {
          if (m.pairingAId) pairingIdsForSchedule.add(m.pairingAId);
          if (m.pairingBId) pairingIdsForSchedule.add(m.pairingBId);
        });

        const pairings = pairingIdsForSchedule.size
          ? await prisma.padelPairing.findMany({
              where: { id: { in: Array.from(pairingIdsForSchedule) } },
              select: {
                id: true,
                slots: {
                  select: {
                    profileId: true,
                    playerProfileId: true,
                    playerProfile: { select: { email: true } },
                  },
                },
              },
            })
          : [];

        const pairingPlayers = new Map<number, { profileIds: number[]; emails: string[] }>();
        const pairingUsers = new Map<number, string[]>();
        pairings.forEach((pairing) => {
          const profileIds = new Set<number>();
          const emails = new Set<string>();
          const userIds = new Set<string>();
          pairing.slots.forEach((slot) => {
            if (slot.playerProfileId) profileIds.add(slot.playerProfileId);
            if (slot.profileId) userIds.add(slot.profileId);
            const email = slot.playerProfile?.email?.trim().toLowerCase();
            if (email) emails.add(email);
          });
          pairingPlayers.set(pairing.id, {
            profileIds: Array.from(profileIds),
            emails: Array.from(emails),
          });
          pairingUsers.set(pairing.id, Array.from(userIds));
        });

        const [availabilities, courtBlocks] = await Promise.all([
          prisma.padelAvailability.findMany({
            where: { eventId: match.event.id, organizationId: organization.id },
            select: { playerProfileId: true, playerEmail: true, startAt: true, endAt: true },
          }),
          prisma.padelCourtBlock.findMany({
            where: { eventId: match.event.id, organizationId: organization.id },
            select: { courtId: true, startAt: true, endAt: true },
          }),
        ]);

        const scheduleResult = computeAutoSchedulePlan({
          unscheduledMatches: affectedMatches.map((m) => ({
            id: m.id,
            plannedDurationMinutes: m.plannedDurationMinutes ?? durationMinutes,
            courtId: m.courtId ?? null,
            pairingAId: m.pairingAId ?? null,
            pairingBId: m.pairingBId ?? null,
            roundLabel: m.roundLabel ?? null,
            roundType: m.roundType ?? null,
            groupLabel: m.groupLabel ?? null,
          })),
          scheduledMatches,
          courts: courts.map((court) => ({ id: court.id, name: court.name ?? null })),
          pairingPlayers,
          availabilities,
          courtBlocks,
          config: {
            windowStart,
            windowEnd,
            durationMinutes,
            slotMinutes,
            bufferMinutes,
            minRestMinutes,
            priority,
          },
        });

        const scheduled = scheduleResult.scheduled.find((item) => item.matchId === match.id) ?? null;
        if (!scheduled) {
          rescheduleError = scheduleResult.skipped.find((item) => item.matchId === match.id)?.reason ?? "NO_SLOT";
        } else {
          const rescheduledScore = {
            ...nextScore,
            delayStatus: "RESCHEDULED",
            rescheduledAt: nowIso,
            rescheduledBy: user.id,
          };
          const scoreByMatchId = new Map<number, Record<string, unknown>>();
          affectedMatches.forEach((m) => {
            const score = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : {};
            scoreByMatchId.set(m.id, score);
          });

          const scheduledUpdates = scheduleResult.scheduled.map((item) => ({
            matchId: item.matchId,
            courtId: item.courtId,
            start: item.start,
            end: item.end,
            durationMinutes: item.durationMinutes,
          }));
          const scheduledMatchIds = new Set(scheduledUpdates.map((item) => item.matchId));
          const clearedMatches = affectedMatches.filter((m) => !scheduledMatchIds.has(m.id));

          const updatedMatches = await prisma.$transaction([
            ...scheduledUpdates.map((update) => {
              const score = scoreByMatchId.get(update.matchId) ?? {};
              const isDelayedMatch = update.matchId === match.id;
              const nextScore = isDelayedMatch ? rescheduledScore : score;
              return prisma.padelMatch.update({
                where: { id: update.matchId },
                data: {
                  plannedStartAt: update.start,
                  plannedEndAt: update.end,
                  plannedDurationMinutes: update.durationMinutes,
                  courtId: update.courtId,
                  ...(isDelayedMatch ? { score: nextScore } : {}),
                },
                select: {
                  id: true,
                  plannedStartAt: true,
                  plannedEndAt: true,
                  plannedDurationMinutes: true,
                  courtId: true,
                  pairingAId: true,
                  pairingBId: true,
                },
              });
            }),
            ...clearedMatches.map((m) =>
              prisma.padelMatch.update({
                where: { id: m.id },
                data: {
                  plannedStartAt: null,
                  plannedEndAt: null,
                  startTime: null,
                },
                select: {
                  id: true,
                  plannedStartAt: true,
                  plannedEndAt: true,
                  plannedDurationMinutes: true,
                  courtId: true,
                  pairingAId: true,
                  pairingBId: true,
                },
              }),
            ),
          ]);

          const updatedById = new Map(updatedMatches.map((m) => [m.id, m]));
          const rescheduledMatch = updatedById.get(match.id) ?? null;
          if (rescheduledMatch) {
            responseMatch = rescheduledMatch;
            rescheduled = {
              start: rescheduledMatch.plannedStartAt?.toISOString() ?? scheduled.start.toISOString(),
              end: rescheduledMatch.plannedEndAt?.toISOString() ?? scheduled.end.toISOString(),
              courtId: rescheduledMatch.courtId ?? scheduled.courtId,
            };
          }

          await recordOrganizationAuditSafe({
            organizationId: match.event.organizationId,
            actorUserId: user.id,
            action: "PADEL_MATCH_RESCHEDULE",
            metadata: {
              matchId: match.id,
              eventId: match.event.id,
              reason: reason || null,
              affectedMatches: [...scheduledUpdates, ...clearedMatches.map((m) => ({ matchId: m.id }))].map((update) => {
                const before = beforeByMatchId.get(update.matchId);
                const after = updatedById.get(update.matchId);
                return {
                  matchId: update.matchId,
                  before: {
                    plannedStartAt: before?.plannedStartAt ?? null,
                    plannedEndAt: before?.plannedEndAt ?? null,
                    plannedDurationMinutes: before?.plannedDurationMinutes ?? null,
                    courtId: before?.courtId ?? null,
                  },
                  after: {
                    plannedStartAt: after?.plannedStartAt ?? null,
                    plannedEndAt: after?.plannedEndAt ?? null,
                    plannedDurationMinutes: after?.plannedDurationMinutes ?? null,
                    courtId: after?.courtId ?? null,
                  },
                };
              }),
            },
          });

          for (const updatedMatch of updatedMatches) {
            const before = beforeByMatchId.get(updatedMatch.id);
            const startChanged =
              (before?.plannedStartAt?.getTime() ?? 0) !== (updatedMatch.plannedStartAt?.getTime() ?? 0);
            const courtChanged = (before?.courtId ?? null) !== (updatedMatch.courtId ?? null);
            if (!startChanged && !courtChanged) continue;
            const pairingUserIds = new Set<string>();
            if (updatedMatch.pairingAId) {
              (pairingUsers.get(updatedMatch.pairingAId) ?? []).forEach((id) => pairingUserIds.add(id));
            }
            if (updatedMatch.pairingBId) {
              (pairingUsers.get(updatedMatch.pairingBId) ?? []).forEach((id) => pairingUserIds.add(id));
            }
            const notifyUsers = Array.from(pairingUserIds);
            if (notifyUsers.length === 0) continue;
            await queueMatchChanged({
              userIds: notifyUsers,
              matchId: updatedMatch.id,
              startAt: updatedMatch.plannedStartAt ?? null,
              courtId: updatedMatch.courtId ?? null,
            });
          }
        }
      }
    }
  }

  if (!rescheduled && userIds.length > 0) {
    await queueMatchChanged({
      userIds,
      matchId: match.id,
      startAt: null,
      courtId: null,
    });
  }

  return NextResponse.json(
    { ok: true, match: responseMatch, rescheduled, rescheduleError },
    { status: 200 },
  );
}
