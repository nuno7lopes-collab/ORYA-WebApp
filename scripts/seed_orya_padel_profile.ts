import fs from "node:fs";
import path from "node:path";
import { Gender, PadelPreferredSide, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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
    if (!(key in process.env)) process.env[key] = val;
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL ou DIRECT_URL.");
}

const targetUsername = (process.env.ORYA_USERNAME ?? "orya").trim().toLowerCase();
const targetOrgIdFromEnv = Number(process.env.ORYA_ORG_ID ?? "");
const targetOrgId = Number.isFinite(targetOrgIdFromEnv) ? Math.trunc(targetOrgIdFromEnv) : null;
const seedPhone = (process.env.ORYA_PADEL_PHONE ?? "+351910000051").trim();
const seedGenderRaw = (process.env.ORYA_PADEL_GENDER ?? "MALE").trim().toUpperCase();
const seedLevel = (process.env.ORYA_PADEL_LEVEL ?? "M3").trim();
const seedPreferredSideRaw = (process.env.ORYA_PADEL_SIDE ?? "DIREITA").trim().toUpperCase();
const seedClubName = (process.env.ORYA_PADEL_CLUB ?? "Top Padel").trim();
const seedRating = Number(process.env.ORYA_PADEL_RATING ?? 1625);
const seedRd = Number(process.env.ORYA_PADEL_RD ?? 95);
const seedSigma = Number(process.env.ORYA_PADEL_SIGMA ?? 0.06);
const seedMatchesPlayed = Number(process.env.ORYA_PADEL_MATCHES ?? 18);
const seedRankingPoints = Number(process.env.ORYA_PADEL_POINTS ?? Math.round(seedRating));
const forcedEventId = Number(process.env.ORYA_PADEL_EVENT_ID ?? "");

if (!Object.values(Gender).includes(seedGenderRaw as Gender)) {
  throw new Error(`ORYA_PADEL_GENDER invalido: ${seedGenderRaw}`);
}
if (!Object.values(PadelPreferredSide).includes(seedPreferredSideRaw as PadelPreferredSide)) {
  throw new Error(`ORYA_PADEL_SIDE invalido: ${seedPreferredSideRaw}`);
}

