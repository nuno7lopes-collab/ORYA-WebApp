import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getConfirmedPairings } from "@/domain/tournaments/generation";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { TournamentFormat, OrganizationModule } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { requestTournamentGeneration } from "@/domain/tournaments/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function isOrganizationUser(userId: string, organizationId: number) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { officialEmail: true, officialEmailVerifiedAt: true },
  });
  if (!organization) return false;
  const emailGate = ensureOrganizationEmailVerified(organization);
  if (!emailGate.ok) return false;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return false;
  const { membership } = await getActiveOrganizationForUser(userId, {
    organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!membership) return false;
  const access = await ensureMemberModuleAccess({
    organizationId,
    userId,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { event: { select: { organizationId: true } } },
  });
  if (!tournament) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (!tournament.event.organizationId) {
    return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 400 });
  }

  const authorized = await isOrganizationUser(data.user.id, tournament.event.organizationId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const format = (body?.format as TournamentFormat | undefined) ?? tournament.format;
  const seed = typeof body?.seed === "string" ? body.seed : null;
  const forceGenerate = body?.forceGenerate === true;
  const source = typeof body?.source === "string" ? body.source : null;
  const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const manualParticipants = Array.isArray(config.manualParticipants)
    ? (config.manualParticipants as Array<Record<string, unknown>>)
    : [];
  const manualEntries = manualParticipants
    .map((p) => {
      const id = Number.isFinite(p.id) ? Number(p.id) : null;
      const seed = Number.isFinite(p.seed) ? Number(p.seed) : null;
      return { id, seed };
    })
    .filter((p) => typeof p.id === "number" && p.id >= -2147483648 && p.id <= 2147483647);
  const manualIds = manualEntries.map((p) => p.id as number);
  const configBracketSize = Number.isFinite((config as any).bracketSize) ? Number((config as any).bracketSize) : null;

  let pairingIds: Array<number | null> = await getConfirmedPairings(tournament.eventId);
  const hasManual = manualIds.length > 0;
  let preserveOrder = false;
  if (source === "manual" || (hasManual && pairingIds.length === 0)) {
    preserveOrder = true;
    const targetSize = bracketSize ?? configBracketSize ?? null;
    if (targetSize && manualIds.length > targetSize) {
      return jsonWrap({ ok: false, error: "BRACKET_TOO_SMALL" }, { status: 400 });
    }
    if (targetSize) {
      const slots = Array.from({ length: targetSize }, () => null as number | null);
      const unseeded: number[] = [];
      manualEntries.forEach((entry) => {
        if (typeof entry.seed === "number" && entry.seed >= 1 && entry.seed <= targetSize) {
          const idx = entry.seed - 1;
          if (slots[idx] === null) {
            slots[idx] = entry.id as number;
            return;
          }
        }
        unseeded.push(entry.id as number);
      });
      let cursor = 0;
      unseeded.forEach((id) => {
        while (cursor < slots.length && slots[cursor] !== null) cursor += 1;
        if (cursor < slots.length) {
          slots[cursor] = id;
          cursor += 1;
        }
      });
      pairingIds = slots;
    } else {
      pairingIds = manualIds;
    }
  }
  if (source === "manual" && manualIds.length === 0) {
    return jsonWrap({ ok: false, error: "NO_PARTICIPANTS" }, { status: 400 });
  }

  await requestTournamentGeneration({
    organizationId: tournament.event.organizationId,
    tournamentId: tournament.id,
    eventId: tournament.eventId,
    actorUserId: data.user.id,
    payload: {
      tournamentId: tournament.id,
      format,
      pairings: pairingIds,
      seed,
      inscriptionDeadlineAt: tournament.inscriptionDeadlineAt?.toISOString() ?? null,
      forceGenerate,
      userId: data.user.id,
      targetSize: bracketSize ?? configBracketSize ?? null,
      preserveOrder,
    },
  });

  return jsonWrap({ ok: true, queued: true }, { status: 202 });
}
export const POST = withApiEnvelope(_POST);