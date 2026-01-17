/**
 * Padel seed script with club, courts, categories, players, pairings, matches and auto-schedule.
 *
 * Usage:
 *   TS_NODE_COMPILER_OPTIONS='{"allowImportingTsExtensions":true}' USER_ID_TEST=... npx ts-node scripts/seed_padel.ts
 */

import fs from "fs";
import path from "path";
import {
  EventTemplateType,
  FeeMode,
  OrganizationModule,
  OrganizationStatus,
  PadelPairingJoinMode,
  PadelPairingLifecycleStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelPaymentMode,
  PayoutMode,
  Prisma,
  PrismaClient,
  OrganizationMemberRole,
  ResaleMode,
  padel_format,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { computeAutoSchedulePlan } from "../domain/padel/autoSchedule.ts";

const loadEnvFile = (file: string) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL no ambiente.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const ORGANIZATION_USERNAME = "club-padel-demo";
const ORGANIZATION_PUBLIC_NAME = "Clube Padel Demo";
const ORGANIZATION_CITY = "Lisboa";

const MAIN_CLUB_SLUG = "padel-demo-club";
const PARTNER_CLUB_SLUG = "padel-demo-partner";

const MAIN_CLUB_NAME = "Clube Demo";
const PARTNER_CLUB_NAME = "Clube Parceiro";

const MAIN_COURTS_COUNT = 4;
const PARTNER_COURTS_COUNT = 2;

const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_SLOT_MINUTES = 15;
const DEFAULT_BUFFER_MINUTES = 5;
const DEFAULT_REST_MINUTES = 10;

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

const buildEventWindow = (daysAhead = 14, startHour = 9, durationHours = 8) => {
  const start = new Date();
  start.setDate(start.getDate() + daysAhead);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return { start, end };
};

const roundRobinSchedule = (ids: number[]) => {
  const teams = [...ids];
  if (teams.length % 2 !== 0) teams.push(-1);
  const n = teams.length;
  const rounds: Array<Array<{ a: number; b: number }>> = [];
  for (let round = 0; round < n - 1; round += 1) {
    const pairings: Array<{ a: number; b: number }> = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (a === -1 || b === -1) continue;
      pairings.push({ a, b });
    }
    rounds.push(pairings);
    const fixed = teams[0];
    const rest = teams.slice(1);
    rest.unshift(rest.pop() as number);
    teams.splice(0, teams.length, fixed, ...rest);
  }
  return rounds;
};

const splitIntoGroups = (ids: number[], groupSize: number) => {
  const groups: number[][] = [];
  for (let i = 0; i < ids.length; i += groupSize) {
    groups.push(ids.slice(i, i + groupSize));
  }
  return groups;
};

const ensureClub = async ({
  organizationId,
  name,
  slug,
  city,
  address,
  courtsCount,
  isDefault,
}: {
  organizationId: number;
  name: string;
  slug: string;
  city: string;
  address: string;
  courtsCount: number;
  isDefault: boolean;
}) => {
  const existing = await prisma.padelClub.findUnique({ where: { slug } });
  if (existing) {
    return prisma.padelClub.update({
      where: { id: existing.id },
      data: {
        organizationId,
        name,
        city,
        address,
        courtsCount,
        isDefault,
        isActive: true,
      },
    });
  }
  return prisma.padelClub.create({
    data: {
      organizationId,
      name,
      slug,
      city,
      address,
      courtsCount,
      isDefault,
      isActive: true,
    },
  });
};

const ensureCourts = async ({
  padelClubId,
  count,
  baseName,
  surface,
  indoorEvery,
}: {
  padelClubId: number;
  count: number;
  baseName: string;
  surface: string;
  indoorEvery: number;
}) => {
  const existing = await prisma.padelClubCourt.findMany({
    where: { padelClubId },
    orderBy: { displayOrder: "asc" },
  });
  const courts = [] as Awaited<ReturnType<typeof prisma.padelClubCourt.create>>[];
  for (let idx = 0; idx < count; idx += 1) {
    const name = `${baseName} ${idx + 1}`;
    const indoor = indoorEvery > 0 ? idx % indoorEvery === 0 : false;
    const data = {
      name,
      surface,
      indoor,
      displayOrder: idx,
      isActive: true,
    };
    const existingCourt = existing[idx];
    if (existingCourt) {
      const updated = await prisma.padelClubCourt.update({
        where: { id: existingCourt.id },
        data,
      });
      courts.push(updated);
    } else {
      const created = await prisma.padelClubCourt.create({
        data: { padelClubId, ...data },
      });
      courts.push(created);
    }
  }
  return courts.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
};

