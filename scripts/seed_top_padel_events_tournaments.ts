import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  EventPricingMode,
  EventStatus,
  EventTemplateType,
  EventType,
  FeeMode,
  OrganizationModule,
  PadelTournamentLifecycleStatus,
  PayoutMode,
  PrismaClient,
  SourceType,
  TournamentFormat,
  TicketTypeStatus,
  padel_format,
} from "@prisma/client";
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

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });
const padelCover = (file: string) => `/covers/library/padel/${file}`;

type SeedEvent = {
  slug: string;
  title: string;
  description: string;
  templateType: EventTemplateType;
  pricingMode: EventPricingMode;
  ticketName: string;
  ticketPrice: number;
  startsInDays: number;
  durationHours: number;
  hasTournament: boolean;
  coverImageUrl: string;
};

const SEED_EVENTS: SeedEvent[] = [
  {
    slug: "top-padel-open-spring-2026",
    title: "Top Padel Open Spring 2026",
    description: "Torneio principal de primavera com fase de grupos e playoff.",
    templateType: EventTemplateType.PADEL,
    pricingMode: EventPricingMode.FREE_ONLY,
    ticketName: "Inscricao Open Spring",
    ticketPrice: 0,
    startsInDays: 7,
    durationHours: 10,
    hasTournament: true,
    coverImageUrl: padelCover("01-padel-court.jpg"),
  },
  {
    slug: "top-padel-masters-april-2026",
    title: "Top Padel Masters April 2026",
    description: "Masters competitivo com qualificacao e quadro final.",
    templateType: EventTemplateType.PADEL,
    pricingMode: EventPricingMode.STANDARD,
    ticketName: "Inscricao Masters April",
    ticketPrice: 1500,
    startsInDays: 21,
    durationHours: 12,
    hasTournament: true,
    coverImageUrl: padelCover("02-padel-court-along-ggaba-road-5.jpg"),
  },
  {
    slug: "top-padel-cup-may-2026",
    title: "Top Padel Cup May 2026",
    description: "Cup mensal da Top Padel com formato grupos + eliminatorias.",
    templateType: EventTemplateType.PADEL,
    pricingMode: EventPricingMode.STANDARD,
    ticketName: "Inscricao Cup May",
    ticketPrice: 1200,
    startsInDays: 36,
    durationHours: 9,
    hasTournament: true,
    coverImageUrl: padelCover("03-padel-court-along-ggaba-road.jpg"),
  },
  {
    slug: "top-padel-social-night-2026",
    title: "Top Padel Social Night",
    description: "Evento social com jogos amigaveis, musica e networking.",
    templateType: EventTemplateType.OTHER,
    pricingMode: EventPricingMode.FREE_ONLY,
    ticketName: "Entrada Social Night",
    ticketPrice: 0,
    startsInDays: 12,
    durationHours: 4,
    hasTournament: false,
    coverImageUrl: padelCover("04-padel-court-in-nsambya.jpg"),
  },
  {
    slug: "top-padel-performance-camp-2026",
    title: "Top Padel Performance Camp",
    description: "Treino intensivo de tecnica e estrategia para atletas.",
    templateType: EventTemplateType.PADEL,
    pricingMode: EventPricingMode.STANDARD,
    ticketName: "Bilhete Performance Camp",
    ticketPrice: 2500,
    startsInDays: 50,
    durationHours: 8,
    hasTournament: false,
    coverImageUrl: padelCover("07-padel-court12.jpg"),
  },
];

function computeWindow(startsInDays: number, durationHours: number) {
  const start = new Date();
  start.setDate(start.getDate() + startsInDays);
  start.setHours(9, 30, 0, 0);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return { start, end };
}

async function resolveOrganization() {
  const requestedUsername = (process.env.TOP_PADEL_ORG_USERNAME ?? "top_padel").trim().toLowerCase();
  const candidates = Array.from(new Set([requestedUsername, "top_padel", "top-padel", "toppadel"]));
  const whereOr = candidates.map((username) => ({ username: { equals: username, mode: "insensitive" as const } }));

  const organization = await prisma.organization.findFirst({
    where: { OR: whereOr },
    select: {
      id: true,
      username: true,
      publicName: true,
      addressId: true,
      orgType: true,
      groupId: true,
    },
  });

  if (!organization) {
    throw new Error("Organizacao top_padel nao encontrada. Corre primeiro o seed da loja.");
  }
  return organization;
}

