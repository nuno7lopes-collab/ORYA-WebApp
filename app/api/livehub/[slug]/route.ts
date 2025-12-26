import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ORGANIZATION_CATEGORY } from "@/lib/organizationCategories";
import { normalizeLiveHubMode, resolveLiveHubModules } from "@/lib/liveHubConfig";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { getTournamentStructure } from "@/domain/tournaments/structureData";
import { getWinnerSideFromScore, type MatchScorePayload } from "@/domain/tournaments/matchRules";
import { canScanTickets } from "@/lib/organizerAccess";
import { normalizeEmail } from "@/lib/utils/email";
import { sanitizeUsername } from "@/lib/username";

const ONEVONE_ORGANIZER_ID = 23;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickDisplayName(profile: { fullName: string | null; username: string | null } | null) {
  return profile?.fullName || (profile?.username ? `@${profile.username}` : null);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const slug = resolved?.slug;
  if (!slug) return NextResponse.json({ ok: false, error: "INVALID_SLUG" }, { status: 400 });

  try {
    let event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        templateType: true,
        startsAt: true,
        endsAt: true,
        status: true,
        locationName: true,
        locationCity: true,
        coverImageUrl: true,
        organizerId: true,
        liveHubMode: true,
        liveHubVisibility: true,
        liveStreamUrl: true,
        timezone: true,
        inviteOnly: true,
        publicAccessMode: true,
        participantAccessMode: true,
        publicTicketTypeIds: true,
        participantTicketTypeIds: true,
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

    if (!event) {
      const normalized = slugify(slug);
      if (normalized && normalized !== slug) {
        event = await prisma.event.findUnique({
          where: { slug: normalized },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            templateType: true,
            startsAt: true,
            endsAt: true,
            status: true,
            locationName: true,
            locationCity: true,
            coverImageUrl: true,
            organizerId: true,
            liveHubMode: true,
            liveHubVisibility: true,
            liveStreamUrl: true,
            timezone: true,
            inviteOnly: true,
            publicAccessMode: true,
            participantAccessMode: true,
            publicTicketTypeIds: true,
            participantTicketTypeIds: true,
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
      }
    }
    if (!event) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;

  const tickets = userId
    ? await prisma.ticket.findMany({
        where: {
          eventId: event.id,
          status: "ACTIVE",
          OR: [{ userId }, { ownerUserId: userId }],
        },
        select: { id: true, ticketTypeId: true, tournamentEntryId: true },
      })
    : [];

  let isOrganizer = false;
  if (userId && event.organizerId) {
    const access = await canScanTickets(userId, event.id);
    isOrganizer = access.allowed;
  }

  const profile = userId
    ? await prisma.profile.findUnique({
        where: { id: userId },
        select: { username: true },
      })
    : null;
  const userEmailNormalized = authData?.user?.email ? normalizeEmail(authData.user.email) : null;
  const usernameNormalized = profile?.username ? sanitizeUsername(profile.username) : null;
  const inviteIdentifiers = [userEmailNormalized, usernameNormalized].filter(Boolean) as string[];
  const inviteWhere = {
    eventId: event.id,
    OR: [
      userId ? { targetUserId: userId } : undefined,
      inviteIdentifiers.length > 0 ? { targetIdentifier: { in: inviteIdentifiers } } : undefined,
    ].filter(Boolean) as Array<Record<string, unknown>>,
  };
  const [publicInviteMatch, participantInviteMatch] =
    userId || inviteIdentifiers.length > 0
      ? await Promise.all([
          prisma.eventInvite.findFirst({
            where: { ...inviteWhere, scope: "PUBLIC" },
            select: { id: true },
          }),
          prisma.eventInvite.findFirst({
            where: { ...inviteWhere, scope: "PARTICIPANT" },
            select: { id: true },
          }),
        ])
      : [null, null];
  const isParticipantInvited = Boolean(participantInviteMatch);

  const publicAccessMode = event.publicAccessMode ?? (event.inviteOnly ? "INVITE" : "OPEN");
  const participantAccessMode = event.participantAccessMode ?? "NONE";
  const publicTicketTypeIds = event.publicTicketTypeIds ?? [];
  const participantTicketTypeIds = event.participantTicketTypeIds ?? [];
  const hasAnyTicket = tickets.length > 0;
  const ticketMatches = (ids: number[]) =>
    ids.length === 0 ? hasAnyTicket : tickets.some((t) => ids.includes(t.ticketTypeId));

  const hasInscription =
    Boolean(
      userId &&
        (await prisma.tournamentEntry.findFirst({ where: { eventId: event.id, userId }, select: { id: true } })),
    ) || tickets.some((t) => Boolean(t.tournamentEntryId));

  const isParticipant =
    participantAccessMode === "NONE"
      ? false
      : participantAccessMode === "TICKET"
        ? ticketMatches(participantTicketTypeIds)
        : participantAccessMode === "INSCRIPTION"
          ? hasInscription
          : participantAccessMode === "INVITE"
            ? isParticipantInvited
            : false;

  const viewerRole = isOrganizer ? "ORGANIZER" : isParticipant ? "PARTICIPANT" : "PUBLIC";
  const liveHubVisibility = event.liveHubVisibility ?? "PUBLIC";
  const liveHubAllowed =
    liveHubVisibility === "PUBLIC"
      ? true
      : liveHubVisibility === "PRIVATE"
        ? isOrganizer || isParticipant
        : false;

  const category = event.organizer?.organizationCategory ?? DEFAULT_ORGANIZATION_CATEGORY;
  const premiumActive = Boolean(
    event.organizer?.liveHubPremiumEnabled && event.organizer?.id === ONEVONE_ORGANIZER_ID,
  );
  const liveHubMode = normalizeLiveHubMode(event.liveHubMode);
  const modules = resolveLiveHubModules({ category, mode: liveHubMode, premiumActive });
  const liveHubModules =
    event.organizer?.id === ONEVONE_ORGANIZER_ID
      ? ["HERO", "VIDEO", "NOW_PLAYING", "NEXT_MATCHES", "RESULTS", "BRACKET", "SPONSORS"]
      : modules;

  let tournamentPayload: any = null;
  let pairings: Record<
    number,
    {
      id: number;
      label: string;
      subLabel?: string | null;
      avatarUrl?: string | null;
      profileUsername?: string | null;
      href?: string | null;
    }
  > = {};

  if (event.tournament) {
    const structure = await getTournamentStructure(event.tournament.id);
    const configRes = await prisma.tournament.findUnique({
      where: { id: event.tournament.id },
      select: { config: true },
    });
    const config = (configRes?.config as Record<string, unknown> | null) ?? {};
    const manualParticipants = Array.isArray(config.manualParticipants)
      ? (config.manualParticipants as Array<Record<string, unknown>>)
      : [];
    const liveSponsors = (config.liveSponsors as Record<string, unknown> | null) ?? null;
    const featuredMatchId =
      typeof (config as Record<string, unknown>).featuredMatchId === "number"
        ? (config as Record<string, unknown>).featuredMatchId
        : null;
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
        courtId: m.courtId,
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
        } else {
          const ticketEntryId = tickets.find((t) => Boolean(t.tournamentEntryId))?.tournamentEntryId ?? null;
          if (ticketEntryId) {
            userPairingId = ticketEntryId;
          } else {
            const entry = await prisma.tournamentEntry.findFirst({
              where: { eventId: event.id, userId },
              select: { id: true },
            });
            userPairingId = entry?.id ?? null;
          }
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
          const normalizedUsername = entry.user?.username ? sanitizeUsername(entry.user.username) : null;
          const subLabel = normalizedUsername ? `@${normalizedUsername}` : null;
          pairings[entry.id] = {
            id: entry.id,
            label,
            subLabel,
            avatarUrl: entry.user?.avatarUrl || null,
            profileUsername: normalizedUsername,
            href: normalizedUsername ? `/${normalizedUsername}` : null,
          };
        }

        for (const raw of manualParticipants) {
          const id = Number.isFinite(raw.id) ? Number(raw.id) : null;
          if (!id || pairings[id] || !pairingIdsList.includes(id)) continue;
          const name = typeof raw.name === "string" ? raw.name.trim() : "";
          if (!name) continue;
          const username = typeof raw.username === "string" ? sanitizeUsername(raw.username) : null;
          const subLabel = username ? `@${username}` : null;
          const avatarUrl = typeof raw.avatarUrl === "string" ? raw.avatarUrl : null;
          pairings[id] = {
            id,
            label: name,
            subLabel,
            avatarUrl,
            profileUsername: username,
            href: username ? `/${username}` : null,
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
          const winner = getWinnerSideFromScore(finalMatch.score as MatchScorePayload);
          if (winner) {
            championPairingId = winner === "A" ? finalMatch.pairing1Id ?? null : finalMatch.pairing2Id ?? null;
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
        featuredMatchId,
        sponsors: liveSponsors,
        goalLimits: (config as Record<string, unknown>).goalLimits ?? null,
      };
    }
  }

  let organizerFollowed = false;
  if (userId && event.organizer?.id) {
    const follow = await prisma.organizer_follows.findUnique({
      where: {
        follower_id_organizer_id: {
          follower_id: userId,
          organizer_id: event.organizer.id,
        },
      },
      select: { organizer_id: true },
    });
    organizerFollowed = Boolean(follow);
  }

    const res = NextResponse.json(
      {
        ok: true,
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
          description: event.description,
          templateType: event.templateType,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          status: event.status,
          locationName: event.locationName,
          locationCity: event.locationCity,
          coverImageUrl: event.coverImageUrl,
          liveStreamUrl: event.liveStreamUrl,
          timezone: event.timezone,
          liveHubMode,
          liveHubVisibility,
          publicAccessMode,
          participantAccessMode,
          publicTicketTypeIds,
          participantTicketTypeIds,
        },
        organizer: event.organizer
          ? {
              id: event.organizer.id,
              publicName: event.organizer.publicName,
              username: event.organizer.username,
              organizationCategory: event.organizer.organizationCategory,
              brandingAvatarUrl: event.organizer.brandingAvatarUrl,
              liveHubPremiumEnabled: event.organizer.liveHubPremiumEnabled,
              isFollowed: organizerFollowed,
            }
          : null,
        viewerRole,
        access: {
          publicAccessMode,
          participantAccessMode,
          liveHubVisibility,
          liveHubAllowed,
          isParticipant,
        },
      liveHub: {
        mode: liveHubMode,
        category,
        modules: liveHubModules,
      },
        tournament: tournamentPayload,
        pairings,
      },
      { status: 200 },
    );

    res.headers.set("Cache-Control", "public, max-age=8");
    return res;
  } catch (err) {
    console.error("[livehub] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
