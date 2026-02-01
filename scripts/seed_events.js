#!/usr/bin/env node
/**
 * Seed de eventos fake (organization + eventos + ticket types + entitlements).
 *
 * Uso:
 *   node scripts/seed_events.js
 *
 * Opcional:
 *   SEED_USER_ID=<uuid>
 *   SEED_USERNAME=<username>
 *   SEED_ORG_USERNAME=<username>
 *   SEED_ENV=prod|test
 */

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

require("./load-env");

function resolveDbUrl() {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("options");
    return parsed.toString();
  } catch {
    return raw;
  }
}

const dbUrl = resolveDbUrl();
if (!dbUrl) {
  console.error("Falta DATABASE_URL (ou DIRECT_URL) no ambiente.");
  process.exit(1);
}

const seedEnv = (process.env.SEED_ENV || process.env.APP_ENV || "prod").toLowerCase() === "test" ? "test" : "prod";
const slugPrefix = seedEnv === "test" ? "test-" : "";

// Dev-only: allow self-signed certs for local/preview DBs.
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [seedEnv]).catch(() => {});
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
    const profile = await prisma.profile.findFirst({
      where: { id: userId, env: seedEnv },
      select: { id: true, username: true, fullName: true },
    });
    if (!profile) throw new Error(`Utilizador não encontrado para SEED_USER_ID=${userId}`);
    return profile;
  }

  if (username) {
    const profile = await prisma.profile.findFirst({
      where: { username, env: seedEnv },
      select: { id: true, username: true, fullName: true },
    });
    if (!profile) throw new Error(`Utilizador não encontrado para SEED_USERNAME=${username}`);
    return profile;
  }

  const fallback = await prisma.profile.findFirst({
    where: { env: seedEnv },
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, fullName: true },
  });
  if (!fallback) throw new Error("Não foi possível encontrar um utilizador para associar os eventos.");
  return fallback;
}

async function main() {
  const owner = await resolveOwner();
  const baseOrgUsername = process.env.SEED_ORG_USERNAME || "orya-demo";
  const organizationUsername =
    seedEnv === "test" && !process.env.SEED_ORG_USERNAME ? `test-${baseOrgUsername}` : baseOrgUsername;
  console.log("[seed-events] Owner:", { id: owner.id, username: owner.username ?? null });

  const organizationExisting = await prisma.organization.findFirst({
    where: { username: organizationUsername, env: seedEnv },
  });
  if (!organizationExisting) {
    await prisma.$executeRawUnsafe(
      "SELECT setval(pg_get_serial_sequence('app_v3.organizations','id'), (SELECT COALESCE(MAX(id),1) FROM app_v3.organizations))",
    );
  }
  const organization =
    organizationExisting ??
    (await prisma.organization.create({
      data: {
        env: seedEnv,
        username: organizationUsername,
        publicName: seedEnv === "test" ? "ORYA Demo Studio (TEST)" : "ORYA Demo Studio",
        businessName: seedEnv === "test" ? "ORYA Demo Studio (TEST)" : "ORYA Demo Studio",
        city: "Lisboa",
        status: "ACTIVE",
        primaryModule: "EVENTOS",
        group: { create: { env: seedEnv } },
      },
    }));

  if (organizationExisting) {
    await prisma.organization.update({
      where: { id: organizationExisting.id },
      data: {
        env: seedEnv,
        publicName: seedEnv === "test" ? "ORYA Demo Studio (TEST)" : "ORYA Demo Studio",
        businessName: seedEnv === "test" ? "ORYA Demo Studio (TEST)" : "ORYA Demo Studio",
        city: "Lisboa",
        status: "ACTIVE",
        primaryModule: "EVENTOS",
      },
    });
  }
  console.log("[seed-events] Organization:", { id: organization.id, username: organization.username ?? null });

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
    const slug = `${slugPrefix}seed-${slugify(seed.title)}`;

    const event = await prisma.event.upsert({
      where: { slug },
      update: {
        env: seedEnv,
        title: seed.title,
        description: seed.description,
        organizationId: organization.id,
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
        env: seedEnv,
        slug,
        title: seed.title,
        description: seed.description,
        type: "ORGANIZATION_EVENT",
        organizationId: organization.id,
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
      where: { eventId: event.id, name: { startsWith: "Seed " }, env: seedEnv },
    });

    if (seed.isFree) {
      await prisma.ticketType.create({
        data: {
          env: seedEnv,
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
            env: seedEnv,
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
            env: seedEnv,
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

    let policy = await prisma.eventAccessPolicy.findFirst({
      where: { eventId: event.id },
      orderBy: { policyVersion: "desc" },
      select: { policyVersion: true },
    });
    if (!policy) {
      policy = await prisma.eventAccessPolicy.create({
        data: {
          env: seedEnv,
          eventId: event.id,
          policyVersion: 1,
          mode: "PUBLIC",
          guestCheckoutAllowed: true,
          inviteTokenAllowed: false,
          inviteIdentityMatch: "EMAIL",
          inviteTokenTtlSeconds: null,
          requiresEntitlementForEntry: true,
          checkinMethods: ["QR_TICKET", "MANUAL"],
          scannerRequired: false,
          allowReentry: false,
          reentryWindowMinutes: 15,
          maxEntries: 1,
          undoWindowMinutes: 10,
        },
      });
    }
    const policyVersionApplied = policy.policyVersion;

    await prisma.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: `seed:${seedEnv}:${slug}`,
          saleLineId: event.id,
          lineItemIndex: 0,
          ownerKey,
          type: "EVENT_TICKET",
        },
      },
      update: {
        env: seedEnv,
        status: "ACTIVE",
        ownerUserId: owner.id,
        eventId: event.id,
        snapshotTitle: event.title,
        snapshotCoverUrl: event.coverImageUrl,
        snapshotVenueName: event.locationName,
        snapshotStartAt: event.startsAt,
        snapshotTimezone: event.timezone,
        policyVersionApplied,
      },
      create: {
        env: seedEnv,
        purchaseId: `seed:${seedEnv}:${slug}`,
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
        policyVersionApplied,
      },
    });

    created.push({ id: event.id, slug: event.slug });
    console.log("[seed-events] Event:", { id: event.id, slug: event.slug });
  }

  console.log("Seed concluída:", {
    owner: { id: owner.id, username: owner.username ?? null },
    organization: { id: organization.id, username: organization.username ?? null },
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
