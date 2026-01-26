export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const adminRoles = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);
const SYSTEM_MATCH_EVENT = "PADEL_MATCH_SYSTEM_UPDATED";

const asScoreObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const normalizeReason = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const isParticipant = (match: {
  pairingA?: { slots?: Array<{ profileId: string | null }> | null } | null;
  pairingB?: { slots?: Array<{ profileId: string | null }> | null } | null;
}, userId: string) => {
  const inA = match.pairingA?.slots?.some((slot) => slot.profileId === userId) ?? false;
  const inB = match.pairingB?.slots?.some((slot) => slot.profileId === userId) ?? false;
  return inA || inB;
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
  if (!reason || reason.length < 5) {
    return NextResponse.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
  }

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: {
      event: { select: { id: true, organizationId: true } },
      pairingA: { select: { slots: { select: { profileId: true } } } },
      pairingB: { select: { slots: { select: { profileId: true } } } },
    },
  });
  if (!match || !match.event?.organizationId) {
    return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }

  const participant = isParticipant(match, user.id);
  if (!participant) {
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: match.event.organizationId,
      roles: allowedRoles,
    });
    if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (match.status !== padel_match_status.DONE) {
    return NextResponse.json({ ok: false, error: "MATCH_NOT_DONE" }, { status: 409 });
  }

  const score = asScoreObject(match.score);
  if (score.disputeStatus === "OPEN") {
    return NextResponse.json({ ok: false, error: "DISPUTE_ALREADY_OPEN" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { match: updated } = await updatePadelMatch({
    matchId: match.id,
    eventId: match.event.id,
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    beforeStatus: match.status ?? null,
    eventType: SYSTEM_MATCH_EVENT,
    data: {
      score: {
        ...score,
        disputeStatus: "OPEN",
        disputeReason: reason,
        disputedAt: nowIso,
        disputedBy: user.id,
        disputeResolvedAt: null,
        disputeResolvedBy: null,
        disputeResolutionNote: null,
      },
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DISPUTE_OPEN",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      reason,
    },
  });

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: { event: { select: { id: true, organizationId: true } } },
  });
  if (!match || !match.event?.organizationId) {
    return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: allowedRoles,
  });
  if (!organization || !membership) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  if (!adminRoles.has(membership.role)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const score = asScoreObject(match.score);
  if (score.disputeStatus !== "OPEN") {
    return NextResponse.json({ ok: false, error: "DISPUTE_NOT_OPEN" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const resolutionNote = normalizeReason(body?.resolutionNote ?? body?.note);

  const nowIso = new Date().toISOString();
  const { match: updated } = await updatePadelMatch({
    matchId: match.id,
    eventId: match.event.id,
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    beforeStatus: match.status ?? null,
    eventType: SYSTEM_MATCH_EVENT,
    data: {
      score: {
        ...score,
        disputeStatus: "RESOLVED",
        disputeResolvedAt: nowIso,
        disputeResolvedBy: user.id,
        ...(resolutionNote ? { disputeResolutionNote: resolutionNote } : {}),
      },
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DISPUTE_RESOLVE",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      resolutionNote: resolutionNote || null,
    },
  });

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
