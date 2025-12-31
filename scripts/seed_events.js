#!/usr/bin/env node
/**
 * Seed de eventos fake (organizer + eventos + ticket types + entitlements).
 *
 * Uso:
 *   node scripts/seed_events.js
 *
 * Opcional:
 *   SEED_USER_ID=<uuid>
 *   SEED_USERNAME=<username>
 *   SEED_ORG_USERNAME=<username>
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL no ambiente.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

async function resolveOwner() {
  const userId = process.env.SEED_USER_ID;
  const username = process.env.SEED_USERNAME;

  if (userId) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, username: true, fullName: true },
    });
    if (!profile) throw new Error(`Utilizador não encontrado para SEED_USER_ID=${userId}`);
    return profile;
  }

  if (username) {
    const profile = await prisma.profile.findFirst({
      where: { username },
      select: { id: true, username: true, fullName: true },
    });
    if (!profile) throw new Error(`Utilizador não encontrado para SEED_USERNAME=${username}`);
    return profile;
  }

  const fallback = await prisma.profile.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, fullName: true },
  });
  if (!fallback) throw new Error("Não foi possível encontrar um utilizador para associar os eventos.");
  return fallback;
}

async function main() {
  const owner = await resolveOwner();
  const organizerUsername = process.env.SEED_ORG_USERNAME || "orya-demo";
  console.log("[seed-events] Owner:", { id: owner.id, username: owner.username ?? null });

  const organizerExisting = await prisma.organizer.findFirst({
    where: { username: organizerUsername },
  });
  const organizer =
    organizerExisting ??
    (await prisma.organizer.create({
      data: {
        username: organizerUsername,
        publicName: "ORYA Demo Studio",
        businessName: "ORYA Demo Studio",
        city: "Lisboa",
        status: "ACTIVE",
        organizationCategory: "EVENTOS",
      },
    }));

  if (organizerExisting) {
    await prisma.organizer.update({
      where: { id: organizerExisting.id },
      data: {
        publicName: "ORYA Demo Studio",
        businessName: "ORYA Demo Studio",
        city: "Lisboa",
        status: "ACTIVE",
        organizationCategory: "EVENTOS",
      },
    });
  }
  console.log("[seed-events] Organizer:", { id: organizer.id, username: organizer.username ?? null });

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  const seedEvents = [
    {
      title: "Neon Nights Lisboa",
      description: "Uma noite de luz, música e energia no coração da cidade.",
      locationName: "LX Factory",
      locationCity: "Lisboa",
      address: "Rua Rodrigues de Faria, 103",
      coverImageUrl:
        "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80",
      startOffsetDays: -10,
      durationHours: 4,
      isFree: false,
    },
    {
      title: "Sunset Rooftop Porto",
      description: "Rooftop premium com sunset session e DJs convidados.",
      locationName: "Miradouro Porto Sky",
      locationCity: "Porto",
      address: "Rua do Infante, 45",
      coverImageUrl:
        "https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?auto=format&fit=crop&w=1600&q=80",
      startOffsetDays: -3,
      durationHours: 3,
      isFree: true,
    },
    {
      title: "ORYA Run Club",
      description: "Corrida urbana com after coffee e live set.",
      locationName: "Parque das Nações",
      locationCity: "Lisboa",
      address: "Cais do Sodré",
      coverImageUrl:
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=80",
      startOffsetDays: 2,
      durationHours: 2,
      isFree: true,
    },
    {
      title: "Techno Warehouse",
      description: "Sessão techno premium em ambiente industrial.",
      locationName: "Armazém 23",
      locationCity: "Lisboa",
      address: "Av. Infante Dom Henrique, 109",
      coverImageUrl:
        "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1600&q=80",
      startOffsetDays: 6,
      durationHours: 5,
      isFree: false,
    },
    {
      title: "Yoga & Sound Bath",
      description: "Manhã relax com yoga, sound bath e brunch.",
      locationName: "Jardim da Estrela",
      locationCity: "Lisboa",
      address: "Praça da Estrela",
      coverImageUrl:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1600&q=80",
      startOffsetDays: 15,
      durationHours: 2,
      isFree: true,
    },
    {
      title: "Cinema Open Air",
      description: "Sessão de cinema ao ar livre com filme surpresa.",
      locationName: "Parque da Cidade",
      locationCity: "Porto",
      address: "Av. da Boavista",
      coverImageUrl:
        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80",
      startOffsetDays: 30,
      durationHours: 3,
      isFree: false,
    },
  ];

  const created = [];
  const ownerKey = `user:${owner.id}`;

  for (const seed of seedEvents) {
    console.log("[seed-events] Processing:", seed.title);
    const base = new Date(now);
    base.setHours(19, 0, 0, 0);
    const startsAt = new Date(base.getTime() + seed.startOffsetDays * dayMs);
    const endsAt = new Date(startsAt.getTime() + seed.durationHours * hourMs);
    const slug = `seed-${slugify(seed.title)}`;

    const event = await prisma.event.upsert({
      where: { slug },
      update: {
        title: seed.title,
        description: seed.description,
        organizerId: organizer.id,
        ownerUserId: owner.id,
        startsAt,
        endsAt,
        locationName: seed.locationName,
        locationCity: seed.locationCity,
        address: seed.address,
        isFree: seed.isFree,
        status: "PUBLISHED",
        timezone: "Europe/Lisbon",
        coverImageUrl: seed.coverImageUrl,
      },
      create: {
        slug,
        title: seed.title,
        description: seed.description,
        type: "ORGANIZER_EVENT",
        organizerId: organizer.id,
        ownerUserId: owner.id,
        startsAt,
        endsAt,
        locationName: seed.locationName,
        locationCity: seed.locationCity,
        address: seed.address,
        isFree: seed.isFree,
        status: "PUBLISHED",
        timezone: "Europe/Lisbon",
        coverImageUrl: seed.coverImageUrl,
      },
    });
    console.log("[seed-events] Upserted event:", { id: event.id, slug: event.slug });

    await prisma.ticketType.deleteMany({
      where: { eventId: event.id, name: { startsWith: "Seed " } },
    });

    if (seed.isFree) {
      await prisma.ticketType.create({
        data: {
          eventId: event.id,
          name: "Seed Entrada",
          description: "Entrada gratuita",
          price: 0,
          currency: "EUR",
          totalQuantity: 200,
          status: "ON_SALE",
          sortOrder: 1,
        },
      });
    } else {
      await prisma.ticketType.createMany({
        data: [
          {
            eventId: event.id,
            name: "Seed Early Bird",
            description: "Lote antecipado",
            price: 1500,
            currency: "EUR",
            totalQuantity: 80,
            status: "ON_SALE",
            sortOrder: 1,
          },
          {
            eventId: event.id,
            name: "Seed Geral",
            description: "Entrada geral",
            price: 2500,
            currency: "EUR",
            totalQuantity: 180,
            status: "ON_SALE",
            sortOrder: 2,
          },
        ],
      });
    }
    console.log("[seed-events] Ticket types ok:", { eventId: event.id });

    await prisma.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: `seed:${slug}`,
          saleLineId: event.id,
          lineItemIndex: 0,
          ownerKey,
          type: "EVENT_TICKET",
        },
      },
      update: {
        status: "ACTIVE",
        ownerUserId: owner.id,
        eventId: event.id,
        snapshotTitle: event.title,
        snapshotCoverUrl: event.coverImageUrl,
        snapshotVenueName: event.locationName,
        snapshotStartAt: event.startsAt,
        snapshotTimezone: event.timezone,
      },
      create: {
        purchaseId: `seed:${slug}`,
        saleLineId: event.id,
        lineItemIndex: 0,
        ownerKey,
        ownerUserId: owner.id,
        eventId: event.id,
        type: "EVENT_TICKET",
        status: "ACTIVE",
        snapshotTitle: event.title,
        snapshotCoverUrl: event.coverImageUrl,
        snapshotVenueName: event.locationName,
        snapshotStartAt: event.startsAt,
        snapshotTimezone: event.timezone,
      },
    });

    created.push({ id: event.id, slug: event.slug });
    console.log("[seed-events] Event:", { id: event.id, slug: event.slug });
  }

  console.log("Seed concluída:", {
    owner: { id: owner.id, username: owner.username ?? null },
    organizer: { id: organizer.id, username: organizer.username ?? null },
    events: created,
  });
}

main()
  .catch((err) => {
    console.error("Erro ao criar eventos:", err);
    process.exit(1);
  })
  .finally(async () => {
    console.log("[seed-events] Disconnecting...");
    await prisma.$disconnect();
    console.log("[seed-events] Prisma disconnected. Closing pool...");
    await pool.end();
    console.log("[seed-events] Pool closed.");
  });
