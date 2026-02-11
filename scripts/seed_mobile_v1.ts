/**
 * Seed Mobile V1 (users, orgs, events, padel tournaments).
 *
 * Usage:
 *   TS_NODE_COMPILER_OPTIONS='{"allowImportingTsExtensions":true}' npx ts-node scripts/seed_mobile_v1.ts
 *
 * Optional env:
 *   SEED_ENV=prod|test
 *   SEED_PREFIX=mobilev1
 *   SEED_USERS=10
 *   SEED_ORGS=5
 *   SEED_CLEAR=true (remove previous data for prefix before seeding)
 *   SEED_PASSWORD=TestOrya123!
 *   SEED_ADDRESS_ID=<uuid> (Apple Maps addressId para orgs/eventos)
 *   SEED_ADDRESS_IDS=<uuid,uuid,...> (lista para espalhar orgs/eventos no mapa)
 */

import fs from "fs";
import path from "path";
import {
  EventStatus,
  EventPricingMode,
  EventTemplateType,
  OrganizationModule,
  OrganizationStatus,
  PrismaClient,
  TicketTypeStatus,
  padel_format,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient, type User } from "@supabase/supabase-js";

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
  throw new Error("Falta DATABASE_URL (ou DIRECT_URL).");
}

const seedEnvRaw = (process.env.SEED_ENV || process.env.APP_ENV || "prod").toLowerCase();
const seedEnv = seedEnvRaw === "test" ? "test" : "prod";
const seedPrefix = (process.env.SEED_PREFIX || "mobilev1").toLowerCase().replace(/[^a-z0-9-]/g, "");
const seedUsers = Number(process.env.SEED_USERS || 10);
const seedOrgs = Number(process.env.SEED_ORGS || 5);
const shouldClear = ["1", "true", "yes"].includes(String(process.env.SEED_CLEAR || "").toLowerCase());
const seedPassword = process.env.SEED_PASSWORD || "TestOrya123!";
const seedPadel = !["0", "false", "no"].includes(String(process.env.SEED_PADEL || "").toLowerCase());
const seedAddressId = typeof process.env.SEED_ADDRESS_ID === "string" ? process.env.SEED_ADDRESS_ID.trim() : "";
const seedAddressIds = (process.env.SEED_ADDRESS_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const addressIds = seedAddressIds.length > 0 ? seedAddressIds : seedAddressId ? [seedAddressId] : [];
const pickAddressId = (index: number) => (addressIds.length ? addressIds[index % addressIds.length] : null);

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE no ambiente.");
}

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
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

const FIRST_NAMES = [
  "Nuno",
  "Beatriz",
  "Diogo",
  "Ines",
  "Goncalo",
  "Rita",
  "Joao",
  "Marta",
  "Tiago",
  "Carolina",
  "Vasco",
  "Lara",
];
const LAST_NAMES = [
  "Silva",
  "Ferreira",
  "Lopes",
  "Costa",
  "Pereira",
  "Ribeiro",
  "Santos",
  "Almeida",
  "Martins",
  "Carvalho",
];
const BIOS = [
  "Apaixonado por eventos e experiências únicas.",
  "Sempre à procura do próximo torneio de padel.",
  "Explora a cidade e os melhores planos.",
  "Música, desporto e boas vibes.",
  "Marca presença onde a energia acontece.",
];
const AVATARS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
];
const COVERS = [
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1515165562835-c4c1b9d1cb2f?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
];