const seedGender = seedGenderRaw as Gender;
const seedPreferredSide = seedPreferredSideRaw as PadelPreferredSide;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function resolveOrganizationId(userId: string, activeOrganizationId: number | null) {
  if (targetOrgId && targetOrgId > 0) {
    const org = await prisma.organization.findUnique({
      where: { id: targetOrgId },
      select: { id: true },
    });
    if (!org) throw new Error(`ORYA_ORG_ID nao encontrado: ${targetOrgId}`);
    return org.id;
  }

  if (activeOrganizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: activeOrganizationId },
      select: { id: true },
    });
    if (org) return org.id;
  }

  const memberships = await prisma.organizationGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
    orderBy: { createdAt: "asc" },
  });
  const groupIds = memberships.map((member) => member.groupId);
  if (!groupIds.length) throw new Error("Sem organizationGroupMember para o user.");

  const org = await prisma.organization.findFirst({
    where: { groupId: { in: groupIds }, status: "ACTIVE" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!org) throw new Error("Sem organizacao ativa para o user.");
  return org.id;
}

async function resolveEventId(organizationId: number) {
  if (Number.isFinite(forcedEventId) && forcedEventId > 0) return Math.trunc(forcedEventId);
  const now = new Date();
  const candidate = await prisma.event.findFirst({
    where: {
      organizationId,
      isDeleted: false,
      templateType: "PADEL",
      startsAt: { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, startsAt: true },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  return candidate?.id ?? null;
}

async function main() {
  const profile = await prisma.profile.findFirst({
    where: { username: { equals: targetUsername, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      fullName: true,
      contactPhone: true,
      gender: true,
      padelLevel: true,
      padelPreferredSide: true,
      padelClubName: true,
      activeOrganizationId: true,
    },
  });
  if (!profile) {
    throw new Error(`Profile nao encontrado para username=${targetUsername}`);
  }

  const authUser = await prisma.users.findUnique({
    where: { id: profile.id },
    select: { email: true },
  });
  const organizationId = await resolveOrganizationId(profile.id, profile.activeOrganizationId ?? null);

  const updatedProfile = await prisma.profile.update({
    where: { id: profile.id },
    data: {
      contactPhone: profile.contactPhone ?? seedPhone,
      gender: profile.gender ?? seedGender,
      padelLevel: profile.padelLevel ?? seedLevel,
      padelPreferredSide: profile.padelPreferredSide ?? seedPreferredSide,
      padelClubName: profile.padelClubName ?? seedClubName,
      onboardingDone: true,
      activeOrganizationId: profile.activeOrganizationId ?? organizationId,
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      contactPhone: true,
      gender: true,
      padelLevel: true,
      padelPreferredSide: true,
      padelClubName: true,
      activeOrganizationId: true,
    },
  });

  const resolvedName = (updatedProfile.fullName ?? updatedProfile.username ?? "ORYA").trim();
  const playerData = {
    organizationId,
    userId: updatedProfile.id,
    fullName: resolvedName,
    displayName: resolvedName,
    email: authUser?.email ?? undefined,
    phone: updatedProfile.contactPhone ?? undefined,
    gender: updatedProfile.gender ?? undefined,
    level: updatedProfile.padelLevel ?? seedLevel,
    preferredSide: updatedProfile.padelPreferredSide ?? seedPreferredSide,
    clubName: updatedProfile.padelClubName ?? seedClubName,
    isActive: true,
  };

  const existingPlayer = await prisma.padelPlayerProfile.findFirst({
    where: { organizationId, userId: updatedProfile.id },
    select: { id: true },
  });
  const player = existingPlayer
    ? await prisma.padelPlayerProfile.update({
        where: { id: existingPlayer.id },
        data: playerData,
        select: { id: true, organizationId: true, fullName: true, level: true, preferredSide: true, clubName: true },
      })
    : await prisma.padelPlayerProfile.create({
        data: playerData,
        select: { id: true, organizationId: true, fullName: true, level: true, preferredSide: true, clubName: true },
      });

  const rating = await prisma.padelRatingProfile.upsert({
    where: { playerId: player.id },
    update: {
      organizationId,
      rating: Number.isFinite(seedRating) ? seedRating : 1625,
      rd: Number.isFinite(seedRd) ? seedRd : 95,
      sigma: Number.isFinite(seedSigma) ? seedSigma : 0.06,
      matchesPlayed: Number.isFinite(seedMatchesPlayed) ? Math.max(0, Math.trunc(seedMatchesPlayed)) : 18,
      leaderboardEligible: true,
      blockedNewMatches: false,
      suspensionEndsAt: null,
      lastActivityAt: new Date(),
      lastMatchAt: new Date(),
      metadata: {
        seedSource: "seed_orya_padel_profile",
        testRanking: true,
        username: targetUsername,
      },
    },
    create: {
      organizationId,
      playerId: player.id,
      rating: Number.isFinite(seedRating) ? seedRating : 1625,
      rd: Number.isFinite(seedRd) ? seedRd : 95,
      sigma: Number.isFinite(seedSigma) ? seedSigma : 0.06,
      matchesPlayed: Number.isFinite(seedMatchesPlayed) ? Math.max(0, Math.trunc(seedMatchesPlayed)) : 18,
      leaderboardEligible: true,
      blockedNewMatches: false,
      suspensionEndsAt: null,
      lastActivityAt: new Date(),
      lastMatchAt: new Date(),
      metadata: {
        seedSource: "seed_orya_padel_profile",
        testRanking: true,
        username: targetUsername,
      },
    },
    select: {
      id: true,
      rating: true,
      rd: true,
      sigma: true,
      matchesPlayed: true,
      leaderboardEligible: true,
      lastActivityAt: true,
    },
  });

  const rankingEventId = await resolveEventId(organizationId);
  let rankingEntry: null | {
    id: number;
    eventId: number;
    points: number;
    position: number | null;
    level: string | null;
    season: string | null;
    year: number | null;
  } = null;

  if (rankingEventId) {
    const rankingEvent = await prisma.event.findUnique({
      where: { id: rankingEventId },
      select: { id: true, startsAt: true },
    });
    if (rankingEvent) {
      const year = rankingEvent.startsAt?.getUTCFullYear() ?? new Date().getUTCFullYear();
      const points = Number.isFinite(seedRankingPoints) ? Math.max(0, Math.trunc(seedRankingPoints)) : Math.round(rating.rating);
      const existingEntry = await prisma.padelRankingEntry.findFirst({
        where: { eventId: rankingEvent.id, playerId: player.id },
        select: { id: true },
      });
      rankingEntry = existingEntry
        ? await prisma.padelRankingEntry.update({
            where: { id: existingEntry.id },
            data: {
              organizationId,
              points,
              position: 1,
              level: player.level ?? seedLevel,
              season: String(year),
              year,
            },
            select: { id: true, eventId: true, points: true, position: true, level: true, season: true, year: true },
          })
        : await prisma.padelRankingEntry.create({
            data: {
              organizationId,
              playerId: player.id,
              eventId: rankingEvent.id,
              points,
              position: 1,
              level: player.level ?? seedLevel,
              season: String(year),
              year,
            },
            select: { id: true, eventId: true, points: true, position: true, level: true, season: true, year: true },
          });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        targetUsername,
        organizationId,
        profile: updatedProfile,
        player,
        rating,
        rankingEntry,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
