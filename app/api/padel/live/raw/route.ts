export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationModule } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { buildPadelLiveReadModel } from "@/domain/padel/liveReadModel";
import { getAppEnv } from "@/lib/appEnv";
import { requireAdminUser } from "@/lib/admin/auth";
import { readMfaSessionCookie, verifyMfaSession } from "@/lib/admin/mfaSession";
import { auditAdminAction } from "@/lib/admin/audit";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), MAX_LIMIT);
}

function parseBoolean(raw: string | null, fallback: boolean) {
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return fallback;
}

async function resolveEventRef(req: NextRequest) {
  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!eventId && !slug) return null;

  return prisma.event.findUnique({
    where: eventId ? { id: eventId, isDeleted: false } : { slug: slug!, isDeleted: false },
    select: {
      id: true,
      slug: true,
      title: true,
      organizationId: true,
      status: true,
      updatedAt: true,
    },
  });
}

async function canReadAsOrgEngineer(params: {
  actorUserId: string;
  organizationId: number;
}) {
  const { organization, membership } = await getActiveOrganizationForUser(params.actorUserId, {
    organizationId: params.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization || !membership) return false;

  const permission = await ensureMemberModuleAccess({
    organizationId: params.organizationId,
    userId: params.actorUserId,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return permission.ok;
}

async function _GET(req: NextRequest) {
  const event = await resolveEventRef(req);
  if (!event?.id || !event.organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const appEnv = getAppEnv();
  const adminAuth = await requireAdminUser({ req });
  const isAdmin = adminAuth.ok && adminAuth.userId === user.id;

  if (appEnv === "prod") {
    if (!isAdmin) {
      return jsonWrap({ ok: false, error: "RAW_LIVE_ADMIN_REQUIRED" }, { status: 403 });
    }
    const mfaToken = await readMfaSessionCookie(req);
    const mfa = verifyMfaSession(mfaToken, user.id);
    if (!mfa.ok) {
      return jsonWrap({ ok: false, error: "STEP_UP_REQUIRED" }, { status: 403 });
    }
  } else if (!isAdmin) {
    const canRead = await canReadAsOrgEngineer({
      actorUserId: user.id,
      organizationId: event.organizationId,
    });
    if (!canRead) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
  const includeReadModel = parseBoolean(req.nextUrl.searchParams.get("includeReadModel"), true);

  const [matches, resultCards, liveReadModel] = await Promise.all([
    prisma.eventMatchSlot.findMany({
      where: { eventId: event.id },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        groupLabel: true,
        roundType: true,
        roundLabel: true,
        courtId: true,
        courtName: true,
        courtNumber: true,
        startTime: true,
        plannedStartAt: true,
        plannedEndAt: true,
        actualStartAt: true,
        actualEndAt: true,
        plannedDurationMinutes: true,
        scoreMode: true,
        score: true,
        scoreSets: true,
        winnerSide: true,
        winnerPairingId: true,
        winnerParticipantId: true,
        updatedAt: true,
        participants: {
          orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
          select: {
            side: true,
            slotOrder: true,
            participantId: true,
            participant: {
              select: {
                sourcePairingId: true,
                playerProfile: {
                  select: {
                    id: true,
                    userId: true,
                    displayName: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.padelMatchResultCard.findMany({
      where: { eventId: event.id },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        matchId: true,
        status: true,
        payloadHash: true,
        submittedByUserId: true,
        confirmedAt: true,
        conflictAt: true,
        appliedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    includeReadModel
      ? buildPadelLiveReadModel({
          eventId: event.id,
          visibility: "internal",
        })
      : Promise.resolve(null),
  ]);

  if (isAdmin) {
    await auditAdminAction({
      action: "PADEL_LIVE_RAW_READ",
      actorUserId: user.id,
      payload: {
        appEnv,
        eventId: event.id,
        organizationId: event.organizationId,
        matchCount: matches.length,
        resultCardCount: resultCards.length,
      },
    });
  } else {
    await recordOrganizationAuditSafe({
      organizationId: event.organizationId,
      actorUserId: user.id,
      action: "PADEL_LIVE_RAW_READ",
      metadata: {
        appEnv,
        eventId: event.id,
        matchCount: matches.length,
        resultCardCount: resultCards.length,
      },
    });
  }

  return jsonWrap(
    {
      ok: true,
      diagnostic: true,
      appEnv,
      accessMode: isAdmin ? "ADMIN" : "ENGINEERING",
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        organizationId: event.organizationId,
        status: event.status,
        updatedAt: event.updatedAt?.toISOString() ?? null,
      },
      raw: {
        matches,
        resultCards,
      },
      readModel: liveReadModel,
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