const ORG_NAMES = [
  "ORYA Studio Lisboa",
  "ORYA Arena Porto",
  "ORYA Social Club",
  "ORYA Padel Lab",
  "ORYA Experience House",
];
const ORG_DESCRIPTIONS = [
  "Curadoria de eventos premium e experiências únicas.",
  "Clubhouse com torneios e comunidade ativa.",
  "Espaço de cultura, música e desporto.",
  "Clube de padel com torneios semanais.",
  "Plataforma de experiências e serviços urbanos.",
];
const EVENT_TEMPLATES = [
  {
    title: "Neon Nights Lisboa",
    description: "Uma noite de luz, música e energia no coração da cidade.",
    cover: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80",
    templateType: EventTemplateType.PARTY,
  },
  {
    title: "Sunset Rooftop Porto",
    description: "Rooftop premium com sunset session e DJs convidados.",
    cover: "https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?auto=format&fit=crop&w=1600&q=80",
    templateType: EventTemplateType.TALK,
  },
  {
    title: "ORYA Run Club",
    description: "Corrida urbana com after coffee e live set.",
    cover: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=80",
    templateType: EventTemplateType.OTHER,
  },
  {
    title: "Techno Warehouse",
    description: "Sessão techno premium em ambiente industrial.",
    cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80",
    templateType: EventTemplateType.PARTY,
  },
  {
    title: "Yoga & Sound Bath",
    description: "Manhã relax com yoga, sound bath e brunch.",
    cover: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1600&q=80",
    templateType: EventTemplateType.OTHER,
  },
];

const PADEL_TOURNAMENTS = [
  "Torneio Padel Atlantic",
  "Open Padel Lisboa",
  "Padel Night Challenge",
  "Summer Padel Cup",
  "Championship Padel Series",
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

const pick = <T>(list: T[], index: number) => list[index % list.length];
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function resolveAuthUser(email: string) {
  let user: User | null = null;

  if (!user) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    user = data?.users?.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }

  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: seedPassword,
      email_confirm: true,
    });
    if (error) throw new Error(`Falha ao criar user ${email}: ${error.message}`);
    user = data?.user ?? null;
  }

  if (!user) throw new Error(`Nao foi possivel resolver user ${email}`);
  return user;
}

async function clearSeedData() {
  const orgs = await prisma.organization.findMany({
    where: { username: { startsWith: seedPrefix } },
    select: { id: true, groupId: true },
  });
  const orgIds = orgs.map((org) => org.id);
  const groupIds = orgs.map((org) => org.groupId);

  const events = await prisma.event.findMany({
    where: {
      OR: [{ slug: { startsWith: seedPrefix } }, { organizationId: { in: orgIds } }],
    },
    select: { id: true },
  });
  const eventIds = events.map((event) => event.id);

  if (eventIds.length > 0) {
    await prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.padelTournamentConfig.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.tournament.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  }

  if (orgIds.length > 0) {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }

  if (groupIds.length > 0) {
    await prisma.organizationGroupMember.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.organizationGroup.deleteMany({ where: { id: { in: groupIds } } });
  }

  const profiles = await prisma.profile.findMany({
    where: { username: { startsWith: seedPrefix } },
    select: { id: true, username: true, users: { select: { id: true, email: true } } },
  });
  if (profiles.length > 0) {
    await prisma.profile.deleteMany({ where: { id: { in: profiles.map((p) => p.id) } } });
    for (const profile of profiles) {
      const email = profile.users?.email;
      if (email) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(profile.id);
        } catch {
          // ignore supabase delete failures
        }
      }
    }
  }
}

async function ensureOwnerGroupMembership(organizationId: number, userId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { groupId: true },
  });
  if (!org?.groupId) {
    throw new Error(`Organizacao ${organizationId} sem groupId.`);
  }

  const existing = await prisma.organizationGroupMember.findFirst({
    where: { groupId: org.groupId, userId },
    select: { id: true, scopeAllOrgs: true, scopeOrgIds: true },
  });

  if (existing?.id) {
    await prisma.organizationGroupMember.update({
      where: { id: existing.id },
      data: {
        role: "OWNER",
        scopeAllOrgs: existing.scopeAllOrgs,
        scopeOrgIds: existing.scopeAllOrgs
          ? []
          : Array.from(new Set([...(existing.scopeOrgIds ?? []), organizationId])),
      },
    });
    await prisma.organizationGroupMemberOrganizationOverride.deleteMany({
      where: { groupMemberId: existing.id, organizationId },
    });
    return;
  }

  await prisma.organizationGroupMember.create({
    data: {
      groupId: org.groupId,
      userId,
      role: "OWNER",
      scopeAllOrgs: false,
      scopeOrgIds: [organizationId],
    },
  });
}