async function resolveOwnerUserId(groupId: number) {
  const forced = process.env.TOP_PADEL_OWNER_USER_ID?.trim();
  if (forced) {
    const exists = await prisma.profile.findUnique({ where: { id: forced }, select: { id: true } });
    if (!exists) throw new Error(`TOP_PADEL_OWNER_USER_ID invalido: ${forced}`);
    return forced;
  }

  const member = await prisma.organizationGroupMember.findFirst({
    where: { groupId },
    orderBy: [{ id: "asc" }],
    select: { userId: true },
  });
  if (member?.userId) return member.userId;

  const fallback = await prisma.profile.findFirst({
    where: { isDeleted: false },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true },
  });
  if (!fallback?.id) {
    throw new Error("Nenhum profile disponivel para ownerUserId.");
  }
  return fallback.id;
}

async function ensureTicketType(eventId: number, name: string, price: number) {
  const existing = await prisma.ticketType.findFirst({
    where: { eventId, name },
    select: { id: true },
    orderBy: [{ id: "asc" }],
  });

  if (existing) {
    return prisma.ticketType.update({
      where: { id: existing.id },
      data: {
        description: null,
        price,
        currency: "EUR",
        totalQuantity: null,
        status: TicketTypeStatus.ON_SALE,
      },
      select: { id: true, name: true, price: true },
    });
  }

  return prisma.ticketType.create({
    data: {
      eventId,
      name,
      description: null,
      price,
      currency: "EUR",
      totalQuantity: null,
      status: TicketTypeStatus.ON_SALE,
    },
    select: { id: true, name: true, price: true },
  });
}

async function upsertAgendaItem(input: {
  organizationId: number;
  sourceType: SourceType;
  sourceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}) {
  return prisma.agendaItem.upsert({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    update: {
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "ACTIVE",
      updatedAt: new Date(),
      lastEventId: randomUUID(),
    },
    create: {
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "ACTIVE",
      updatedAt: new Date(),
      lastEventId: randomUUID(),
    },
    select: { id: true },
  });
}