const ensureCategory = async ({
  organizationId,
  label,
  minLevel,
  maxLevel,
  genderRestriction,
}: {
  organizationId: number;
  label: string;
  minLevel: string;
  maxLevel: string;
  genderRestriction: string;
}) => {
  const existing = await prisma.padelCategory.findFirst({
    where: { organizationId, label },
  });
  if (existing) {
    return prisma.padelCategory.update({
      where: { id: existing.id },
      data: {
        minLevel,
        maxLevel,
        genderRestriction,
        isActive: true,
      },
    });
  }
  return prisma.padelCategory.create({
    data: {
      organizationId,
      label,
      minLevel,
      maxLevel,
      genderRestriction,
      isActive: true,
    },
  });
};

const seedPlayers = async (organizationId: number) => {
  const playersData = Array.from({ length: 16 }).map((_, idx) => {
    const num = idx + 1;
    const level = num <= 8 ? "M3" : "M4";
    return {
      fullName: `Player ${num}`,
      email: `padel.player${String(num).padStart(2, "0")}@example.com`,
      level,
    };
  });
  const players = [] as Awaited<ReturnType<typeof prisma.padelPlayerProfile.create>>[];
  for (const player of playersData) {
    const existing = await prisma.padelPlayerProfile.findFirst({
      where: { organizationId, email: player.email },
    });
    if (existing) {
      const updated = await prisma.padelPlayerProfile.update({
        where: { id: existing.id },
        data: {
          fullName: player.fullName,
          level: player.level,
        },
      });
      players.push(updated);
    } else {
      const created = await prisma.padelPlayerProfile.create({
        data: {
          organizationId,
          fullName: player.fullName,
          email: player.email,
          level: player.level,
        },
      });
      players.push(created);
    }
  }
  return players;
};

const createPairings = async ({
  eventId,
  organizationId,
  categoryId,
  players,
  createdByUserId,
}: {
  eventId: number;
  organizationId: number;
  categoryId: number;
  players: Awaited<ReturnType<typeof prisma.padelPlayerProfile.findMany>>;
  createdByUserId: string;
}) => {
  const pairings = [] as Array<{ id: number; categoryId: number }>;
  for (let i = 0; i < players.length; i += 2) {
    const playerA = players[i];
    const playerB = players[i + 1];
    if (!playerA || !playerB) continue;
    const pairing = await prisma.padelPairing.create({
      data: {
        eventId,
        organizationId,
        categoryId,
        payment_mode: PadelPaymentMode.FULL,
        pairingStatus: PadelPairingStatus.COMPLETE,
        lifecycleStatus: PadelPairingLifecycleStatus.CONFIRMED_BOTH_PAID,
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        createdByUserId,
        slots: {
          create: [
            {
              slot_role: PadelPairingSlotRole.CAPTAIN,
              slotStatus: PadelPairingSlotStatus.FILLED,
              paymentStatus: PadelPairingPaymentStatus.PAID,
              playerProfileId: playerA.id,
            },
            {
              slot_role: PadelPairingSlotRole.PARTNER,
              slotStatus: PadelPairingSlotStatus.FILLED,
              paymentStatus: PadelPairingPaymentStatus.PAID,
              playerProfileId: playerB.id,
            },
          ],
        },
      },
    });
    pairings.push({ id: pairing.id, categoryId });
  }
  return pairings;
};

