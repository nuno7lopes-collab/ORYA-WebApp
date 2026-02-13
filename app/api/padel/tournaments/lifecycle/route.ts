export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationMemberRole, OrganizationModule, PadelTournamentLifecycleStatus, PadelTournamentRole, SourceType, TournamentFormat } from "@prisma/client";
import {
  canTransitionLifecycle,
  getAllowedLifecycleTransitions,
  resolveEventStatusForLifecycle,
} from "@/domain/padel/tournamentLifecycle";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createTournamentForEvent, updateTournament } from "@/domain/tournaments/commands";
import { rebuildPadelRatingsForEvent } from "@/domain/padel/ratingEngine";

const READ_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const WRITE_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parseLifecycle = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(PadelTournamentLifecycleStatus).includes(normalized as PadelTournamentLifecycleStatus)
    ? (normalized as PadelTournamentLifecycleStatus)
    : null;
};

const getRequestMeta = (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ip, userAgent };
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      status: true,
      templateType: true,
      organizationId: true,
      padelTournamentConfig: {
        select: {
          id: true,
          lifecycleStatus: true,
          publishedAt: true,
          lockedAt: true,
          liveAt: true,
          completedAt: true,
          cancelledAt: true,
          lifecycleUpdatedAt: true,
        },
      },
    },
  });

  if (!event?.organizationId || event.templateType !== "PADEL" || !event.padelTournamentConfig) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: READ_ROLES,
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

  const lifecycle = event.padelTournamentConfig;
  const transitions = getAllowedLifecycleTransitions(lifecycle.lifecycleStatus);

  return jsonWrap(
    {
      ok: true,
      event: {
        id: event.id,
        status: event.status,
      },
      lifecycle: lifecycle,
      transitions,
      canManage: WRITE_ROLES.includes(membership.role),
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
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const nextStatus = parseLifecycle(body.nextStatus);
  if (!nextStatus) return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      status: true,
      templateType: true,
      organizationId: true,
      startsAt: true,
      padelTournamentConfig: {
        select: {
          id: true,
          lifecycleStatus: true,
          publishedAt: true,
          lockedAt: true,
          liveAt: true,
          completedAt: true,
          cancelledAt: true,
        },
      },
    },
  });
  if (!event?.organizationId || event.templateType !== "PADEL" || !event.padelTournamentConfig) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: WRITE_ROLES,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const editPermission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!editPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  if (nextStatus === PadelTournamentLifecycleStatus.PUBLISHED) {
    const [config, categoryLinks, directorCount] = await Promise.all([
      prisma.padelTournamentConfig.findUnique({
        where: { eventId: event.id },
        select: {
          id: true,
          format: true,
          padelClubId: true,
          numberOfCourts: true,
          advancedSettings: true,
          padelV2Enabled: true,
        },
      }),
      prisma.padelEventCategoryLink.findMany({
        where: { eventId: event.id, isEnabled: true },
        select: { id: true, pricePerPlayerCents: true, currency: true },
      }),
      prisma.padelTournamentRoleAssignment.count({
        where: {
          eventId: event.id,
          organizationId: event.organizationId,
          role: PadelTournamentRole.DIRETOR_PROVA,
        },
      }),
    ]);
    const missing: string[] = [];
    if (!config?.padelV2Enabled) missing.push("PADEL_V2_DISABLED");
    if (!config?.format) missing.push("FORMAT_MISSING");
    if (!config?.padelClubId) missing.push("CLUB_MISSING");
    if (!config?.numberOfCourts || config.numberOfCourts < 1) missing.push("COURTS_MISSING");
    if (!categoryLinks.length) {
      missing.push("CATEGORIES_MISSING");
    } else if (categoryLinks.some((link) => link.pricePerPlayerCents === null || link.currency === null)) {
      missing.push("CATEGORY_PRICES_MISSING");
    }
    const advanced = (config?.advancedSettings || {}) as {
      registrationStartsAt?: string | null;
      registrationEndsAt?: string | null;
    };
    const registrationStartsAt =
      advanced.registrationStartsAt && !Number.isNaN(new Date(advanced.registrationStartsAt).getTime())
        ? new Date(advanced.registrationStartsAt)
        : null;
    const registrationEndsAt =
      advanced.registrationEndsAt && !Number.isNaN(new Date(advanced.registrationEndsAt).getTime())
        ? new Date(advanced.registrationEndsAt)
        : null;
    if (registrationStartsAt && registrationEndsAt && registrationStartsAt >= registrationEndsAt) {
      missing.push("REGISTRATION_WINDOW_INVALID");
    }
    if (registrationEndsAt && event.startsAt && registrationEndsAt >= event.startsAt) {
      missing.push("REGISTRATION_END_AFTER_START");
    }
    if (directorCount < 1) {
      missing.push("TOURNAMENT_DIRECTOR_REQUIRED");
    }
    if (missing.length > 0) {
      return jsonWrap({ ok: false, error: "TOURNAMENT_NOT_READY", missing }, { status: 409 });
    }
  }

  const current = event.padelTournamentConfig.lifecycleStatus;
  if (current === nextStatus) {
    return jsonWrap({ ok: true, lifecycle: event.padelTournamentConfig, eventStatus: event.status }, { status: 200 });
  }
  if (!canTransitionLifecycle(current, nextStatus)) {
    return jsonWrap({ ok: false, error: "TRANSITION_NOT_ALLOWED" }, { status: 409 });
  }

  const now = new Date();
  const lifecycleUpdate: Record<string, unknown> = {
    lifecycleStatus: nextStatus,
    lifecycleUpdatedAt: now,
  };
  const ensureAt = (field: string, shouldSet: boolean) => {
    if (!shouldSet) return;
    if ((event.padelTournamentConfig as Record<string, unknown>)[field]) return;
    lifecycleUpdate[field] = now;
  };
  ensureAt("publishedAt", ["PUBLISHED", "LOCKED", "LIVE", "COMPLETED"].includes(nextStatus));
  ensureAt("lockedAt", ["LOCKED", "LIVE", "COMPLETED"].includes(nextStatus));
  ensureAt("liveAt", ["LIVE", "COMPLETED"].includes(nextStatus));
  ensureAt("completedAt", nextStatus === "COMPLETED");
  ensureAt("cancelledAt", nextStatus === "CANCELLED");

  const nextEventStatus = resolveEventStatusForLifecycle(nextStatus);

  const { ip, userAgent } = getRequestMeta(req);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedConfig = await tx.padelTournamentConfig.update({
      where: { id: event.padelTournamentConfig!.id },
      data: lifecycleUpdate,
      select: {
        id: true,
        lifecycleStatus: true,
        publishedAt: true,
        lockedAt: true,
        liveAt: true,
        completedAt: true,
        cancelledAt: true,
        lifecycleUpdatedAt: true,
      },
    });

    if (event.status !== nextEventStatus) {
      await tx.event.update({
        where: { id: event.id },
        data: { status: nextEventStatus },
      });
    }

    await appendEventLog(
      {
        organizationId: event.organizationId!,
        eventType: "padel_tournament.lifecycle_updated",
        actorUserId: user.id,
        sourceType: SourceType.TOURNAMENT,
        sourceId: String(event.id),
        payload: {
          eventId: event.id,
          fromStatus: current,
          toStatus: nextStatus,
          eventStatus: nextEventStatus,
        },
      },
      tx,
    );

    let ratingSnapshot: { processedMatches: number; processedPlayers: number; rankingRows: number } | null = null;
    if (nextStatus === PadelTournamentLifecycleStatus.COMPLETED) {
      const configForTier = await tx.padelTournamentConfig.findUnique({
        where: { eventId: event.id },
        select: { advancedSettings: true },
      });
      const advanced = (configForTier?.advancedSettings ?? {}) as Record<string, unknown>;
      const tier = typeof advanced.tournamentTier === "string" ? advanced.tournamentTier : null;
      ratingSnapshot = await rebuildPadelRatingsForEvent({
        tx,
        organizationId: event.organizationId!,
        eventId: event.id,
        actorUserId: user.id,
        tier,
      });
    }

    return { updatedConfig, ratingSnapshot };
  });

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: user.id,
    action: "PADEL_TOURNAMENT_LIFECYCLE",
    entityType: "event",
    entityId: String(event.id),
    metadata: { fromStatus: current, toStatus: nextStatus, eventStatus: nextEventStatus },
    ip,
    userAgent,
  });

  try {
    if (["PUBLISHED", "LOCKED", "LIVE", "COMPLETED"].includes(nextStatus)) {
      const syncEvent = await prisma.event.findUnique({
        where: { id: event.id },
        select: {
          id: true,
          templateType: true,
          startsAt: true,
          tournament: { select: { id: true, inscriptionDeadlineAt: true } },
          padelTournamentConfig: { select: { format: true, advancedSettings: true } },
        },
      });
      if (syncEvent?.templateType === "PADEL" && syncEvent.padelTournamentConfig) {
        const advanced = (syncEvent.padelTournamentConfig.advancedSettings ?? {}) as Record<string, unknown>;
        const registrationEndsAtRaw =
          typeof advanced.registrationEndsAt === "string" ? advanced.registrationEndsAt : null;
        const registrationEndsAt =
          registrationEndsAtRaw && !Number.isNaN(new Date(registrationEndsAtRaw).getTime())
            ? new Date(registrationEndsAtRaw)
            : null;
        const fallbackDeadline =
          syncEvent.startsAt && !Number.isNaN(new Date(syncEvent.startsAt).getTime())
            ? new Date(syncEvent.startsAt.getTime() - 24 * 60 * 60 * 1000)
            : null;
        const targetDeadline = registrationEndsAt ?? fallbackDeadline;
        if (targetDeadline) {
          if (syncEvent.tournament?.id) {
            const currentDeadline = syncEvent.tournament.inscriptionDeadlineAt;
            const shouldUpdate =
              !currentDeadline || currentDeadline.getTime() !== targetDeadline.getTime();
            if (shouldUpdate) {
              const res = await updateTournament({
                tournamentId: syncEvent.tournament.id,
                actorUserId: user.id,
                data: { inscriptionDeadlineAt: targetDeadline },
              });
              if (!res.ok) {
                throw new Error("TOURNAMENT_SYNC_FAILED");
              }
            }
          } else {
            const res = await createTournamentForEvent({
              eventId: syncEvent.id,
              format: TournamentFormat.MANUAL,
              config: { padelFormat: syncEvent.padelTournamentConfig.format ?? "UNKNOWN" },
              actorUserId: user.id,
              inscriptionDeadlineAt: targetDeadline,
            });
            if (!res.ok) {
              throw new Error("TOURNAMENT_SYNC_FAILED");
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[padel/tournaments/lifecycle][sync]", err);
    return jsonWrap({ ok: false, error: "TOURNAMENT_SYNC_FAILED" }, { status: 500 });
  }

  return jsonWrap(
    {
      ok: true,
      lifecycle: updated.updatedConfig,
      eventStatus: nextEventStatus,
      ...(updated.ratingSnapshot ? { ratingSnapshot: updated.ratingSnapshot } : {}),
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