async function main() {
  const organization = await resolveOrganization();
  const ownerUserId = await resolveOwnerUserId(organization.groupId);
  let organizationAddressId = organization.addressId ?? null;

  if (!organizationAddressId) {
    const fallbackAddress = await prisma.address.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
    if (fallbackAddress?.id) {
      organizationAddressId = fallbackAddress.id;
      await prisma.organization.update({
        where: { id: organization.id },
        data: { addressId: organizationAddressId },
      });
    }
  }

  const payoutMode = organization.orgType === "PLATFORM" ? PayoutMode.PLATFORM : PayoutMode.ORGANIZATION;

  for (const moduleKey of [OrganizationModule.EVENTOS, OrganizationModule.TORNEIOS]) {
    await prisma.organizationModuleEntry.upsert({
      where: { organizationId_moduleKey: { organizationId: organization.id, moduleKey } },
      update: { enabled: true },
      create: { organizationId: organization.id, moduleKey, enabled: true },
    });
  }

  const seeded: Array<{
    slug: string;
    eventId: number;
    ticketTypeId: number;
    hasTournament: boolean;
    tournamentId: number | null;
    padelConfigId: number | null;
  }> = [];

  for (const item of SEED_EVENTS) {
    const window = computeWindow(item.startsInDays, item.durationHours);
    const event = await prisma.event.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        description: item.description,
        type: EventType.ORGANIZATION_EVENT,
        templateType: item.templateType,
        organizationId: organization.id,
        ownerUserId,
        startsAt: window.start,
        endsAt: window.end,
        addressId: organizationAddressId,
        pricingMode: item.pricingMode,
        status: EventStatus.PUBLISHED,
        timezone: "Europe/Lisbon",
        coverImageUrl: item.coverImageUrl,
        feeMode: FeeMode.INCLUDED,
        payoutMode,
      },
      create: {
        slug: item.slug,
        title: item.title,
        description: item.description,
        type: EventType.ORGANIZATION_EVENT,
        templateType: item.templateType,
        organizationId: organization.id,
        ownerUserId,
        startsAt: window.start,
        endsAt: window.end,
        addressId: organizationAddressId,
        pricingMode: item.pricingMode,
        status: EventStatus.PUBLISHED,
        timezone: "Europe/Lisbon",
        coverImageUrl: item.coverImageUrl,
        feeMode: FeeMode.INCLUDED,
        payoutMode,
      },
      select: { id: true, slug: true },
    });

    const ticketType = await ensureTicketType(event.id, item.ticketName, item.ticketPrice);
    await upsertAgendaItem({
      organizationId: organization.id,
      sourceType: SourceType.EVENT,
      sourceId: String(event.id),
      title: item.title,
      startsAt: window.start,
      endsAt: window.end,
    });

    let tournamentId: number | null = null;
    let padelConfigId: number | null = null;

    if (item.hasTournament) {
      const tournament = await prisma.tournament.upsert({
        where: { eventId: event.id },
        update: {
          format: TournamentFormat.GROUPS_PLUS_PLAYOFF,
          inscriptionDeadlineAt: new Date(window.start.getTime() - 24 * 60 * 60 * 1000),
          tieBreakRules: {
            order: ["head_to_head", "set_diff", "game_diff"],
          },
          config: {
            source: "seed_top_padel_events_tournaments",
            mode: "groups_plus_playoff",
          },
        },
        create: {
          eventId: event.id,
          format: TournamentFormat.GROUPS_PLUS_PLAYOFF,
          inscriptionDeadlineAt: new Date(window.start.getTime() - 24 * 60 * 60 * 1000),
          tieBreakRules: {
            order: ["head_to_head", "set_diff", "game_diff"],
          },
          config: {
            source: "seed_top_padel_events_tournaments",
            mode: "groups_plus_playoff",
          },
        },
        select: { id: true },
      });
      tournamentId = tournament.id;

      const padelConfig = await prisma.padelTournamentConfig.upsert({
        where: { eventId: event.id },
        update: {
          organizationId: organization.id,
          format: padel_format.GRUPOS_ELIMINATORIAS,
          numberOfCourts: 4,
          padelV2Enabled: true,
          lifecycleStatus: PadelTournamentLifecycleStatus.PUBLISHED,
          publishedAt: new Date(),
          advancedSettings: {
            source: "seed_top_padel_events_tournaments",
            scheduleDefaults: {
              durationMinutes: 60,
              slotMinutes: 15,
              bufferMinutes: 5,
            },
            competitionState: "PUBLISHED",
          },
        },
        create: {
          eventId: event.id,
          organizationId: organization.id,
          format: padel_format.GRUPOS_ELIMINATORIAS,
          numberOfCourts: 4,
          padelV2Enabled: true,
          lifecycleStatus: PadelTournamentLifecycleStatus.PUBLISHED,
          publishedAt: new Date(),
          advancedSettings: {
            source: "seed_top_padel_events_tournaments",
            scheduleDefaults: {
              durationMinutes: 60,
              slotMinutes: 15,
              bufferMinutes: 5,
            },
            competitionState: "PUBLISHED",
          },
        },
        select: { id: true },
      });
      padelConfigId = padelConfig.id;

      await upsertAgendaItem({
        organizationId: organization.id,
        sourceType: SourceType.TOURNAMENT,
        sourceId: String(tournament.id),
        title: `${item.title} - Quadro`,
        startsAt: window.start,
        endsAt: window.end,
      });
    }

    seeded.push({
      slug: event.slug,
      eventId: event.id,
      ticketTypeId: ticketType.id,
      hasTournament: item.hasTournament,
      tournamentId,
      padelConfigId,
    });
  }

  console.log("[seed-top-padel-events-tournaments] OK");
  console.log(
    JSON.stringify(
      {
        organization: {
          id: organization.id,
          username: organization.username,
          publicName: organization.publicName,
        },
        ownerUserId,
        totals: {
          events: seeded.length,
          tournaments: seeded.filter((s) => s.hasTournament).length,
        },
        seeded,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("[seed-top-padel-events-tournaments] error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