async function main() {
  const userId = process.env.USER_ID_TEST;
  if (!userId) throw new Error("Define USER_ID_TEST com o id do utilizador (auth.users.id).");

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, roles: true },
  });
  if (!profile) {
    throw new Error(`Utilizador não encontrado para USER_ID_TEST=${userId}.`);
  }

  const existingOrganization = await prisma.organization.findFirst({
    where: { username: ORGANIZATION_USERNAME },
  });
  const organization = existingOrganization
    ? await prisma.organization.update({
        where: { id: existingOrganization.id },
        data: {
          publicName: ORGANIZATION_PUBLIC_NAME,
          businessName: ORGANIZATION_PUBLIC_NAME,
          city: ORGANIZATION_CITY,
          entityType: "CLUBE",
          status: OrganizationStatus.ACTIVE,
          primaryModule: OrganizationModule.TORNEIOS,
        },
      })
    : await prisma.organization.create({
        data: {
          username: ORGANIZATION_USERNAME,
          publicName: ORGANIZATION_PUBLIC_NAME,
          businessName: ORGANIZATION_PUBLIC_NAME,
          city: ORGANIZATION_CITY,
          entityType: "CLUBE",
          status: OrganizationStatus.ACTIVE,
          primaryModule: OrganizationModule.TORNEIOS,
        },
      });

  const memberExists = await prisma.organizationMember.findFirst({
    where: { organizationId: organization.id, userId },
  });
  if (!memberExists) {
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId,
        role: OrganizationMemberRole.OWNER,
        invitedByUserId: userId,
      },
    });
  }

  if (!profile.roles.includes("organization")) {
    await prisma.profile.update({
      where: { id: userId },
      data: { roles: Array.from(new Set([...profile.roles, "organization"])) },
    });
  }

  const mainClub = await ensureClub({
    organizationId: organization.id,
    name: MAIN_CLUB_NAME,
    slug: MAIN_CLUB_SLUG,
    city: ORGANIZATION_CITY,
    address: "Rua do Padel, 123",
    courtsCount: MAIN_COURTS_COUNT,
    isDefault: true,
  });

  const partnerClub = await ensureClub({
    organizationId: organization.id,
    name: PARTNER_CLUB_NAME,
    slug: PARTNER_CLUB_SLUG,
    city: ORGANIZATION_CITY,
    address: "Avenida Parceiro, 45",
    courtsCount: PARTNER_COURTS_COUNT,
    isDefault: false,
  });

  const mainCourts = await ensureCourts({
    padelClubId: mainClub.id,
    count: MAIN_COURTS_COUNT,
    baseName: "Campo",
    surface: "Mondo",
    indoorEvery: 3,
  });

  const partnerCourts = await ensureCourts({
    padelClubId: partnerClub.id,
    count: PARTNER_COURTS_COUNT,
    baseName: "Campo",
    surface: "Vidro",
    indoorEvery: 2,
  });

  await prisma.padelClub.update({
    where: { id: mainClub.id },
    data: { courtsCount: mainCourts.length },
  });
  await prisma.padelClub.update({
    where: { id: partnerClub.id },
    data: { courtsCount: partnerCourts.length },
  });

  const categoryM3 = await ensureCategory({
    organizationId: organization.id,
    label: "M3",
    minLevel: "M3",
    maxLevel: "M3",
    genderRestriction: "MALE",
  });
  const categoryM4 = await ensureCategory({
    organizationId: organization.id,
    label: "M4",
    minLevel: "M4",
    maxLevel: "M4",
    genderRestriction: "MALE",
  });

  const { start: eventStart, end: eventEnd } = buildEventWindow();
  const eventSlug = `padel-seed-${randomSuffix()}`;

  const event = await prisma.event.create({
    data: {
      slug: eventSlug,
      title: "Torneio Padel Demo",
      description: "Seed de teste Padel",
      type: "ORGANIZATION_EVENT",
      templateType: EventTemplateType.PADEL,
      ownerUserId: userId,
      organizationId: organization.id,
      startsAt: eventStart,
      endsAt: eventEnd,
      locationName: MAIN_CLUB_NAME,
      locationCity: ORGANIZATION_CITY,
      isFree: true,
      status: "PUBLISHED",
      resaleMode: ResaleMode.ALWAYS,
      feeMode: FeeMode.INCLUDED,
      payoutMode: PayoutMode.ORGANIZATION,
    },
  });

  const allCourts = [...mainCourts, ...partnerCourts];
  const courtsFromClubs = allCourts.map((court, idx) => ({
    name: court.name,
    clubName: court.padelClubId === mainClub.id ? MAIN_CLUB_NAME : PARTNER_CLUB_NAME,
    displayOrder: idx,
  }));

  await prisma.padelTournamentConfig.create({
    data: {
      eventId: event.id,
      organizationId: organization.id,
      format: padel_format.GRUPOS_ELIMINATORIAS,
      numberOfCourts: Math.max(1, allCourts.length),
      padelV2Enabled: true,
      padelClubId: mainClub.id,
      partnerClubIds: [partnerClub.id],
      defaultCategoryId: categoryM3.id,
      advancedSettings: {
        courtsFromClubs,
        courtIds: allCourts.map((court) => court.id),
        gameDurationMinutes: DEFAULT_DURATION_MINUTES,
        scheduleDefaults: {
          windowStart: eventStart.toISOString(),
          windowEnd: eventEnd.toISOString(),
          durationMinutes: DEFAULT_DURATION_MINUTES,
          slotMinutes: DEFAULT_SLOT_MINUTES,
          bufferMinutes: DEFAULT_BUFFER_MINUTES,
          minRestMinutes: DEFAULT_REST_MINUTES,
          priority: "GROUPS_FIRST",
        },
      },
    },
  });

  const linkM3 = await prisma.padelEventCategoryLink.findFirst({
    where: { eventId: event.id, padelCategoryId: categoryM3.id },
  });
  if (linkM3) {
    await prisma.padelEventCategoryLink.update({
      where: { id: linkM3.id },
      data: { format: padel_format.GRUPOS_ELIMINATORIAS, isEnabled: true },
    });
  } else {
    await prisma.padelEventCategoryLink.create({
      data: {
        eventId: event.id,
        padelCategoryId: categoryM3.id,
        format: padel_format.GRUPOS_ELIMINATORIAS,
        capacityTeams: 8,
        isEnabled: true,
      },
    });
  }

  const linkM4 = await prisma.padelEventCategoryLink.findFirst({
    where: { eventId: event.id, padelCategoryId: categoryM4.id },
  });
  if (linkM4) {
    await prisma.padelEventCategoryLink.update({
      where: { id: linkM4.id },
      data: { format: padel_format.GRUPOS_ELIMINATORIAS, isEnabled: true },
    });
  } else {
    await prisma.padelEventCategoryLink.create({
      data: {
        eventId: event.id,
        padelCategoryId: categoryM4.id,
        format: padel_format.GRUPOS_ELIMINATORIAS,
        capacityTeams: 8,
        isEnabled: true,
      },
    });
  }

  const ticketDefs: Array<{ name: string; linkId: number | null }> = [
    { name: "Entrada gratuita M3", linkId: linkM3?.id ?? null },
    { name: "Entrada gratuita M4", linkId: linkM4?.id ?? null },
  ];
  for (const ticket of ticketDefs) {
    const existingTicket = await prisma.ticketType.findFirst({
      where: {
        eventId: event.id,
        padelEventCategoryLinkId: ticket.linkId,
      },
    });
    if (existingTicket) {
      await prisma.ticketType.update({
        where: { id: existingTicket.id },
        data: { name: ticket.name, price: 0, totalQuantity: null, status: "ON_SALE" },
      });
    } else {
      await prisma.ticketType.create({
        data: {
          eventId: event.id,
          name: ticket.name,
          price: 0,
          currency: "EUR",
          totalQuantity: null,
          padelEventCategoryLinkId: ticket.linkId,
          status: "ON_SALE",
        },
      });
    }
  }

  const players = await seedPlayers(organization.id);
  const playersM3 = players.filter((player) => player.level === "M3");
  const playersM4 = players.filter((player) => player.level === "M4");

  const pairingsM3 = await createPairings({
    eventId: event.id,
    organizationId: organization.id,
    categoryId: categoryM3.id,
    players: playersM3,
    createdByUserId: userId,
  });
  const pairingsM4 = await createPairings({
    eventId: event.id,
    organizationId: organization.id,
    categoryId: categoryM4.id,
    players: playersM4,
    createdByUserId: userId,
  });

  const matchCreateData: Prisma.PadelMatchCreateManyInput[] = [];
  const groupedPairings = [
    { categoryId: categoryM3.id, pairingIds: pairingsM3.map((p) => p.id) },
    { categoryId: categoryM4.id, pairingIds: pairingsM4.map((p) => p.id) },
  ];

  groupedPairings.forEach((group) => {
    const pairingIds = group.pairingIds;
    if (pairingIds.length < 2) return;
    const groupSize = pairingIds.length >= 4 ? 4 : pairingIds.length;
    const groups = splitIntoGroups(pairingIds, groupSize);
    groups.forEach((groupIds, groupIdx) => {
      const label = String.fromCharCode("A".charCodeAt(0) + groupIdx);
      const rounds = roundRobinSchedule(groupIds);
      rounds.forEach((round, roundIdx) => {
        round.forEach((pair) => {
          matchCreateData.push({
            eventId: event.id,
            categoryId: group.categoryId,
            pairingAId: pair.a,
            pairingBId: pair.b,
            status: "PENDING",
            plannedDurationMinutes: DEFAULT_DURATION_MINUTES,
            roundLabel: `Jornada ${roundIdx + 1}`,
            roundType: "GROUPS",
            groupLabel: label,
          });
        });
      });
    });
  });

  if (matchCreateData.length > 0) {
    await prisma.padelMatch.createMany({ data: matchCreateData });
  }

  const matches = await prisma.padelMatch.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      plannedDurationMinutes: true,
      plannedStartAt: true,
      plannedEndAt: true,
      startTime: true,
      courtId: true,
      pairingAId: true,
      pairingBId: true,
      roundLabel: true,
      roundType: true,
      groupLabel: true,
    },
    orderBy: { id: "asc" },
  });

  const pairingIds = Array.from(
    new Set(
      matches
        .flatMap((match) => [match.pairingAId, match.pairingBId])
        .filter((id): id is number => typeof id === "number"),
    ),
  );

  const pairings = pairingIds.length
    ? await prisma.padelPairing.findMany({
        where: { id: { in: pairingIds } },
        select: {
          id: true,
          slots: {
            select: {
              playerProfileId: true,
              playerProfile: { select: { email: true } },
            },
          },
        },
      })
    : [];

  const pairingPlayers = new Map<number, { profileIds: number[]; emails: string[] }>();
  pairings.forEach((pairing) => {
    const profileIds = new Set<number>();
    const emails = new Set<string>();
    pairing.slots.forEach((slot) => {
      if (slot.playerProfileId) profileIds.add(slot.playerProfileId);
      const email = slot.playerProfile?.email?.trim().toLowerCase();
      if (email) emails.add(email);
    });
    pairingPlayers.set(pairing.id, {
      profileIds: Array.from(profileIds),
      emails: Array.from(emails),
    });
  });

  const scheduleResult = computeAutoSchedulePlan({
    unscheduledMatches: matches.map((match) => ({
      id: match.id,
      plannedDurationMinutes: match.plannedDurationMinutes,
      courtId: match.courtId,
      pairingAId: match.pairingAId,
      pairingBId: match.pairingBId,
      roundLabel: match.roundLabel,
      roundType: match.roundType,
      groupLabel: match.groupLabel,
    })),
    scheduledMatches: [],
    courts: allCourts.map((court) => ({ id: court.id, name: court.name })),
    pairingPlayers,
    availabilities: [],
    courtBlocks: [],
    config: {
      windowStart: eventStart,
      windowEnd: eventEnd,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      slotMinutes: DEFAULT_SLOT_MINUTES,
      bufferMinutes: DEFAULT_BUFFER_MINUTES,
      minRestMinutes: DEFAULT_REST_MINUTES,
      priority: "GROUPS_FIRST",
    },
  });

  if (scheduleResult.scheduled.length > 0) {
    await prisma.$transaction(
      scheduleResult.scheduled.map((update) =>
        prisma.padelMatch.update({
          where: { id: update.matchId },
          data: {
            plannedStartAt: update.start,
            plannedEndAt: update.end,
            plannedDurationMinutes: update.durationMinutes,
            courtId: update.courtId,
          },
        }),
      ),
    );
  }

  console.log("Padel seed ready", {
    organizationId: organization.id,
    eventId: event.id,
    eventSlug,
    mainClubId: mainClub.id,
    partnerClubId: partnerClub.id,
    courts: allCourts.length,
    pairings: pairingsM3.length + pairingsM4.length,
    matches: matchCreateData.length,
    scheduled: scheduleResult.scheduled.length,
    skipped: scheduleResult.skipped.length,
  });
  console.log("Open:", `/organizacao/torneios?eventId=${event.id}`);
  console.log("Public:", `/eventos/${eventSlug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