async function main() {
  if (shouldClear) {
    console.log(`[seed-mobile-v1] Clearing previous seed data for prefix ${seedPrefix}...`);
    await clearSeedData();
  }

  const users: Array<{ id: string; username: string; fullName: string }> = [];

  for (let i = 0; i < seedUsers; i += 1) {
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i + 3);
    const fullName = `${first} ${last}`;
    const username = `${seedPrefix}-user-${i + 1}`;
    const email = `${seedPrefix}.${i + 1}@orya.pt`;
    const user = await resolveAuthUser(email);

    const existing = await prisma.profile.findUnique({ where: { id: user.id } });
    if (existing && existing.username && !existing.username.startsWith(seedPrefix)) {
      console.warn(`[seed-mobile-v1] Skip profile update for ${existing.username}`);
      users.push({ id: user.id, username: existing.username, fullName: existing.fullName ?? fullName });
      continue;
    }

    const profile = await prisma.profile.upsert({
      where: { id: user.id },
      update: {
        env: seedEnv,
        username,
        fullName,
        bio: pick(BIOS, i),
        avatarUrl: pick(AVATARS, i),
        coverUrl: pick(COVERS, i),
        favouriteCategories: ["padel", "concertos", "gastronomia"].slice(0, randomBetween(1, 3)),
        onboardingDone: true,
        roles: ["user"],
        status: "ACTIVE",
        visibility: "PUBLIC",
        isDeleted: false,
      },
      create: {
        env: seedEnv,
        username,
        fullName,
        bio: pick(BIOS, i),
        avatarUrl: pick(AVATARS, i),
        coverUrl: pick(COVERS, i),
        favouriteCategories: ["padel", "concertos", "gastronomia"].slice(0, randomBetween(1, 3)),
        onboardingDone: true,
        roles: ["user"],
        status: "ACTIVE",
        visibility: "PUBLIC",
        isDeleted: false,
        users: { connect: { id: user.id } },
      },
    });

    users.push({ id: profile.id, username: profile.username ?? username, fullName: profile.fullName ?? fullName });
  }

  const organizations: Array<{ id: number; username: string }> = [];

  for (let i = 0; i < seedOrgs; i += 1) {
    const name = ORG_NAMES[i % ORG_NAMES.length];
    const username = `${seedPrefix}-org-${i + 1}`;
    const description = ORG_DESCRIPTIONS[i % ORG_DESCRIPTIONS.length];
    const avatar = pick(AVATARS, i + 1);
    const cover = pick(COVERS, i + 2);

    const existing = await prisma.organization.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true },
    });

    let organization: { id: number; username: string | null } | null = existing;
    if (!existing) {
      const group = await prisma.organizationGroup.create({ data: { env: seedEnv } });
      organization = await prisma.organization.create({
        data: {
          env: seedEnv,
          groupId: group.id,
          username,
          publicName: name,
          businessName: name,
          publicDescription: description,
          addressId: pickAddressId(i),
          status: OrganizationStatus.ACTIVE,
          primaryModule: OrganizationModule.EVENTOS,
          brandingAvatarUrl: avatar,
          brandingCoverUrl: cover,
        },
      });
    } else {
      organization = await prisma.organization.update({
        where: { id: existing.id },
        data: {
          env: seedEnv,
          publicName: name,
          businessName: name,
          publicDescription: description,
          addressId: pickAddressId(i),
          status: OrganizationStatus.ACTIVE,
          primaryModule: OrganizationModule.EVENTOS,
          brandingAvatarUrl: avatar,
          brandingCoverUrl: cover,
        },
      });
    }
    if (!organization) {
      throw new Error("Nao foi possivel criar/atualizar organizacao.");
    }

    const owner = users[i % users.length];
    if (owner) {
      await ensureOwnerGroupMembership(organization.id, owner.id);
    }

    organizations.push({ id: organization.id, username: organization.username ?? username });
  }

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < organizations.length; i += 1) {
    const org = organizations[i];
    const count = (i + 1) % 5; // 0-4
    for (let j = 0; j < count; j += 1) {
      const template = pick(EVENT_TEMPLATES, i + j);
      const title = template.title;
      const slug = `${seedPrefix}-${slugify(title)}-${i + 1}-${j + 1}`;
      const startsAt = new Date(now.getTime() + (j + 2) * dayMs);
      const endsAt = new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);
      const owner = users[(i + j) % users.length];
      const isFree = j % 3 === 0;

      const ticketTypes =
        j % 2 === 0
          ? [
              {
                name: isFree ? "Entrada livre" : "Entrada geral",
                description: null,
                price: isFree ? 0 : randomBetween(1500, 4500),
                currency: "EUR",
                totalQuantity: randomBetween(60, 200),
                status: TicketTypeStatus.ON_SALE,
              },
            ]
          : [];
      const ticketPrices = ticketTypes.map((t) => t.price);
      const hasZero = ticketPrices.some((price) => price === 0);
      const hasPaid = ticketPrices.some((price) => price > 0);
      const pricingMode = hasZero && !hasPaid ? EventPricingMode.FREE_ONLY : EventPricingMode.STANDARD;

      await prisma.event.create({
        data: {
          env: seedEnv,
          slug,
          title,
          description: template.description,
          templateType: template.templateType,
          status: EventStatus.PUBLISHED,
          organizationId: org.id,
          ownerUserId: owner?.id ?? users[0].id,
          startsAt,
          endsAt,
          addressId: pickAddressId(i + j),
          coverImageUrl: template.cover,
          pricingMode,
          ticketTypes: ticketTypes.length ? { create: ticketTypes } : undefined,
        },
      });
    }
  }

  if (seedPadel) {
    for (let i = 0; i < PADEL_TOURNAMENTS.length; i += 1) {
      const title = PADEL_TOURNAMENTS[i];
      const slug = `${seedPrefix}-padel-${slugify(title)}-${i + 1}`;
      const startsAt = new Date(now.getTime() + (i + 5) * dayMs);
      const endsAt = new Date(startsAt.getTime() + 5 * 60 * 60 * 1000);
      const org = organizations[i % organizations.length];
      const owner = users[i % users.length];

      const event = await prisma.event.create({
        data: {
          env: seedEnv,
          slug,
          title,
          description: "Torneio de padel com experiência premium ORYA.",
          templateType: EventTemplateType.PADEL,
          status: EventStatus.PUBLISHED,
          organizationId: org.id,
          ownerUserId: owner?.id ?? users[0].id,
          startsAt,
          endsAt,
          addressId: pickAddressId(i + 3),
          coverImageUrl: pick(COVERS, i),
          pricingMode: EventPricingMode.STANDARD,
          ticketTypes: {
            create: [
              {
                name: "Inscrição",
                description: "Entrada torneio",
                price: randomBetween(2500, 4500),
                currency: "EUR",
                totalQuantity: 48,
                status: TicketTypeStatus.ON_SALE,
              },
            ],
          },
        },
      });

      await prisma.padelTournamentConfig.create({
        data: {
          env: seedEnv,
          eventId: event.id,
          organizationId: org.id,
          format: padel_format.GRUPOS_ELIMINATORIAS,
          numberOfCourts: 2,
        },
      });
    }
  }

  console.log(`[seed-mobile-v1] Seed completo (${seedUsers} users, ${seedOrgs} orgs).`);
}

main()
  .catch((err) => {
    console.error("[seed-mobile-v1] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
