import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ORGANIZATION_CATEGORY } from "@/lib/organizationCategories";
import { normalizeLiveHubMode, resolveLiveHubModules } from "@/lib/liveHubConfig";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { validateScore, type ScorePayload } from "@/domain/tournaments/matchRules";
import { canScanTickets } from "@/lib/organizerAccess";

const ONEVONE_ORGANIZER_ID = 23;

function pickDisplayName(profile: { fullName: string | null; username: string | null } | null) {
  return profile?.fullName || (profile?.username ? `@${profile.username}` : null);
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params?.slug;
  if (!slug) return NextResponse.json({ ok: false, error: "INVALID_SLUG" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      status: true,
      locationName: true,
      locationCity: true,
      coverImageUrl: true,
      organizerId: true,
      liveHubMode: true,
      liveStreamUrl: true,
      organizer: {
        select: {
          id: true,
          publicName: true,
          username: true,
          organizationCategory: true,
          brandingAvatarUrl: true,
          liveHubPremiumEnabled: true,
        },
      },
      tournament: {
        select: {
          id: true,
          format: true,
          generationSeed: true,
          tieBreakRules: true,
        },
      },
    },
  });

  if (!event) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;

  const ticket = userId
    ? await prisma.ticket.findFirst({
        where: {
          eventId: event.id,
          status: "ACTIVE",
          OR: [{ userId }, { ownerUserId: userId }],
        },
        select: { id: true, tournamentEntryId: true },
      })
    : null;

  let isOrganizer = false;
  if (userId && event.organizerId) {
    const access = await canScanTickets(userId, event.id);
    isOrganizer = access.allowed;
  }

  const viewerRole = isOrganizer ? "ORGANIZER" : ticket ? "PARTICIPANT" : "PUBLIC";

  const category = event.organizer?.organizationCategory ?? DEFAULT_ORGANIZATION_CATEGORY;
  const premiumActive = Boolean(
    event.organizer?.liveHubPremiumEnabled && event.organizer?.id === ONEVONE_ORGANIZER_ID,
  );
  const liveHubMode = normalizeLiveHubMode(event.liveHubMode);
  const modules = resolveLiveHubModules({ category, mode: liveHubMode, premiumActive });

  let tournamentPayload: any = null;
  let pairings: Record<number, { id: number; label: string; subLabel?: string | null; avatarUrl?: string | null }> = {};

  if (event.tournament) {
    const structure = await getTournamentStructure(event.tournament.id);
    if (structure) {
      const tieBreakRules = Array.isArray(structure.tieBreakRules)
        ? (structure.tieBreakRules as string[])
        : ["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"];

      const buildMatch = (m: any) => ({
        id: m.id,
        stageId: m.stageId,
        groupId: m.groupId,
        pairing1Id: m.pairing1Id,
        pairing2Id: m.pairing2Id,
        round: m.round,
        roundLabel: m.roundLabel,
        startAt: m.startAt,
        status: m.status,
        statusLabel: summarizeMatchStatus(m.status),
        score: m.score,
        updatedAt: m.updatedAt,
      });

      const stages = structure.stages.map((s) => ({
        id: s.id,
        name: s.name,
        stageType: s.stageType,
        order: s.order,
        groups: s.groups.map((g) => ({
          id: g.id,
          name: g.name,
          standings: computeStandingsForGroup(g.matches, tieBreakRules, structure.generationSeed || undefined),
          matches: g.matches.map(buildMatch),
        })),
        matches: s.matches.filter((m) => !m.groupId).map(buildMatch),
      }));

      const flatMatches = stages.flatMap((s) => [...s.matches, ...s.groups.flatMap((g) => g.matches)]);

      let userPairingId: number | null = null;
      if (userId) {
        const pairing = await prisma.padelPairing.findFirst({
          where: { eventId: event.id, OR: [{ player1UserId: userId }, { player2UserId: userId }] },
          select: { id: true },
        });
        if (pairing?.id) {
          userPairingId = pairing.id;
        } else if (ticket?.tournamentEntryId) {
          userPairingId = ticket.tournamentEntryId;
        } else {
          const entry = await prisma.tournamentEntry.findFirst({
            where: { eventId: event.id, userId },
            select: { id: true },
          });
          userPairingId = entry?.id ?? null;
        }
      }

      const nextMatch =
        userPairingId !== null
          ? flatMatches
              .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status !== "DONE")
              .sort((a, b) =>
                a.startAt && b.startAt ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime() : 0,
              )[0] ?? null
          : null;

      const lastMatch =
        userPairingId !== null
          ? flatMatches
              .filter((m) => (m.pairing1Id === userPairingId || m.pairing2Id === userPairingId) && m.status === "DONE")
              .sort((a, b) =>
                a.startAt && b.startAt ? new Date(b.startAt).getTime() - new Date(a.startAt).getTime() : 0,
              )[0] ?? null
          : null;

      const pairingIds = new Set<number>();
      for (const match of flatMatches) {
        if (typeof match.pairing1Id === "number") pairingIds.add(match.pairing1Id);
        if (typeof match.pairing2Id === "number") pairingIds.add(match.pairing2Id);
      }

      const pairingIdsList = Array.from(pairingIds);
      if (pairingIdsList.length > 0) {
        const padelPairings = await prisma.padelPairing.findMany({
          where: { id: { in: pairingIdsList } },
          select: {
            id: true,
            player1: { select: { fullName: true, username: true, avatarUrl: true } },
            player2: { select: { fullName: true, username: true, avatarUrl: true } },
          },
        });

        for (const pairing of padelPairings) {
          const p1 = pickDisplayName(pairing.player1);
          const p2 = pickDisplayName(pairing.player2);
          const label = p1 && p2 ? `${p1} & ${p2}` : `Dupla #${pairing.id}`;
          const subLabel = p1 && p2 ? "Dupla" : null;
          pairings[pairing.id] = {
            id: pairing.id,
            label,
            subLabel,
            avatarUrl: pairing.player1?.avatarUrl || pairing.player2?.avatarUrl || null,
          };
        }

        const tournamentEntries = await prisma.tournamentEntry.findMany({
          where: { id: { in: pairingIdsList } },
          select: {
            id: true,
            user: { select: { fullName: true, username: true, avatarUrl: true } },
          },
        });

        for (const entry of tournamentEntries) {
          if (pairings[entry.id]) continue;
          const label = pickDisplayName(entry.user) || `Jogador #${entry.id}`;
          const subLabel = entry.user?.username ? `@${entry.user.username}` : null;
          pairings[entry.id] = {
            id: entry.id,
            label,
            subLabel,
            avatarUrl: entry.user?.avatarUrl || null,
          };
        }
      }

      let championPairingId: number | null = null;
      const playoffStages = stages.filter((s) => s.stageType === "PLAYOFF");
      const playoffMatches = playoffStages.flatMap((s) => s.matches);
      if (playoffMatches.length > 0) {
        const maxRound = Math.max(...playoffMatches.map((m) => m.round ?? 0));
        const finalMatch = playoffMatches
          .filter((m) => (m.round ?? 0) === maxRound)
          .sort((a, b) => b.id - a.id)[0];

        if (finalMatch?.status === "DONE") {
          const score = finalMatch.score as ScorePayload;
          const result = score?.sets ? validateScore(score) : null;
          if (result && result.ok) {
            championPairingId = result.winner === "A" ? finalMatch.pairing1Id ?? null : finalMatch.pairing2Id ?? null;
          }
        }
      }

      tournamentPayload = {
        id: structure.id,
        format: structure.format,
        stages,
        userPairingId,
        nextMatch,
        lastMatch,
        championPairingId,
      };
    }
  }

  const res = NextResponse.json(
    {
      ok: true,
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        locationName: event.locationName,
        locationCity: event.locationCity,
        coverImageUrl: event.coverImageUrl,
        liveStreamUrl: event.liveStreamUrl,
        liveHubMode,
      },
      organizer: event.organizer
        ? {
            id: event.organizer.id,
            publicName: event.organizer.publicName,
            username: event.organizer.username,
            organizationCategory: event.organizer.organizationCategory,
            brandingAvatarUrl: event.organizer.brandingAvatarUrl,
            liveHubPremiumEnabled: event.organizer.liveHubPremiumEnabled,
          }
        : null,
      viewerRole,
      liveHub: {
        mode: liveHubMode,
        category,
        modules,
      },
      tournament: tournamentPayload,
      pairings,
    },
    { status: 200 },
  );

  res.headers.set("Cache-Control", "public, max-age=8");
  return res;
}
