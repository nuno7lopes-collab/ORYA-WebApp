import crypto from "crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { AnalyticsDimensionKey, AnalyticsMetricKey, PrismaClient, SourceType } from "@prisma/client";
import { Pool } from "pg";
import seedrandom from "seedrandom";

config({ path: ".env.local" });
config();

const RNG_SEED = "orya-rich-demo-v1";
const rng = seedrandom(RNG_SEED);

const now = new Date();
const FAST_MODE = process.env.SEED_FAST === "1";
const SEED_VOLUME = {
  standardEvents: 20,
  tournaments: 20,
  storeOrders: FAST_MODE ? 12 : 20,
  bookingDays: FAST_MODE ? 18 : 30,
  bookingsPerDay: FAST_MODE ? 3 : 4,
  followMin: FAST_MODE ? 12 : 18,
  followMax: FAST_MODE ? 22 : 32,
  orgFollowMin: FAST_MODE ? 2 : 2,
  orgFollowMax: FAST_MODE ? 3 : 4,
  chatBaseMessages: FAST_MODE ? 7 : 9,
};

const maleFirstNames = [
  "Joao",
  "Miguel",
  "Tiago",
  "Rui",
  "Andre",
  "Pedro",
  "Diogo",
  "Nuno",
  "Filipe",
  "Bruno",
  "Ricardo",
  "Goncalo",
  "Hugo",
  "Daniel",
  "Luis",
  "David",
  "Jorge",
  "Afonso",
  "Francisco",
  "Mateus",
  "Vasco",
  "Leandro",
  "Sergio",
  "Carlos",
  "Paulo",
  "Henrique",
  "Rafael",
  "Duarte",
  "Alexandre",
  "Tomas",
  "Ivo",
  "Nelson",
  "Mario",
  "Samuel",
  "Rodrigo",
  "Manuel",
  "Antonio",
  "Eduardo",
  "Gabriel",
  "Martim",
  "Artur",
  "Caio",
  "Noah",
  "Lucas",
  "Xavier",
  "Victor",
  "Guilherme",
  "Cristiano",
  "Emanuel",
  "Flavio",
];

const femaleFirstNames = [
  "Ana",
  "Ines",
  "Marta",
  "Carla",
  "Sofia",
  "Mariana",
  "Beatriz",
  "Filipa",
  "Patricia",
  "Catarina",
  "Teresa",
  "Joana",
  "Diana",
  "Raquel",
  "Andreia",
  "Helena",
  "Rita",
  "Sara",
  "Jessica",
  "Liliana",
  "Vera",
  "Eva",
  "Alice",
  "Clara",
  "Mafalda",
  "Matilde",
  "Madalena",
  "Adriana",
  "Bianca",
  "Daniela",
  "Gabriela",
  "Isabel",
  "Laura",
  "Lara",
  "Margarida",
  "Noelia",
  "Olivia",
  "Paula",
  "Renata",
  "Silvia",
  "Tatiana",
  "Valeria",
  "Yasmin",
  "Zelia",
  "Emilia",
  "Lorena",
  "Camila",
  "Ariana",
  "Debora",
  "Fatima",
];

const surnames = [
  "Silva",
  "Santos",
  "Ferreira",
  "Pereira",
  "Costa",
  "Oliveira",
  "Rodrigues",
  "Martins",
  "Jesus",
  "Sousa",
  "Fernandes",
  "Goncalves",
  "Gomes",
  "Lopes",
  "Marques",
  "Alves",
  "Almeida",
  "Ribeiro",
  "Pinto",
  "Carvalho",
  "Teixeira",
  "Moreira",
  "Correia",
  "Mendes",
  "Nunes",
  "Soares",
  "Vieira",
  "Monteiro",
  "Cardoso",
  "Rocha",
  "Cunha",
  "Melo",
  "Barros",
  "Tavares",
  "Freitas",
  "Araujo",
  "Baptista",
  "Castro",
  "Figueiredo",
  "Leal",
  "Machado",
  "Neves",
  "Pires",
  "Quaresma",
  "Reis",
  "Valente",
  "Xavier",
  "Amaral",
  "Borges",
  "Coelho",
  "Dias",
  "Esteves",
  "Faria",
  "Garcia",
  "Henriques",
  "Lourenco",
  "Morais",
  "Noronha",
  "Prata",
  "Simoes",
];

type SeedGender = "MALE" | "FEMALE";

type SeedUser = {
  id?: string;
  email: string;
  username: string;
  fullName: string;
  password: string;
  gender: SeedGender;
  avatarUrl: string | null;
  isStaff: boolean;
};

type SeedOrg = {
  id: number;
  username: string;
  publicName: string;
  groupId: number;
  ownerUserId: string;
};

type PurchaseRecord = {
  organizationId: number;
  userId: string;
  amountCents: number;
  occurredAt: Date;
  sourceType: "EVENT_TICKET" | "STORE_ORDER";
  sourceId: string;
};

type BookingRecord = {
  organizationId: number;
  userId: string;
  occurredAt: Date;
  bookingId: number;
  status: "BOOKING_CONFIRMED" | "BOOKING_COMPLETED" | "BOOKING_CANCELLED";
};

type TopPadelFinancialRecord = {
  organizationId: number;
  paymentId: string;
  purchaseId: string;
  sourceType: "TICKET_ORDER" | "STORE_ORDER";
  sourceId: string;
  customerIdentityId: string;
  paymentIntentId: string | null;
  paymentStatus:
    | "SUCCEEDED"
    | "PROCESSING"
    | "FAILED"
    | "CANCELLED"
    | "PARTIAL_REFUND"
    | "REFUNDED"
    | "DISPUTED";
  grossCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
  netToOrgCents: number;
  refundedCents: number;
  currency: "EUR";
  occurredAt: Date;
  eventId: number | null;
};

type TopPadelPurchaseSnapshot = {
  organizationId: number;
  paymentId: string;
  purchaseId: string;
  sourceType: "TICKET_ORDER" | "STORE_ORDER";
  sourceId: string;
  customerIdentityId: string;
  paymentIntentId: string | null;
  grossCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
  netToOrgCents: number;
  currency: "EUR";
  occurredAt: Date;
  eventId: number | null;
};

type StoreRefundSeed = {
  userId: string;
  sourceId: string;
  amountCents: number;
  occurredAt: Date;
};

type CrmContactFinancialProfile = {
  contactId: string;
  userId: string;
  isStaff: boolean;
  totalSpentCents: number;
  totalOrders: number;
  totalStoreOrders: number;
  lastPurchaseAt: Date | null;
};

const cityPool = [
  { city: "Porto", address: "Rua de Ceuta 118, Porto", lat: 41.14961, lng: -8.61099 },
  { city: "Lisboa", address: "Avenida da Liberdade 185, Lisboa", lat: 38.72225, lng: -9.13934 },
  { city: "Matosinhos", address: "Rua Brito Capelo 823, Matosinhos", lat: 41.18207, lng: -8.68908 },
  { city: "Gaia", address: "Avenida da Republica 240, Vila Nova de Gaia", lat: 41.13364, lng: -8.61742 },
  { city: "Braga", address: "Avenida Central 112, Braga", lat: 41.54545, lng: -8.42651 },
  { city: "Coimbra", address: "Rua Ferreira Borges 76, Coimbra", lat: 40.211, lng: -8.4292 },
  { city: "Aveiro", address: "Rua Dr. Nascimento Leitao 9, Aveiro", lat: 40.6405, lng: -8.6538 },
  { city: "Faro", address: "Rua de Santo Antonio 68, Faro", lat: 37.01936, lng: -7.93044 },
  { city: "Leiria", address: "Rua Miguel Bombarda 23, Leiria", lat: 39.74362, lng: -8.80705 },
  { city: "Setubal", address: "Avenida Luisa Todi 310, Setubal", lat: 38.5244, lng: -8.8882 },
  { city: "Viseu", address: "Rua Formosa 31, Viseu", lat: 40.661, lng: -7.9097 },
  { city: "Guimaraes", address: "Largo do Toural 44, Guimaraes", lat: 41.4417, lng: -8.2951 },
];

const tournamentFormats = [
  "TODOS_CONTRA_TODOS",
  "QUADRO_ELIMINATORIO",
  "GRUPOS_ELIMINATORIAS",
  "CAMPEONATO_LIGA",
  "QUADRO_AB",
  "DUPLA_ELIMINACAO",
  "NON_STOP",
] as const;

const tournamentTableFormats = [
  "GROUPS_PLUS_PLAYOFF",
  "DRAW_A_B",
  "GROUPS_PLUS_FINALS_ALL_PLACES",
  "CHAMPIONSHIP_ROUND_ROBIN",
  "NONSTOP_ROUND_ROBIN",
] as const;

function rand() {
  return rng();
}

function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function maybe(probability: number) {
  return rand() < probability;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function plusDays(date: Date, days: number) {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function plusMinutes(date: Date, minutes: number) {
  const out = new Date(date);
  out.setUTCMinutes(out.getUTCMinutes() + minutes);
  return out;
}

function makeAddressHash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function roundCents(value: number) {
  return Math.round(value);
}

function resolveSeedPaymentStatus(params: {
  index: number;
  grossCents: number;
  refundedCents?: number;
}): "SUCCEEDED" | "PROCESSING" | "FAILED" | "CANCELLED" | "PARTIAL_REFUND" | "REFUNDED" | "DISPUTED" {
  const { index, grossCents } = params;
  const refundedCents = Math.max(0, params.refundedCents ?? 0);
  if (grossCents <= 0) return "SUCCEEDED";
  if (refundedCents >= grossCents) return "REFUNDED";
  if (refundedCents > 0) return "PARTIAL_REFUND";

  const cycle = index % 24;
  if (cycle === 3 || cycle === 19) return "PROCESSING";
  if (cycle === 7) return "FAILED";
  if (cycle === 11) return "CANCELLED";
  if (cycle === 17) return "DISPUTED";
  return "SUCCEEDED";
}

function shouldEmitLedgerForStatus(status: TopPadelFinancialRecord["paymentStatus"]) {
  return status !== "FAILED" && status !== "CANCELLED";
}

function seedCoverUrl(kind: "event" | "tournament", index: number) {
  return `https://picsum.photos/seed/orya-${kind}-${index + 1}/1600/900`;
}

async function runSeedAnalyticsRollup(params: {
  prisma: PrismaClient;
  organizationId: number;
  fromDate: Date;
  toDate: Date;
}) {
  const { prisma, organizationId, fromDate, toDate } = params;
  const fromIso = fromDate.toISOString().slice(0, 10);
  const toIso = toDate.toISOString().slice(0, 10);

  type RollupRow = {
    bucket_date: string | Date;
    source_type: SourceType;
    currency: string;
    gross: number;
    platform_fees: number;
    processor_fees: number;
    net_to_org: number;
  };

  const rows = await prisma.$queryRaw<RollupRow[]>`
    SELECT
      (le.created_at AT TIME ZONE 'Europe/Lisbon')::date AS bucket_date,
      le.source_type AS source_type,
      le.currency AS currency,
      SUM(CASE WHEN le.entry_type = 'GROSS' THEN le.amount ELSE 0 END) AS gross,
      SUM(CASE WHEN le.entry_type = 'PLATFORM_FEE' THEN -le.amount ELSE 0 END) AS platform_fees,
      SUM(CASE WHEN le.entry_type IN ('PROCESSOR_FEES_FINAL', 'PROCESSOR_FEES_ADJUSTMENT') THEN -le.amount ELSE 0 END) AS processor_fees,
      SUM(le.amount) AS net_to_org
    FROM app_v3.ledger_entries le
    JOIN app_v3.payments p ON p.id = le.payment_id
    WHERE p.organization_id = ${organizationId}
      AND (le.created_at AT TIME ZONE 'Europe/Lisbon')::date BETWEEN ${fromIso}::date AND ${toIso}::date
    GROUP BY (le.created_at AT TIME ZONE 'Europe/Lisbon')::date, le.source_type, le.currency
  `;

  const moduleBySource: Partial<Record<SourceType, string>> = {
    TICKET_ORDER: "EVENTOS",
    STORE_ORDER: "LOJA",
  };

  let rollups = 0;
  for (const row of rows) {
    const bucketDate =
      row.bucket_date instanceof Date
        ? new Date(Date.UTC(row.bucket_date.getUTCFullYear(), row.bucket_date.getUTCMonth(), row.bucket_date.getUTCDate()))
        : new Date(`${row.bucket_date}T00:00:00.000Z`);
    if (Number.isNaN(bucketDate.getTime())) continue;
    const metrics: Array<[AnalyticsMetricKey, number]> = [
      [AnalyticsMetricKey.GROSS, Number(row.gross || 0)],
      [AnalyticsMetricKey.PLATFORM_FEES, Number(row.platform_fees || 0)],
      [AnalyticsMetricKey.PROCESSOR_FEES, Number(row.processor_fees || 0)],
      [AnalyticsMetricKey.NET_TO_ORG, Number(row.net_to_org || 0)],
    ];
    const dimensions: Array<[AnalyticsDimensionKey, string]> = [
      [AnalyticsDimensionKey.CURRENCY, row.currency || "EUR"],
      [AnalyticsDimensionKey.SOURCE_TYPE, row.source_type],
      [AnalyticsDimensionKey.MODULE, moduleBySource[row.source_type] ?? "EVENTOS"],
      [AnalyticsDimensionKey.PAYMENT_PROVIDER, "STRIPE"],
    ];

    for (const [metricKey, value] of metrics) {
      for (const [dimensionKey, dimensionValue] of dimensions) {
        await prisma.analyticsRollup.upsert({
          where: {
            organizationId_bucketDate_metricKey_dimensionKey_dimensionValue: {
              organizationId,
              bucketDate,
              metricKey,
              dimensionKey,
              dimensionValue,
            },
          },
          update: { value },
          create: {
            organizationId,
            bucketDate,
            metricKey,
            dimensionKey,
            dimensionValue,
            value,
          },
        });
        rollups += 1;
      }
    }
  }

  return { rows: rows.length, rollups };
}

async function listAllAuthUsers(supabase: any) {
  const users: Array<{ id: string; email: string | null }> = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    for (const user of batch) users.push({ id: user.id, email: user.email ?? null });
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function ensureGlobalUsername(prisma: PrismaClient, username: string, ownerType: "USER" | "ORG", ownerId: string) {
  await prisma.globalUsername.upsert({
    where: { username },
    update: { ownerType, ownerId },
    create: { username, ownerType, ownerId },
  });
}

function buildSeedUsers(targetCount: number): SeedUser[] {
  const users: SeedUser[] = [];
  const taken = new Set<string>();

  let sequence = 1;
  while (users.length < targetCount) {
    const gender: SeedGender = maybe(0.52) ? "MALE" : "FEMALE";
    const first = gender === "MALE" ? pick(maleFirstNames) : pick(femaleFirstNames);
    const last = pick(surnames);
    const fullName = `${first} ${last}`;
    const usernameBase = slugify(`${first}.${last}`);
    const username = `${usernameBase}${String(sequence).padStart(2, "0")}`;
    const email = `seed.${username}@orya.test`;
    sequence += 1;
    if (taken.has(email) || taken.has(username)) continue;
    taken.add(email);
    taken.add(username);

    const hasPhoto = maybe(0.68);
    const avatarIndex = randInt(1, 92);
    const avatarUrl = hasPhoto
      ? gender === "MALE"
        ? `https://randomuser.me/api/portraits/men/${avatarIndex}.jpg`
        : `https://randomuser.me/api/portraits/women/${avatarIndex}.jpg`
      : null;

    users.push({
      email,
      username,
      fullName,
      password: "SeedTopPadel!2026",
      gender,
      avatarUrl,
      isStaff: false,
    });
  }
  return users;
}

function buildDemoFriendUser(): SeedUser {
  const fallbackEmail = "Rodrigomagalhaesferreira@gmail.com";
  const rawEmail = (process.env.SEED_DEMO_FRIEND_EMAIL ?? fallbackEmail).trim().toLowerCase();
  const rawUsername = slugify(process.env.SEED_DEMO_FRIEND_USERNAME ?? "rodri");
  const rawFullName = (process.env.SEED_DEMO_FRIEND_FULL_NAME ?? "Rodrigo Magalhaes Ferreira").trim();
  const rawPassword = process.env.SEED_DEMO_FRIEND_PASSWORD ?? "rodri";

  return {
    email: rawEmail.length > 0 ? rawEmail : fallbackEmail.toLowerCase(),
    username: rawUsername.length > 0 ? rawUsername : "rodri",
    fullName: rawFullName.length > 0 ? rawFullName : "Rodrigo Magalhaes Ferreira",
    password: rawPassword.length > 0 ? rawPassword : "rodri",
    gender: "MALE",
    avatarUrl: null,
    isStaff: false,
  };
}

async function ensureOrganization(
  prisma: PrismaClient,
  input: {
    username: string;
    publicName: string;
    ownerUserId: string;
    officialEmail: string;
    orgType: "EXTERNAL" | "PLATFORM";
  },
): Promise<SeedOrg> {
  const existing = await prisma.organization.findUnique({ where: { username: input.username } });
  if (existing) {
    const updated = await prisma.organization.update({
      where: { id: existing.id },
      data: {
        publicName: input.publicName,
        status: "ACTIVE",
        officialEmail: input.officialEmail,
        officialEmailVerifiedAt: new Date(),
        orgType: input.orgType,
        stripeAccountId: existing.stripeAccountId ?? "acct_platform_orya_shared",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });

    await prisma.organizationGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: updated.groupId,
          userId: input.ownerUserId,
        },
      },
      update: { role: "OWNER", scopeAllOrgs: true, scopeOrgIds: [] },
      create: {
        groupId: updated.groupId,
        userId: input.ownerUserId,
        role: "OWNER",
        scopeAllOrgs: true,
        scopeOrgIds: [],
      },
    });

    await ensureGlobalUsername(prisma, input.username, "ORG", String(updated.id));

    return {
      id: updated.id,
      username: updated.username ?? input.username,
      publicName: updated.publicName,
      groupId: updated.groupId,
      ownerUserId: input.ownerUserId,
    };
  }

  const group = await prisma.organizationGroup.create({
    data: { ownerUserId: input.ownerUserId },
  });

  const org = await prisma.organization.create({
    data: {
      groupId: group.id,
      username: input.username,
      publicName: input.publicName,
      status: "ACTIVE",
      orgType: input.orgType,
      officialEmail: input.officialEmail,
      officialEmailVerifiedAt: new Date(),
      stripeAccountId: "acct_platform_orya_shared",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      timezone: "Europe/Lisbon",
      language: "pt",
    },
  });

  await prisma.organizationGroupMember.create({
    data: {
      groupId: group.id,
      userId: input.ownerUserId,
      role: "OWNER",
      scopeAllOrgs: true,
      scopeOrgIds: [],
    },
  });

  await ensureGlobalUsername(prisma, input.username, "ORG", String(org.id));

  return {
    id: org.id,
    username: org.username ?? input.username,
    publicName: org.publicName,
    groupId: org.groupId,
    ownerUserId: input.ownerUserId,
  };
}

async function upsertAddress(prisma: PrismaClient, address: string, lat: number, lng: number) {
  const hash = makeAddressHash(`${address}|${lat}|${lng}`);
  const existing = await prisma.address.findUnique({ where: { addressHash: hash } });
  if (existing) return existing;
  return prisma.address.create({
    data: {
      formattedAddress: address,
      canonical: {
        line1: address,
        city: address.split(",")[1]?.trim() ?? "Portugal",
        country: "PT",
      },
      latitude: lat,
      longitude: lng,
      sourceProvider: "APPLE_MAPS",
      sourceProviderPlaceId: `seed_${hash.slice(0, 12)}`,
      confidenceScore: 95,
      validationStatus: "VERIFIED",
      addressHash: hash,
    },
  });
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseServiceRole || !databaseUrl) {
    throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE or DATABASE_URL");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const purchaseRecords: PurchaseRecord[] = [];
  const bookingRecords: BookingRecord[] = [];
  const topPadelFinancialRecords: TopPadelFinancialRecord[] = [];
  const topPadelPurchaseSnapshots: TopPadelPurchaseSnapshot[] = [];
  const storeRefundSeeds: StoreRefundSeed[] = [];

  try {
    const nunoProfile = await prisma.profile.findUnique({ where: { username: "nuno" } });
    const miguelProfile = await prisma.profile.findUnique({ where: { username: "migueloryatest" } });

    if (!nunoProfile || !miguelProfile) {
      throw new Error("Missing required base profiles @nuno and/or @migueloryatest");
    }

    const demoFriendUser = buildDemoFriendUser();
    const generatedUsers = buildSeedUsers(98);
    generatedUsers[0] = demoFriendUser;
    const seedAuthBootstrap = process.env.SEED_CREATE_AUTH === "1";
    let seededUserIds: string[] = [];

    if (seedAuthBootstrap) {
      const authUsers = await listAllAuthUsers(supabase);
      const authByEmail = new Map<string, string>();
      for (const user of authUsers) {
        if (!user.email) continue;
        authByEmail.set(user.email.toLowerCase(), user.id);
      }

      for (const user of generatedUsers) {
        const existingId = authByEmail.get(user.email.toLowerCase());
        const shouldSyncAuth =
          process.env.SEED_SYNC_AUTH === "1" || user.email.toLowerCase() === demoFriendUser.email.toLowerCase();
        if (existingId) {
          if (shouldSyncAuth) {
            await supabase.auth.admin.updateUserById(existingId, {
              email_confirm: true,
              password: user.password,
              user_metadata: { full_name: user.fullName },
            });
          }
          user.id = existingId;
        } else {
          const created = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { full_name: user.fullName },
          });
          if (created.error || !created.data.user?.id) {
            throw created.error ?? new Error(`Failed creating user ${user.email}`);
          }
          user.id = created.data.user.id;
        }

        await prisma.profile.upsert({
          where: { id: user.id },
          update: {
            username: user.username,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
            gender: user.gender,
            roles: ["user"],
            onboardingDone: true,
            visibility: "PUBLIC",
            locationConsent: "GRANTED",
            locationGranularity: "COARSE",
          },
          create: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
            gender: user.gender,
            roles: ["user"],
            onboardingDone: true,
            visibility: "PUBLIC",
            locationConsent: "GRANTED",
            locationGranularity: "COARSE",
          },
        });

        await ensureGlobalUsername(prisma, user.username, "USER", user.id);
      }

      seededUserIds = generatedUsers.map((u) => u.id!);
    } else {
      const existingSeedProfiles = await prisma.profile.findMany({
        where: {
          id: { notIn: [nunoProfile.id, miguelProfile.id] },
        },
        orderBy: [{ createdAt: "asc" }],
        take: 98,
        select: { id: true, username: true },
      });

      if (existingSeedProfiles.length < 98) {
        throw new Error(
          "Missing seed profiles in DB. Run with SEED_CREATE_AUTH=1 once to bootstrap auth+profiles.",
        );
      }

      const demoProfile = await prisma.profile.findUnique({
        where: { username: demoFriendUser.username },
        select: { id: true, username: true },
      });
      if (!demoProfile) {
        throw new Error(
          `Missing demo profile @${demoFriendUser.username}. Run with SEED_CREATE_AUTH=1 once to bootstrap auth+profiles.`,
        );
      }
      if (!existingSeedProfiles.some((profile) => profile.id === demoProfile.id)) {
        existingSeedProfiles.push(demoProfile);
      }

      seededUserIds = existingSeedProfiles.map((profile) => profile.id);
      for (const profile of existingSeedProfiles) {
        if (profile.username) {
          await ensureGlobalUsername(prisma, profile.username, "USER", profile.id);
        }
      }
    }

    const allProfiles = await prisma.profile.findMany({
      where: {
        OR: [{ id: nunoProfile.id }, { id: miguelProfile.id }, { id: { in: seededUserIds } }],
      },
      select: { id: true, username: true, fullName: true, gender: true, avatarUrl: true },
    });

    const allUsers = allProfiles.map((p) => ({
      id: p.id,
      username: p.username ?? `user_${p.id.slice(0, 8)}`,
      fullName: p.fullName ?? "Utilizador ORYA",
      gender: (p.gender as SeedGender | null) ?? "MALE",
      avatarUrl: p.avatarUrl,
    }));
    const rodriUser =
      allUsers.find((u) => u.id === demoFriendUser.id) ??
      allUsers.find((u) => u.username.toLowerCase() === demoFriendUser.username.toLowerCase());
    if (!rodriUser) {
      throw new Error(`Missing demo friend user @${demoFriendUser.username} in seed user pool.`);
    }

    const topPadelOrg = await ensureOrganization(prisma, {
      username: "top_padel",
      publicName: "Top Padel",
      ownerUserId: miguelProfile.id,
      officialEmail: "migueloryatest@gmail.com",
      orgType: "EXTERNAL",
    });

    const oryaOrg = await ensureOrganization(prisma, {
      username: "orya",
      publicName: "ORYA",
      ownerUserId: nunoProfile.id,
      officialEmail: "admin@orya.pt",
      orgType: "PLATFORM",
    });

    const extraOrgInputs = [
      { username: "nike_padel_lab", publicName: "Nike Padel Lab", owner: allUsers[3] },
      { username: "apple_arena_lisboa", publicName: "Apple Arena Lisboa", owner: allUsers[6] },
      { username: "porto_smash_house", publicName: "Porto Smash House", owner: allUsers[9] },
      { username: "matosinhos_club", publicName: "Matosinhos Club", owner: allUsers[12] },
      { username: "lisboa_wave_padel", publicName: "Lisboa Wave Padel", owner: allUsers[15] },
      { username: "braga_center_court", publicName: "Braga Center Court", owner: allUsers[18] },
    ];

    const extraOrgs: SeedOrg[] = [];
    for (const input of extraOrgInputs) {
      const org = await ensureOrganization(prisma, {
        username: input.username,
        publicName: input.publicName,
        ownerUserId: input.owner.id,
        officialEmail: `${input.username}@orya.test`,
        orgType: "EXTERNAL",
      });
      extraOrgs.push(org);
    }

    const organizations = [topPadelOrg, oryaOrg, ...extraOrgs];

    for (const profile of allUsers) {
      await prisma.profile.update({ where: { id: profile.id }, data: { activeOrganizationId: topPadelOrg.id } });
    }

    await prisma.organizationGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: topPadelOrg.groupId,
          userId: rodriUser.id,
        },
      },
      update: { role: "CO_OWNER", scopeAllOrgs: true, scopeOrgIds: [] },
      create: {
        groupId: topPadelOrg.groupId,
        userId: rodriUser.id,
        role: "CO_OWNER",
        scopeAllOrgs: true,
        scopeOrgIds: [],
      },
    });

    const staffUsers = allUsers.filter((u) => u.id !== miguelProfile.id && u.id !== rodriUser.id).slice(0, 10);
    await prisma.organizationGroupMember.createMany({
      data: staffUsers.map((u) => ({
        groupId: topPadelOrg.groupId,
        userId: u.id,
        role: "STAFF",
        scopeAllOrgs: false,
        scopeOrgIds: [topPadelOrg.id],
      })),
      skipDuplicates: true,
    });

    await prisma.organizationGroupMember.updateMany({
      where: { groupId: topPadelOrg.groupId, userId: { in: staffUsers.map((u) => u.id) } },
      data: { role: "STAFF", scopeAllOrgs: false, scopeOrgIds: [topPadelOrg.id] },
    });

    await prisma.organizationGroupMember.updateMany({
      where: {
        groupId: topPadelOrg.groupId,
        role: "STAFF",
        userId: { notIn: staffUsers.map((u) => u.id) },
      },
      data: { role: "PROMOTER", scopeAllOrgs: false, scopeOrgIds: [topPadelOrg.id] },
    });

    const topPadelAddressData = cityPool.find((c) => c.city === "Matosinhos")!;
    const topPadelAddress = await upsertAddress(
      prisma,
      `${topPadelAddressData.address}, Portugal`,
      topPadelAddressData.lat,
      topPadelAddressData.lng,
    );

    await prisma.organization.update({
      where: { id: topPadelOrg.id },
      data: { addressId: topPadelAddress.id, showAddressPublicly: true },
    });

    await prisma.padelClub.deleteMany({ where: { organizationId: topPadelOrg.id } });
    const topClub = await prisma.padelClub.create({
      data: {
        organizationId: topPadelOrg.id,
        name: "Top Padel Club",
        shortName: "TPC",
        addressId: topPadelAddress.id,
        kind: "OWN",
        courtsCount: 8,
        hours: "07:00-23:30",
        slug: "top-padel-club",
        isActive: true,
        isDefault: true,
      },
    });

    const courts = await Promise.all(
      Array.from({ length: 8 }).map((_, index) =>
        prisma.padelClubCourt.create({
          data: {
            padelClubId: topClub.id,
            name: `Court ${index + 1}`,
            description: index < 4 ? "Panoramico" : "Padrao",
            surface: index % 2 === 0 ? "Relva sintetica" : "Mondo",
            indoor: index % 3 === 0,
            displayOrder: index,
            isActive: true,
          },
        }),
      ),
    );

    await prisma.padelClubStaff.createMany({
      data: [
        {
          padelClubId: topClub.id,
          userId: miguelProfile.id,
          role: "ADMIN_CLUBE",
          inheritToEvents: true,
          isActive: true,
        },
        {
          padelClubId: topClub.id,
          userId: rodriUser.id,
          role: "ADMIN_CLUBE",
          inheritToEvents: true,
          isActive: true,
        },
        ...staffUsers.map((u, index) => ({
          padelClubId: topClub.id,
          userId: u.id,
          role: index < 2 ? ("DIRETOR_PROVA" as const) : ("STAFF" as const),
          inheritToEvents: true,
          isActive: true,
        })),
      ],
      skipDuplicates: true,
    });

    await prisma.service.deleteMany({ where: { organizationId: topPadelOrg.id } });
    await prisma.reservationProfessional.deleteMany({ where: { organizationId: topPadelOrg.id } });
    await prisma.reservationResource.deleteMany({ where: { organizationId: topPadelOrg.id } });

    const professionals = await Promise.all(
      staffUsers.map((u, index) =>
        prisma.reservationProfessional.create({
          data: {
            organizationId: topPadelOrg.id,
            userId: u.id,
            name: u.fullName,
            roleTitle: index < 3 ? "Coach Senior" : "Coach",
            priority: index,
            isActive: true,
          },
        }),
      ),
    );

    const resources = await Promise.all(
      courts.map((court, index) =>
        prisma.reservationResource.create({
          data: {
            organizationId: topPadelOrg.id,
            courtId: court.id,
            label: court.name,
            capacity: 4,
            priority: index,
            isActive: true,
          },
        }),
      ),
    );

    const publicPolicy = await prisma.organizationPolicy.create({
      data: {
        organizationId: topPadelOrg.id,
        name: "Demo Public Booking",
        policyType: "FLEXIBLE",
        guestBookingAllowed: true,
        cancellationWindowMinutes: 24 * 60,
        rescheduleWindowMinutes: 24 * 60,
      },
    });

    const serviceCourt = await prisma.service.create({
      data: {
        organizationId: topPadelOrg.id,
        policyId: publicPolicy.id,
        kind: "COURT",
        title: "Aluguer de Campo 60m",
        description: "Reserva rapida de campo para jogo livre.",
        durationMinutes: 60,
        unitPriceCents: 2200,
        currency: "EUR",
        assignmentMode: "RESOURCE_ONLY",
        partySizeRequired: true,
        partySizeMin: 2,
        partySizeMax: 4,
        partySizeStep: 1,
        locationMode: "FIXED",
        addressId: topPadelAddress.id,
      },
    });

    const serviceClass = await prisma.service.create({
      data: {
        organizationId: topPadelOrg.id,
        policyId: publicPolicy.id,
        kind: "CLASS",
        title: "Aula Particular 60m",
        description: "Sessao one-to-one com treinador.",
        durationMinutes: 60,
        unitPriceCents: 3500,
        currency: "EUR",
        assignmentMode: "PROFESSIONAL_ONLY",
        partySizeRequired: false,
        partySizeMin: 1,
        partySizeMax: 1,
        partySizeStep: 1,
        locationMode: "FIXED",
        addressId: topPadelAddress.id,
      },
    });

    const serviceHybrid = await prisma.service.create({
      data: {
        organizationId: topPadelOrg.id,
        policyId: publicPolicy.id,
        kind: "COURT",
        title: "Treino Premium 90m",
        description: "Treino intensivo em campo reservado com treinador.",
        durationMinutes: 90,
        unitPriceCents: 5200,
        currency: "EUR",
        assignmentMode: "PROFESSIONAL_AND_RESOURCE",
        partySizeRequired: true,
        partySizeMin: 2,
        partySizeMax: 4,
        partySizeStep: 1,
        locationMode: "FIXED",
        addressId: topPadelAddress.id,
      },
    });

    await prisma.serviceResourceLink.createMany({
      data: resources.map((r) => ({ serviceId: serviceCourt.id, resourceId: r.id })),
      skipDuplicates: true,
    });

    await prisma.serviceProfessionalLink.createMany({
      data: professionals.map((p) => ({ serviceId: serviceClass.id, professionalId: p.id })),
      skipDuplicates: true,
    });

    await prisma.serviceProfessionalLink.createMany({
      data: professionals.slice(0, 5).map((p) => ({ serviceId: serviceHybrid.id, professionalId: p.id })),
      skipDuplicates: true,
    });

    await prisma.serviceResourceLink.createMany({
      data: resources.slice(0, 6).map((r) => ({ serviceId: serviceHybrid.id, resourceId: r.id })),
      skipDuplicates: true,
    });

    const toUtcDateOnly = (date: Date) =>
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    await prisma.availabilitySchedule.deleteMany({
      where: {
        organizationId: topPadelOrg.id,
        scopeType: { in: ["PROFESSIONAL", "RESOURCE"] },
      },
    });
    await prisma.availabilityOverride.deleteMany({
      where: {
        organizationId: topPadelOrg.id,
        scopeType: { in: ["PROFESSIONAL", "RESOURCE"] },
      },
    });

    const scheduleStart = toUtcDateOnly(now);
    const professionalSchedules = await Promise.all(
      professionals.map((professional) =>
        prisma.availabilitySchedule.create({
          data: {
            organizationId: topPadelOrg.id,
            scopeType: "PROFESSIONAL",
            scopeId: professional.id,
            startDate: scheduleStart,
          },
          select: { id: true, scopeId: true },
        }),
      ),
    );
    const professionalScheduleById = new Map(professionalSchedules.map((schedule) => [schedule.scopeId, schedule.id]));

    const professionalTemplates = professionals.flatMap((professional, index) => {
      const availabilityId = professionalScheduleById.get(professional.id);
      if (!availabilityId) return [];
      const firstShiftStart = 8 * 60 + (index % 3) * 30;
      const secondShiftStart = 14 * 60 + (index % 2) * 15;
      const secondShiftEnd = 19 * 60 - (index % 2) * 15;
      return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        availabilityId,
        dayOfWeek,
        intervals: [
          { startMinute: firstShiftStart, endMinute: 12 * 60 + 30 },
          { startMinute: secondShiftStart, endMinute: secondShiftEnd },
        ],
      }));
    });
    await prisma.weeklyAvailabilityTemplate.createMany({
      data: professionalTemplates,
      skipDuplicates: true,
    });

    const resourceSchedules = await Promise.all(
      resources.map((resource) =>
        prisma.availabilitySchedule.create({
          data: {
            organizationId: topPadelOrg.id,
            scopeType: "RESOURCE",
            scopeId: resource.id,
            startDate: scheduleStart,
          },
          select: { id: true, scopeId: true },
        }),
      ),
    );
    const resourceScheduleById = new Map(resourceSchedules.map((schedule) => [schedule.scopeId, schedule.id]));

    const resourceTemplates = resources.flatMap((resource, index) => {
      const availabilityId = resourceScheduleById.get(resource.id);
      if (!availabilityId) return [];
      const startMinute = 7 * 60 + (index % 2) * 30;
      const endMinute = 23 * 60 - (index % 3) * 15;
      return [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        availabilityId,
        dayOfWeek,
        intervals: [{ startMinute, endMinute }],
      }));
    });
    await prisma.weeklyAvailabilityTemplate.createMany({
      data: resourceTemplates,
      skipDuplicates: true,
    });

    const overrideRows = [] as Array<{
      organizationId: number;
      scopeType: "PROFESSIONAL" | "RESOURCE";
      scopeId: number;
      date: Date;
      kind: "BLOCK" | "CLOSED";
      intervals: Array<{ startMinute: number; endMinute: number }>;
    }>;

    professionals.forEach((professional, index) => {
      const offDay = toUtcDateOnly(plusDays(now, 3 + index));
      overrideRows.push({
        organizationId: topPadelOrg.id,
        scopeType: "PROFESSIONAL",
        scopeId: professional.id,
        date: offDay,
        kind: "CLOSED",
        intervals: [],
      });
      const blockDay = toUtcDateOnly(plusDays(now, 10 + index));
      overrideRows.push({
        organizationId: topPadelOrg.id,
        scopeType: "PROFESSIONAL",
        scopeId: professional.id,
        date: blockDay,
        kind: "BLOCK",
        intervals: [{ startMinute: 16 * 60, endMinute: 18 * 60 }],
      });
    });

    resources.forEach((resource, index) => {
      const maintenanceDay = toUtcDateOnly(plusDays(now, 5 + index));
      overrideRows.push({
        organizationId: topPadelOrg.id,
        scopeType: "RESOURCE",
        scopeId: resource.id,
        date: maintenanceDay,
        kind: "BLOCK",
        intervals: [{ startMinute: 12 * 60, endMinute: 14 * 60 }],
      });
      if (index % 3 === 0) {
        const closedDay = toUtcDateOnly(plusDays(now, 16 + index));
        overrideRows.push({
          organizationId: topPadelOrg.id,
          scopeType: "RESOURCE",
          scopeId: resource.id,
          date: closedDay,
          kind: "CLOSED",
          intervals: [],
        });
      }
    });

    if (overrideRows.length > 0) {
      await prisma.availabilityOverride.createMany({
        data: overrideRows,
      });
    }

    await prisma.promoCode.deleteMany({ where: { code: { startsWith: "SEEDTP" } } });
    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [{ paymentId: { startsWith: "pay_evt_" } }, { paymentId: { startsWith: "pay_store_" } }],
      },
    });
    await prisma.paymentSnapshot.deleteMany({
      where: {
        OR: [
          { paymentId: { startsWith: "pay_evt_" } },
          { paymentId: { startsWith: "pay_store_" } },
          { paymentId: { startsWith: "seed-evt-" } },
          { paymentId: { startsWith: "seed-store-purchase-" } },
        ],
      },
    });
    await prisma.payment.deleteMany({
      where: {
        OR: [
          { id: { startsWith: "pay_evt_" } },
          { id: { startsWith: "pay_store_" } },
          { id: { startsWith: "seed-evt-" } },
          { id: { startsWith: "seed-store-purchase-" } },
        ],
      },
    });
    await prisma.refund.deleteMany({
      where: {
        dedupeKey: { startsWith: "seed_refund_" },
      },
    });
    await prisma.invoice.deleteMany({
      where: {
        invoiceNumber: { startsWith: "SEED-TP-" },
      },
    });
    await prisma.payout.deleteMany({
      where: {
        OR: [
          { sourceId: { startsWith: "seed-payout-batch-" } },
          { paymentId: { startsWith: "pay_evt_" } },
          { paymentId: { startsWith: "pay_store_" } },
        ],
      },
    });
    const promoCodes = await Promise.all(
      [
        { code: "SEEDTP10", type: "PERCENTAGE", value: 10 },
        { code: "SEEDTP15", type: "PERCENTAGE", value: 15 },
        { code: "SEEDTP500", type: "FIXED", value: 500 },
        { code: "SEEDTP20", type: "PERCENTAGE", value: 20 },
      ].map((promo) =>
        prisma.promoCode.create({
          data: {
            code: promo.code,
            type: promo.type as "PERCENTAGE" | "FIXED",
            value: promo.value,
            organizationId: topPadelOrg.id,
            promoterUserId: miguelProfile.id,
            maxUses: 400,
            perUserLimit: 20,
            validFrom: plusDays(now, -30),
            validUntil: plusDays(now, 120),
            active: true,
            autoApply: false,
          },
        }),
      ),
    );

    await prisma.event.deleteMany({
      where: { OR: [{ slug: { startsWith: "seed-event-" } }, { slug: { startsWith: "seed-tournament-" } }] },
    });

    const standardEventSoldTargets = [25, 20, 18, 12, 10, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1, 0, 0, 4, 5];
    const forcedSoldOutEventIndexes = new Set([0, 2, 4]);
    const standardEvents = [] as Array<{ id: number; organizationId: number; startsAt: Date }>;
    const topPadelStandardEventCount = Math.min(12, SEED_VOLUME.standardEvents);
    console.log("[seed] building standard events...");

    for (let i = 0; i < SEED_VOLUME.standardEvents; i += 1) {
      if (i % 5 === 0) {
        console.log(`[seed] standard events progress ${i + 1}/${SEED_VOLUME.standardEvents}`);
      }
      const city = cityPool[i % cityPool.length];
      const address = await upsertAddress(prisma, `${city.address}, Portugal`, city.lat, city.lng);
      const org = i < topPadelStandardEventCount ? topPadelOrg : extraOrgs[i % extraOrgs.length];
      const ownerUserId = org.ownerUserId;
      const startsAt = i < 5 ? plusDays(now, -40 + i * 7) : plusDays(now, 4 + (i - 5) * 5);
      const endsAt = plusMinutes(startsAt, 240 + randInt(0, 180));

      const event = await prisma.event.create({
        data: {
          slug: `seed-event-${String(i + 1).padStart(2, "0")}`,
          title: `${i < 5 ? "Open Social" : "Evento Social"} ${city.city} ${i + 1}`,
          description: `Evento publicado para testes reais em ${city.city}, com bilhetes, participantes e vendas.`,
          templateType: "OTHER",
          organizationId: org.id,
          ownerUserId,
          startsAt,
          endsAt,
          addressId: address.id,
          timezone: "Europe/Lisbon",
          status: "PUBLISHED",
          pricingMode: "STANDARD",
          coverImageUrl: seedCoverUrl("event", i),
          feeMode: "INCLUDED",
          payoutMode: "ORGANIZATION",
        },
      });

      standardEvents.push({ id: event.id, organizationId: org.id, startsAt });

      const soldTarget = standardEventSoldTargets[i] ?? randInt(0, 20);
      const isFreeOnly = i % 6 === 0;

      const baseTicketTypes = [
        {
          name: "Early Bird",
          price: isFreeOnly ? 0 : 1200 + i * 25,
          totalQuantity: soldTarget > 0 ? Math.max(Math.round(soldTarget * 0.4), 5) : 20,
        },
        {
          name: "Geral",
          price: isFreeOnly ? 0 : 1800 + i * 30,
          totalQuantity: Math.max(soldTarget + randInt(6, 18), 30),
        },
      ];

      if (i % 4 === 1) {
        baseTicketTypes.push({
          name: "VIP",
          price: isFreeOnly ? 0 : 3200 + i * 40,
          totalQuantity: Math.max(randInt(8, 20), soldTarget > 0 ? Math.round(soldTarget * 0.2) : 8),
        });
      }

      if (forcedSoldOutEventIndexes.has(i)) {
        const typeCount = baseTicketTypes.length;
        const expectedSoldByType = Array.from({ length: typeCount }, (_, idx) => {
          const base = Math.floor(soldTarget / typeCount);
          const extra = idx < soldTarget % typeCount ? 1 : 0;
          return base + extra;
        });
        for (let idx = 0; idx < baseTicketTypes.length; idx += 1) {
          baseTicketTypes[idx]!.totalQuantity = Math.max(1, expectedSoldByType[idx] ?? 1);
        }
      }

      const createdTicketTypes = [] as Array<{ id: number; price: number; totalQuantity: number }>;
      for (let typeIndex = 0; typeIndex < baseTicketTypes.length; typeIndex += 1) {
        const t = baseTicketTypes[typeIndex];
        const created = await prisma.ticketType.create({
          data: {
            eventId: event.id,
            name: t.name,
            description: `${t.name} - ${event.title}`,
            price: t.price,
            currency: "EUR",
            totalQuantity: t.totalQuantity,
            soldQuantity: 0,
            status: "ON_SALE",
            sortOrder: typeIndex,
            startsAt: plusDays(startsAt, -30),
            endsAt: endsAt,
          },
        });
        createdTicketTypes.push({ id: created.id, price: t.price, totalQuantity: t.totalQuantity });
      }

      const soldByType = new Map<number, number>();
      for (const type of createdTicketTypes) soldByType.set(type.id, 0);

      for (let saleIndex = 0; saleIndex < soldTarget; saleIndex += 1) {
        const buyer = allUsers[(i * 17 + saleIndex * 13) % allUsers.length];
        const selectedType = createdTicketTypes[saleIndex % createdTicketTypes.length];

        const subtotal = selectedType.price;
        const applyPromo = subtotal > 0 && maybe(0.18);
        const promo = applyPromo ? pick(promoCodes) : null;
        const discount = promo
          ? promo.type === "PERCENTAGE"
            ? roundCents((subtotal * promo.value) / 100)
            : Math.min(subtotal, promo.value)
          : 0;
        const total = Math.max(0, subtotal - discount);
        const platformFee = total > 0 ? roundCents(total * 0.08) : 0;
        const processorFee = total > 0 ? roundCents(total * 0.017) : 0;
        const net = total - platformFee - processorFee;

        const purchaseId = `seed-evt-${event.id}-p-${String(saleIndex + 1).padStart(4, "0")}`;
        const shouldCreatePayment = total > 0 && maybe(0.65);
        const paymentIntentId = shouldCreatePayment
          ? `pi_seed_evt_${event.id}_${String(saleIndex + 1).padStart(4, "0")}`
          : null;
        const seededPaymentStatus = resolveSeedPaymentStatus({
          index: i * 100 + saleIndex,
          grossCents: total,
        });
        const seededRefundedByStatus =
          seededPaymentStatus === "REFUNDED"
            ? total
            : seededPaymentStatus === "PARTIAL_REFUND"
              ? Math.max(100, roundCents(total * 0.35))
              : 0;

        const summary = await prisma.saleSummary.create({
          data: {
            eventId: event.id,
            userId: buyer.id,
            ownerUserId: buyer.id,
            purchaseId,
            paymentIntentId,
            promoCodeId: promo?.id,
            promoCodeSnapshot: promo?.code,
            promoLabelSnapshot: promo ? `${promo.code}` : null,
            promoTypeSnapshot: promo?.type as "PERCENTAGE" | "FIXED" | undefined,
            promoValueSnapshot: promo?.value,
            subtotalCents: subtotal,
            discountCents: discount,
            platformFeeCents: platformFee,
            cardPlatformFeeCents: 0,
            stripeFeeCents: processorFee,
            totalCents: total,
            netCents: net,
            feeMode: "INCLUDED",
            paymentMethod: total > 0 ? "card" : "free",
            currency: "EUR",
            status: "PAID",
          },
        });

        await prisma.saleLine.create({
          data: {
            saleSummaryId: summary.id,
            eventId: event.id,
            ticketTypeId: selectedType.id,
            promoCodeId: promo?.id,
            promoCodeSnapshot: promo?.code,
            promoLabelSnapshot: promo?.code,
            promoTypeSnapshot: promo?.type as "PERCENTAGE" | "FIXED" | undefined,
            promoValueSnapshot: promo?.value,
            quantity: 1,
            unitPriceCents: subtotal,
            discountPerUnitCents: discount,
            grossCents: subtotal,
            netCents: total,
            platformFeeCents: platformFee,
          },
        });

        if (promo) {
          await prisma.promoRedemption.createMany({
            data: [
              {
                promoCodeId: promo.id,
                userId: buyer.id,
                purchaseId,
              },
            ],
            skipDuplicates: true,
          });
        }

        await prisma.ticket.create({
          data: {
            eventId: event.id,
            ticketTypeId: selectedType.id,
            pricePaid: total,
            currency: "EUR",
            userId: buyer.id,
            ownerUserId: buyer.id,
            platformFeeCents: platformFee,
            totalPaidCents: total,
            purchaseId,
            stripePaymentIntentId: paymentIntentId,
            qrSecret: crypto.randomUUID(),
            saleSummaryId: summary.id,
            status: "ACTIVE",
          },
        });

        soldByType.set(selectedType.id, (soldByType.get(selectedType.id) ?? 0) + 1);

        if (shouldCreatePayment && paymentIntentId) {
          const paymentId = `pay_evt_${event.id}_${String(saleIndex + 1).padStart(4, "0")}`;
          await prisma.payment.create({
            data: {
              id: paymentId,
              organizationId: org.id,
              sourceType: "TICKET_ORDER",
              sourceId: purchaseId,
              customerIdentityId: buyer.id,
              status: seededPaymentStatus,
              feePolicyVersion: "seed-v1",
              pricingSnapshotJson: {
                subtotalCents: subtotal,
                discountCents: discount,
                totalCents: total,
                platformFeeCents: platformFee,
                processorFeeCents: processorFee,
                seededPaymentStatus,
                refundedCents: seededRefundedByStatus,
              },
              pricingSnapshotHash: makeAddressHash(`${purchaseId}:${total}`),
              processorFeesStatus: "FINAL",
              processorFeesActual: processorFee,
              idempotencyKey: `seed_evt_idemp_${purchaseId}`,
            },
          });

          if (org.id === topPadelOrg.id) {
            topPadelFinancialRecords.push({
              organizationId: topPadelOrg.id,
              paymentId,
              purchaseId,
              sourceType: "TICKET_ORDER",
              sourceId: purchaseId,
              customerIdentityId: buyer.id,
              paymentIntentId,
              paymentStatus: seededPaymentStatus,
              grossCents: total,
              platformFeeCents: platformFee,
              processorFeeCents: processorFee,
              netToOrgCents: net,
              refundedCents: seededRefundedByStatus,
              currency: "EUR",
              occurredAt: startsAt,
              eventId: event.id,
            });
          }
        }

        if (org.id === topPadelOrg.id) {
          topPadelPurchaseSnapshots.push({
            organizationId: topPadelOrg.id,
            paymentId: purchaseId,
            purchaseId,
            sourceType: "TICKET_ORDER",
            sourceId: purchaseId,
            customerIdentityId: buyer.id,
            paymentIntentId,
            grossCents: total,
            platformFeeCents: platformFee,
            processorFeeCents: processorFee,
            netToOrgCents: net,
            currency: "EUR",
            occurredAt: startsAt,
            eventId: event.id,
          });
        }

        purchaseRecords.push({
          organizationId: org.id,
          userId: buyer.id,
          amountCents: total,
          occurredAt: startsAt,
          sourceType: "EVENT_TICKET",
          sourceId: purchaseId,
        });
      }

      for (const type of createdTicketTypes) {
        await prisma.ticketType.update({
          where: { id: type.id },
          data: {
            soldQuantity: soldByType.get(type.id) ?? 0,
            status:
              (soldByType.get(type.id) ?? 0) >= type.totalQuantity
                ? "SOLD_OUT"
                : "ON_SALE",
          },
        });
      }
    }

    const categoryByOrg = new Map<number, Array<{ id: number; label: string }>>();
    const playerProfileCache = new Map<string, { id: number; organizationId: number; userId: string }>();

    async function ensureCategoriesForOrg(orgId: number) {
      if (categoryByOrg.has(orgId)) return categoryByOrg.get(orgId)!;
      const existing = await prisma.padelCategory.findMany({ where: { organizationId: orgId } });
      const items = existing.length
        ? existing
        : await Promise.all(
            [
              { label: "M3", min: "3.00", max: "3.99", genderRestriction: null },
              { label: "M4", min: "4.00", max: "4.99", genderRestriction: null },
              { label: "F3", min: "3.00", max: "3.99", genderRestriction: "FEMALE" },
              { label: "Misto", min: "3.00", max: "4.50", genderRestriction: "MIXED" },
            ].map((entry, index) =>
              prisma.padelCategory.create({
                data: {
                  organizationId: orgId,
                  label: entry.label,
                  minLevel: entry.min,
                  maxLevel: entry.max,
                  genderRestriction: entry.genderRestriction,
                  isDefault: index === 0,
                  isActive: true,
                  season: "2026",
                  year: 2026,
                },
              }),
            ),
          );
      const slim = items.map((item) => ({ id: item.id, label: item.label }));
      categoryByOrg.set(orgId, slim);
      return slim;
    }

    async function ensurePlayerProfile(orgId: number, user: { id: string; fullName: string; username: string; gender: SeedGender }) {
      const key = `${orgId}:${user.id}`;
      const cached = playerProfileCache.get(key);
      if (cached) return cached;
      const existing = await prisma.padelPlayerProfile.findFirst({
        where: { organizationId: orgId, userId: user.id },
        select: { id: true },
      });
      const payload = {
        fullName: user.fullName,
        email: `${user.username}@orya.test`,
        gender: user.gender,
        level: `${randInt(2, 6)}.${randInt(0, 99).toString().padStart(2, "0")}`,
        displayName: user.fullName,
        preferredSide: maybe(0.45) ? "ESQUERDA" : maybe(0.5) ? "DIREITA" : "QUALQUER",
        clubName: orgId === topPadelOrg.id ? "Top Padel Club" : null,
        isActive: true,
      } as const;

      const upserted = existing
        ? await prisma.padelPlayerProfile.update({
            where: { id: existing.id },
            data: payload,
          })
        : await prisma.padelPlayerProfile.create({
            data: {
              organizationId: orgId,
              userId: user.id,
              ...payload,
            },
          });
      const out = { id: upserted.id, organizationId: orgId, userId: user.id };
      playerProfileCache.set(key, out);
      return out;
    }

    const tournamentEvents: Array<{ id: number; organizationId: number; startsAt: Date; categoryId: number }> = [];
    const topPadelTournamentIds: number[] = [];
    const topPadelMatchRecords: Array<{
      matchId: number;
      eventId: number;
      date: Date;
      status: "OFFICIAL" | "WALKOVER" | "RETIRED";
      winnerSide: "A" | "B";
      participantBySide: { A: number[]; B: number[] };
    }> = [];
    const topPadelTournamentSeedCount = Math.min(10, SEED_VOLUME.tournaments);

    console.log("[seed] building tournaments and pairings...");
    for (let i = 0; i < SEED_VOLUME.tournaments; i += 1) {
      console.log(`[seed] tournament progress ${i + 1}/${SEED_VOLUME.tournaments}`);
      const org = i < topPadelTournamentSeedCount ? topPadelOrg : extraOrgs[i % extraOrgs.length];
      const categories = await ensureCategoriesForOrg(org.id);
      const category = categories[i % categories.length];
      const city = cityPool[(i + 4) % cityPool.length];
      const address = await upsertAddress(prisma, `${city.address}, Portugal`, city.lat, city.lng);

      let startsAt: Date;
      if (org.id === topPadelOrg.id) {
        if (topPadelTournamentIds.length < 3) {
          const firstDayCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5));
          startsAt = plusDays(firstDayCurrentMonth, topPadelTournamentIds.length * 7 + randInt(0, 2));
        } else if (topPadelTournamentIds.length < 5) {
          const firstDayNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 4));
          startsAt = plusDays(firstDayNextMonth, (topPadelTournamentIds.length - 3) * 7 + randInt(0, 2));
        } else {
          const firstDayMonthPlus2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 3));
          startsAt = plusDays(firstDayMonthPlus2, (topPadelTournamentIds.length - 5) * 6 + randInt(0, 2));
        }
      } else {
        startsAt = plusDays(now, 12 + i * 4);
      }
      const endsAt = plusMinutes(startsAt, 600);

      const event = await prisma.event.create({
        data: {
          slug: `seed-tournament-${String(i + 1).padStart(2, "0")}`,
          title: `Torneio Padel ${city.city} ${i + 1}`,
          description: `Torneio competitivo com categorias e duplas inscritas em ${city.city}.`,
          templateType: "PADEL",
          organizationId: org.id,
          ownerUserId: org.ownerUserId,
          startsAt,
          endsAt,
          addressId: address.id,
          timezone: "Europe/Lisbon",
          status: "PUBLISHED",
          pricingMode: "STANDARD",
          coverImageUrl: seedCoverUrl("tournament", i),
          feeMode: "INCLUDED",
          payoutMode: "ORGANIZATION",
        },
      });

      if (org.id === topPadelOrg.id) topPadelTournamentIds.push(event.id);

      const selectedFormat = pick([...tournamentFormats]);
      const interclub = maybe(0.22);
      await prisma.$executeRaw`
        INSERT INTO app_v3.padel_tournament_configs (
          event_id,
          organization_id,
          format,
          number_of_courts,
          default_category_id,
          enabled_formats,
          is_interclub,
          padel_v2_enabled,
          split_deadline_hours,
          padel_club_id,
          advanced_settings,
          pending_confirmation_window_minutes,
          player_result_submission_enabled,
          lifecycle_status,
          published_at,
          lifecycle_updated_at,
          eligibility_type,
          env
        )
        VALUES (
          ${event.id},
          ${org.id},
          ${selectedFormat}::app_v3.padel_format,
          ${org.id === topPadelOrg.id ? 6 : 3},
          ${category.id},
          ${["TODOS_CONTRA_TODOS", "QUADRO_ELIMINATORIO"]}::text[],
          ${interclub},
          ${true},
          ${24},
          ${org.id === topPadelOrg.id ? topClub.id : null},
          ${JSON.stringify({ autoSchedule: true, generatedBySeed: true })}::jsonb,
          ${15},
          ${true},
          ${"PUBLISHED"}::app_v3."PadelTournamentLifecycleStatus",
          ${plusDays(startsAt, -20)},
          ${now},
          ${"OPEN"}::app_v3."PadelEligibilityType",
          ${"prod"}
        )
        ON CONFLICT (event_id) DO UPDATE
        SET
          organization_id = EXCLUDED.organization_id,
          format = EXCLUDED.format,
          number_of_courts = EXCLUDED.number_of_courts,
          default_category_id = EXCLUDED.default_category_id,
          enabled_formats = EXCLUDED.enabled_formats,
          is_interclub = EXCLUDED.is_interclub,
          padel_v2_enabled = EXCLUDED.padel_v2_enabled,
          split_deadline_hours = EXCLUDED.split_deadline_hours,
          padel_club_id = EXCLUDED.padel_club_id,
          advanced_settings = EXCLUDED.advanced_settings,
          pending_confirmation_window_minutes = EXCLUDED.pending_confirmation_window_minutes,
          player_result_submission_enabled = EXCLUDED.player_result_submission_enabled,
          lifecycle_status = EXCLUDED.lifecycle_status,
          published_at = EXCLUDED.published_at,
          lifecycle_updated_at = EXCLUDED.lifecycle_updated_at,
          eligibility_type = EXCLUDED.eligibility_type
      `;

      const tournament = await prisma.tournament.create({
        data: {
          eventId: event.id,
          format: pick([...tournamentTableFormats]),
          generationSeed: `seed_${RNG_SEED}_${i}`,
          generatedAt: plusDays(startsAt, -10),
          generatedByUserId: org.ownerUserId,
          inscriptionDeadlineAt: plusDays(startsAt, -1),
          tieBreakRules: { games: true, points: true },
          config: { source: "seed" },
        },
      });

      const stage = await prisma.tournamentStage.create({
        data: {
          tournamentId: tournament.id,
          name: "Fase Principal",
          stageType: "GROUPS",
          order: 0,
        },
      });

      await prisma.tournamentGroup.createMany({
        data: [
          { stageId: stage.id, name: "Grupo A", order: 0 },
          { stageId: stage.id, name: "Grupo B", order: 1 },
        ],
      });

      const categoryLink = await prisma.padelEventCategoryLink.create({
        data: {
          eventId: event.id,
          padelCategoryId: category.id,
          format: "TODOS_CONTRA_TODOS",
          capacityTeams: i < 5 ? 32 : 20,
          capacityPlayers: i < 5 ? 64 : 40,
          pricePerPlayerCents: 2500 + i * 40,
          currency: "EUR",
          isEnabled: true,
          isHidden: false,
        },
      });

      const registrationPrice = Math.max(categoryLink.pricePerPlayerCents ?? 0, 0);
      const registrationStock =
        categoryLink.capacityPlayers ?? categoryLink.capacityTeams ?? 96;
      const tournamentTicketTypes: Array<{
        name: string;
        description: string;
        price: number;
        totalQuantity: number;
        padelEventCategoryLinkId: number | null;
      }> = [
        {
          name: "Inscrição Atleta",
          description: `Inscrição oficial por atleta para ${event.title}.`,
          price: registrationPrice,
          totalQuantity: Math.max(registrationStock, 32),
          padelEventCategoryLinkId: categoryLink.id,
        },
      ];

      if (i % 4 === 0) {
        tournamentTicketTypes.push({
          name: "Entrada Público",
          description: `Entrada de público para ${event.title}.`,
          price: 800 + i * 10,
          totalQuantity: 240,
          padelEventCategoryLinkId: null,
        });
      }

      if (i % 5 === 0) {
        tournamentTicketTypes.push({
          name: "Passe Staff",
          description: `Passe gratuito de staff para ${event.title}.`,
          price: 0,
          totalQuantity: 40,
          padelEventCategoryLinkId: null,
        });
      }

      for (let ticketIndex = 0; ticketIndex < tournamentTicketTypes.length; ticketIndex += 1) {
        const ticketType = tournamentTicketTypes[ticketIndex]!;
        await prisma.ticketType.create({
          data: {
            eventId: event.id,
            padelEventCategoryLinkId: ticketType.padelEventCategoryLinkId,
            name: ticketType.name,
            description: ticketType.description,
            price: ticketType.price,
            currency: "EUR",
            totalQuantity: ticketType.totalQuantity,
            soldQuantity: 0,
            status: "ON_SALE",
            sortOrder: ticketIndex,
            startsAt: plusDays(startsAt, -30),
            endsAt: plusMinutes(startsAt, -30),
          },
        });
      }

      const pairingCount = i < 5 ? randInt(14, 18) : randInt(8, 12);
      const userPool = [...allUsers].sort(() => rand() - 0.5);
      const usedInEvent = new Set<string>();
      const pairings: Array<{ id: number; userA: string; userB: string; participants: number[]; playerIds: number[] }> = [];

      for (let p = 0; p < pairingCount && userPool.length >= 2; p += 1) {
        const userA = userPool.find((u) => !usedInEvent.has(u.id));
        if (!userA) break;
        usedInEvent.add(userA.id);
        const userB = userPool.find((u) => u.id !== userA.id && !usedInEvent.has(u.id));
        if (!userB) break;
        usedInEvent.add(userB.id);

        const playerA = await ensurePlayerProfile(org.id, userA);
        const playerB = await ensurePlayerProfile(org.id, userB);

        const pairing = await prisma.padelPairing.create({
          data: {
            eventId: event.id,
            organizationId: org.id,
            categoryId: category.id,
            player1UserId: userA.id,
            player2UserId: userB.id,
            payment_mode: "FULL",
            pairingStatus: "COMPLETE",
            pairingJoinMode: "INVITE_PARTNER",
            createdByUserId: org.ownerUserId,
            isPublicOpen: false,
            deadlineAt: plusDays(startsAt, -2),
            partnerAcceptedAt: plusDays(startsAt, -10),
            partnerPaidAt: plusDays(startsAt, -8),
            guaranteeStatus: "SUCCEEDED",
          },
        });

        await prisma.padelPairingSlot.createMany({
          data: [
            {
              pairingId: pairing.id,
              profileId: userA.id,
              slot_role: "CAPTAIN",
              slotStatus: "FILLED",
              paymentStatus: "PAID",
              isPublicOpen: false,
              playerProfileId: playerA.id,
            },
            {
              pairingId: pairing.id,
              profileId: userB.id,
              slot_role: "PARTNER",
              slotStatus: "FILLED",
              paymentStatus: "PAID",
              isPublicOpen: false,
              playerProfileId: playerB.id,
            },
          ],
        });

        await prisma.tournamentEntry.createMany({
          data: [
            {
              eventId: event.id,
              userId: userA.id,
              categoryId: category.id,
              pairingId: pairing.id,
              role: "CAPTAIN",
              status: "CONFIRMED",
              ownerUserId: userA.id,
              purchaseId: `seed_tour_entry_${event.id}_${pairing.id}_a`,
            },
            {
              eventId: event.id,
              userId: userB.id,
              categoryId: category.id,
              pairingId: pairing.id,
              role: "PARTNER",
              status: "CONFIRMED",
              ownerUserId: userB.id,
              purchaseId: `seed_tour_entry_${event.id}_${pairing.id}_b`,
            },
          ],
          skipDuplicates: true,
        });

        const participantAExisting = await prisma.padelTournamentParticipant.findFirst({
          where: {
            eventId: event.id,
            categoryId: category.id,
            playerProfileId: playerA.id,
          },
          select: { id: true },
        });
        const participantA = participantAExisting
          ? await prisma.padelTournamentParticipant.update({
              where: { id: participantAExisting.id },
              data: { sourcePairingId: pairing.id, status: "ACTIVE" },
            })
          : await prisma.padelTournamentParticipant.create({
              data: {
                eventId: event.id,
                categoryId: category.id,
                organizationId: org.id,
                playerProfileId: playerA.id,
                sourcePairingId: pairing.id,
                status: "ACTIVE",
              },
            });

        const participantBExisting = await prisma.padelTournamentParticipant.findFirst({
          where: {
            eventId: event.id,
            categoryId: category.id,
            playerProfileId: playerB.id,
          },
          select: { id: true },
        });
        const participantB = participantBExisting
          ? await prisma.padelTournamentParticipant.update({
              where: { id: participantBExisting.id },
              data: { sourcePairingId: pairing.id, status: "ACTIVE" },
            })
          : await prisma.padelTournamentParticipant.create({
              data: {
                eventId: event.id,
                categoryId: category.id,
                organizationId: org.id,
                playerProfileId: playerB.id,
                sourcePairingId: pairing.id,
                status: "ACTIVE",
              },
            });

        pairings.push({
          id: pairing.id,
          userA: userA.id,
          userB: userB.id,
          participants: [participantA.id, participantB.id],
          playerIds: [playerA.id, playerB.id],
        });
      }

      const openPairingsTarget = org.id === topPadelOrg.id ? randInt(1, 3) : randInt(0, 1);
      for (let openIndex = 0; openIndex < openPairingsTarget; openIndex += 1) {
        const captain = userPool.find((candidate) => !usedInEvent.has(candidate.id));
        if (!captain) break;
        usedInEvent.add(captain.id);
        const captainPlayer = await ensurePlayerProfile(org.id, captain);

        const openPairing = await prisma.padelPairing.create({
          data: {
            eventId: event.id,
            organizationId: org.id,
            categoryId: category.id,
            player1UserId: captain.id,
            player2UserId: null,
            payment_mode: "SPLIT",
            pairingStatus: "INCOMPLETE",
            pairingJoinMode: "LOOKING_FOR_PARTNER",
            createdByUserId: captain.id,
            isPublicOpen: true,
            deadlineAt: plusDays(startsAt, -1),
            guaranteeStatus: "NONE",
          },
        });

        await prisma.padelPairingSlot.createMany({
          data: [
            {
              pairingId: openPairing.id,
              profileId: captain.id,
              slot_role: "CAPTAIN",
              slotStatus: "FILLED",
              paymentStatus: "PAID",
              isPublicOpen: false,
              playerProfileId: captainPlayer.id,
            },
            {
              pairingId: openPairing.id,
              profileId: null,
              slot_role: "PARTNER",
              slotStatus: "PENDING",
              paymentStatus: "UNPAID",
              invitedContact: null,
              isPublicOpen: true,
              playerProfileId: null,
            },
          ],
        });
      }

      if (pairings.length >= 4) {
        const round = await prisma.padelRound.create({
          data: {
            eventId: event.id,
            categoryId: category.id,
            organizationId: org.id,
            roundKey: `seed_round_${event.id}_1`,
            phase: "GROUPS",
            roundNumber: 1,
            groupLabel: "A",
            state: "CLOSED",
            scoreMode: "SETS",
            startsAt: startsAt,
            endsAt: plusMinutes(startsAt, 180),
            timerState: "STOPPED",
          },
        });

        const matchCount = Math.min(Math.floor(pairings.length / 2), 8);
        for (let m = 0; m < matchCount; m += 1) {
          const pairingA = pairings[m * 2];
          const pairingB = pairings[m * 2 + 1];
          const status = m % 3 === 0 ? "OFFICIAL" : m % 3 === 1 ? "WALKOVER" : "RETIRED";
          const winnerSide = maybe(0.5) ? "A" : "B";
          const winnerPairingId = winnerSide === "A" ? pairingA.id : pairingB.id;
          const winnerParticipantId = winnerSide === "A" ? pairingA.participants[0] : pairingB.participants[0];
          const matchStart = plusMinutes(startsAt, 30 + m * 45);

          const match = await prisma.eventMatchSlot.create({
            data: {
              eventId: event.id,
              categoryId: category.id,
              courtId: org.id === topPadelOrg.id ? courts[m % courts.length]?.id : null,
              courtNumber: (m % 6) + 1,
              startTime: matchStart,
              plannedStartAt: matchStart,
              plannedEndAt: plusMinutes(matchStart, 60),
              plannedDurationMinutes: 60,
              actualStartAt: matchStart,
              actualEndAt: plusMinutes(matchStart, status === "WALKOVER" ? 20 : 60),
              roundLabel: `R${m + 1}`,
              score: status === "WALKOVER" ? { walkover: true } : { sets: [[6, 4], [6, 3]] },
              status,
              pairingAId: pairingA.id,
              pairingBId: pairingB.id,
              groupLabel: "A",
              roundType: "GROUPS",
              winnerPairingId,
              winnerSide,
              winnerParticipantId,
              roundId: round.id,
              scoreMode: "SETS",
              scoreSets: status === "WALKOVER" ? [{ a: 1, b: 0, walkover: true }] : [{ a: 6, b: 4 }, { a: 6, b: 3 }],
              courtName: org.id === topPadelOrg.id ? courts[m % courts.length]?.name : `Court ${m + 1}`,
            },
          });

          await prisma.padelMatchParticipant.createMany({
            data: [
              { matchId: match.id, participantId: pairingA.participants[0], side: "A", slotOrder: 1 },
              { matchId: match.id, participantId: pairingA.participants[1], side: "A", slotOrder: 2 },
              { matchId: match.id, participantId: pairingB.participants[0], side: "B", slotOrder: 1 },
              { matchId: match.id, participantId: pairingB.participants[1], side: "B", slotOrder: 2 },
            ],
            skipDuplicates: true,
          });

          if (org.id === topPadelOrg.id) {
            topPadelMatchRecords.push({
              matchId: match.id,
              eventId: event.id,
              date: matchStart,
              status,
              winnerSide,
              participantBySide: {
                A: pairingA.playerIds,
                B: pairingB.playerIds,
              },
            });
          }
        }
      }

      tournamentEvents.push({ id: event.id, organizationId: org.id, startsAt, categoryId: category.id });
    }

    const isTicketVendable = (ticket: {
      status: string | null;
      soldQuantity: number | null;
      totalQuantity: number | null;
    }) => {
      const total = ticket.totalQuantity;
      const sold = ticket.soldQuantity ?? 0;
      const hasStock = total == null ? true : sold < total;
      return ticket.status === "ON_SALE" && hasStock;
    };

    const ensureFallbackTicketType = async (event: {
      id: number;
      slug: string;
      title: string;
      templateType: string | null;
      startsAt: Date;
      endsAt: Date | null;
      ticketTypes: Array<{ sortOrder: number | null }>;
    }) => {
      const fallbackName =
        event.templateType === "PADEL" ? "Inscrição Geral" : "Entrada Geral";
      const nextSortOrder =
        event.ticketTypes.reduce(
          (max, ticket) => Math.max(max, ticket.sortOrder ?? -1),
          -1,
        ) + 1;
      const fallbackStart = plusDays(event.startsAt, -30);
      const fallbackEnd = event.endsAt ?? plusDays(event.startsAt, 30);
      await prisma.ticketType.create({
        data: {
          eventId: event.id,
          name: fallbackName,
          description: `Bilhete fallback gerado pelo seed para ${event.title}.`,
          price: 0,
          currency: "EUR",
          totalQuantity: 200,
          soldQuantity: 0,
          status: "ON_SALE",
          sortOrder: nextSortOrder,
          startsAt: fallbackStart,
          endsAt: fallbackEnd,
        },
      });
    };

    const seededEventsForTicketAudit = await prisma.event.findMany({
      where: {
        OR: [
          { slug: { startsWith: "seed-event-" } },
          { slug: { startsWith: "seed-tournament-" } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        templateType: true,
        startsAt: true,
        endsAt: true,
        ticketTypes: {
          select: {
            id: true,
            status: true,
            soldQuantity: true,
            totalQuantity: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    let createdFallbackTicketCount = 0;
    let forcedOnSaleCount = 0;

    for (const event of seededEventsForTicketAudit) {
      if (event.ticketTypes.length === 0) {
        await ensureFallbackTicketType(event);
        createdFallbackTicketCount += 1;
        continue;
      }

      const hasVendableTicket = event.ticketTypes.some(isTicketVendable);
      const isFuturePublished =
        event.status === "PUBLISHED" &&
        (event.endsAt == null || event.endsAt.getTime() > now.getTime());

      if (hasVendableTicket || !isFuturePublished) continue;

      const candidate = event.ticketTypes.find((ticket) => {
        const total = ticket.totalQuantity;
        const sold = ticket.soldQuantity ?? 0;
        return total == null || sold < total;
      });

      if (candidate) {
        if (candidate.status !== "ON_SALE") {
          await prisma.ticketType.update({
            where: { id: candidate.id },
            data: { status: "ON_SALE" },
          });
          forcedOnSaleCount += 1;
        }
        continue;
      }

      await ensureFallbackTicketType(event);
      createdFallbackTicketCount += 1;
    }

    const finalTicketAudit = await prisma.event.findMany({
      where: {
        OR: [
          { slug: { startsWith: "seed-event-" } },
          { slug: { startsWith: "seed-tournament-" } },
        ],
      },
      select: {
        slug: true,
        status: true,
        endsAt: true,
        ticketTypes: {
          select: {
            status: true,
            soldQuantity: true,
            totalQuantity: true,
          },
        },
      },
    });

    const eventsWithoutTickets = finalTicketAudit
      .filter((event) => event.ticketTypes.length === 0)
      .map((event) => event.slug);
    if (eventsWithoutTickets.length > 0) {
      throw new Error(
        `[seed] invalid seed data: events without ticket types -> ${eventsWithoutTickets.join(", ")}`,
      );
    }

    const invalidFuturePublished = finalTicketAudit
      .filter((event) => {
        const isFuturePublished =
          event.status === "PUBLISHED" &&
          (event.endsAt == null || event.endsAt.getTime() > now.getTime());
        if (!isFuturePublished) return false;
        return !event.ticketTypes.some(isTicketVendable);
      })
      .map((event) => event.slug);
    if (invalidFuturePublished.length > 0) {
      throw new Error(
        `[seed] invalid seed data: future published events without vendable ticket -> ${invalidFuturePublished.join(", ")}`,
      );
    }

    console.log(
      `[seed] ticket audit complete: fallbackCreated=${createdFallbackTicketCount}, forcedOnSale=${forcedOnSaleCount}`,
    );

    const topPadelPlayers = await prisma.padelPlayerProfile.findMany({
      where: { organizationId: topPadelOrg.id },
      select: { id: true, userId: true },
    });

    const playerRatings = new Map<number, number>();
    const playerMatches = new Map<number, number>();
    const playerLastMatch = new Map<number, Date>();
    for (const player of topPadelPlayers) {
      playerRatings.set(player.id, 980 + rand() * 520);
      playerMatches.set(player.id, 0);
    }

    await prisma.padelRatingEvent.deleteMany({ where: { organizationId: topPadelOrg.id } });

    for (const match of topPadelMatchRecords.sort((a, b) => a.date.getTime() - b.date.getTime())) {
      const winners = match.winnerSide === "A" ? match.participantBySide.A : match.participantBySide.B;
      const losers = match.winnerSide === "A" ? match.participantBySide.B : match.participantBySide.A;

      for (const playerId of [...winners, ...losers]) {
        const pre = playerRatings.get(playerId) ?? 1200;
        const isWinner = winners.includes(playerId);
        const deltaBase = match.status === "WALKOVER" ? 8 : match.status === "RETIRED" ? 10 : 12;
        const delta = isWinner ? deltaBase : -deltaBase;
        const post = Math.max(700, Math.min(2300, pre + delta));

        playerRatings.set(playerId, post);
        playerMatches.set(playerId, (playerMatches.get(playerId) ?? 0) + 1);
        playerLastMatch.set(playerId, match.date);

        await prisma.padelRatingEvent.create({
          data: {
            organizationId: topPadelOrg.id,
            eventId: match.eventId,
            matchId: match.matchId,
            playerId,
            tier: "LOCAL_SERIES",
            clubId: topClub.id,
            city: "Matosinhos",
            opponentAvgRating: pre,
            preRating: pre,
            preRd: 60,
            preSigma: 0.06,
            postRating: post,
            postRd: 58,
            postSigma: 0.06,
            expectedScore: isWinner ? 0.54 : 0.46,
            actualScore: isWinner ? 1 : 0,
            gamesFor: isWinner ? 12 : 7,
            gamesAgainst: isWinner ? 7 : 12,
            tierMultiplier: 1,
            carryMultiplier: 1,
            metadata: {
              seed: true,
              status: match.status,
            },
            createdAt: match.date,
          },
        });
      }
    }

    for (const player of topPadelPlayers) {
      const rating = playerRatings.get(player.id) ?? 1200;
      const matchesPlayed = playerMatches.get(player.id) ?? 0;
      const lastMatchAt = playerLastMatch.get(player.id) ?? null;
      const levelVisual = Math.max(1, Math.min(7, rating / 300)).toFixed(2);

      await prisma.padelRatingProfile.upsert({
        where: { playerId: player.id },
        update: {
          organizationId: topPadelOrg.id,
          rating,
          rd: 58,
          sigma: 0.06,
          tau: 0.5,
          matchesPlayed,
          levelVisual,
          leaderboardEligible: true,
          blockedNewMatches: false,
          lastMatchAt,
          lastActivityAt: lastMatchAt,
          lastRebuildAt: new Date(),
          metadata: { source: "seed" },
        },
        create: {
          organizationId: topPadelOrg.id,
          playerId: player.id,
          rating,
          rd: 58,
          sigma: 0.06,
          tau: 0.5,
          matchesPlayed,
          levelVisual,
          leaderboardEligible: true,
          blockedNewMatches: false,
          lastMatchAt,
          lastActivityAt: lastMatchAt,
          lastRebuildAt: new Date(),
          metadata: { source: "seed" },
        },
      });
    }

    await prisma.padelRankingEntry.deleteMany({ where: { organizationId: topPadelOrg.id } });
    const rankingRows = await prisma.padelRatingProfile.findMany({
      where: { organizationId: topPadelOrg.id },
      orderBy: [{ rating: "desc" }, { playerId: "asc" }],
      take: 80,
      select: { playerId: true, rating: true },
    });
    const rankingEventId = topPadelTournamentIds.at(-1) ?? tournamentEvents[0]?.id;
    if (rankingEventId) {
      await prisma.padelRankingEntry.createMany({
        data: rankingRows.map((row, index) => ({
          organizationId: topPadelOrg.id,
          playerId: row.playerId,
          eventId: rankingEventId,
          points: Math.max(10, Math.round(row.rating - 900)),
          position: index + 1,
          level: (row.rating / 300).toFixed(2),
          season: "2026",
          year: 2026,
        })),
      });
    }

    const bookingDays = SEED_VOLUME.bookingDays;
    const bookingsPerDay = SEED_VOLUME.bookingsPerDay;
    const services = [serviceCourt, serviceClass, serviceHybrid];

    for (let day = -7; day <= bookingDays; day += 1) {
      for (let slot = 0; slot < bookingsPerDay; slot += 1) {
        const service = services[(day + slot + 1000) % services.length];
        const user = allUsers[(day * 7 + slot * 19 + 2000) % allUsers.length];
        const baseDate = plusDays(now, day);
        const minuteChunk = randInt(0, 11) * 5;
        const hour = 7 + (slot * 2 + randInt(0, 1));
        const startsAt = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), hour, minuteChunk, 0));
        const duration = service.id === serviceHybrid.id ? 90 : 60;

        const professional =
          service.assignmentMode === "PROFESSIONAL_ONLY" || service.assignmentMode === "PROFESSIONAL_AND_RESOURCE"
            ? professionals[(day + slot + professionals.length * 3) % professionals.length]
            : null;

        const resource =
          service.assignmentMode === "RESOURCE_ONLY" || service.assignmentMode === "PROFESSIONAL_AND_RESOURCE"
            ? resources[(day + slot + resources.length * 4) % resources.length]
            : null;
        const seededPartySize =
          service.assignmentMode === "PROFESSIONAL_ONLY"
            ? service.partySizeMin ?? 1
            : randInt(service.partySizeMin ?? 2, service.partySizeMax ?? 4);

        const availability = await prisma.availability.create({
          data: {
            serviceId: service.id,
            courtId: resource?.courtId ?? null,
            startsAt,
            durationMinutes: duration,
            capacity: service.partySizeMax ?? (service.id === serviceCourt.id ? 4 : 1),
            status: "OPEN",
          },
        });

        const status: "CONFIRMED" | "COMPLETED" | "PENDING" =
          startsAt.getTime() < now.getTime() - 2 * 60 * 60 * 1000 ? (maybe(0.82) ? "COMPLETED" : "CONFIRMED") : maybe(0.75) ? "CONFIRMED" : "PENDING";

        const booking = await prisma.booking.create({
          data: {
            serviceId: service.id,
            organizationId: topPadelOrg.id,
            userId: user.id,
            availabilityId: availability.id,
            courtId: resource?.courtId ?? null,
            assignmentMode: service.assignmentMode,
            professionalId: professional?.id ?? null,
            resourceId: resource?.id ?? null,
            partySize: seededPartySize,
            startsAt,
            durationMinutes: duration,
            price: service.unitPriceCents,
            currency: "EUR",
            status,
            snapshotTimezone: "Europe/Lisbon",
            locationMode: "FIXED",
            addressId: topPadelAddress.id,
          },
        });

        if ((booking.partySize ?? 1) > 1) {
          const participantUsers = allUsers
            .filter((u) => u.id !== user.id)
            .slice((slot * 3) % (allUsers.length - 4), (slot * 3) % (allUsers.length - 4) + (booking.partySize ?? 1) - 1);

          await prisma.bookingParticipant.createMany({
            data: participantUsers.map((participant) => ({
              bookingId: booking.id,
              userId: participant.id,
              name: participant.fullName,
              contact: `${participant.username}@orya.test`,
              status: "CONFIRMED",
            })),
          });
        }

        if (maybe(0.22)) {
          await prisma.bookingCharge.create({
            data: {
              bookingId: booking.id,
              organizationId: topPadelOrg.id,
              createdByUserId: miguelProfile.id,
              token: `seed_booking_charge_${booking.id}`,
              kind: "EXTRA",
              payerKind: "ORGANIZER",
              status: maybe(0.65) ? "PAID" : "OPEN",
              label: "Bolas premium",
              amountCents: 500,
              currency: "EUR",
              paidAt: maybe(0.65) ? plusMinutes(startsAt, 10) : null,
            },
          });
        }

        bookingRecords.push({
          organizationId: topPadelOrg.id,
          userId: user.id,
          occurredAt: startsAt,
          bookingId: booking.id,
          status: status === "COMPLETED" ? "BOOKING_COMPLETED" : status === "PENDING" ? "BOOKING_CONFIRMED" : "BOOKING_CONFIRMED",
        });
      }
    }

    await prisma.chatConversation.deleteMany({ where: { organizationId: topPadelOrg.id } });

    const chatGroups = [
      "Staff Geral",
      "Operacao Torneios",
      "Reservas e Campos",
      "Loja e CRM",
      "Marketing e Eventos",
      "Direcao Top Padel",
    ];

    const chatMessages = [
      "Bom dia equipa, hoje temos casa cheia no clube.",
      "Confirmem por favor os check-ins do torneio das 18h.",
      "Atualizei as reservas dos courts 3 e 4.",
      "A promocao SEEDTP15 esta a converter bem esta semana.",
      "Precisamos de reforcar staff no sabado de manha.",
      "As encomendas da loja de hoje ja foram expedidas.",
      "Ajustei o calendario para abrir slots extra ao final do dia.",
      "Quem consegue validar resultados pendentes do grupo B?",
      "Feedback dos clientes sobre o novo casaco esta muito positivo.",
      "Fecho financeiro parcial atualizado no CRM.",
    ];

    const staffAndOwner = [miguelProfile.id, rodriUser.id, ...staffUsers.map((s) => s.id)];

    for (let groupIndex = 0; groupIndex < chatGroups.length; groupIndex += 1) {
      const convo = await prisma.chatConversation.create({
        data: {
          organizationId: topPadelOrg.id,
          type: "GROUP",
          contextType: "ORG_CHANNEL",
          contextId: `seed_channel_${groupIndex + 1}`,
          title: chatGroups[groupIndex],
          description: `Canal interno ${chatGroups[groupIndex]}`,
          createdByUserId: miguelProfile.id,
          openAt: plusDays(now, -20),
        },
      });

      const members = [
        ...staffAndOwner,
        ...allUsers
          .filter((u) => !staffAndOwner.includes(u.id))
          .slice(groupIndex * 3, groupIndex * 3 + 6)
          .map((u) => u.id),
      ];

      await prisma.chatConversationMember.createMany({
        data: members.map((memberId) => ({
          conversationId: convo.id,
          organizationId: topPadelOrg.id,
          userId: memberId,
          role: memberId === miguelProfile.id || memberId === rodriUser.id ? "ADMIN" : "MEMBER",
          displayAs: "ORGANIZATION",
        })),
        skipDuplicates: true,
      });

      let lastMessageId: string | null = null;
      let lastMessageAt: Date | null = null;

      const msgCount = SEED_VOLUME.chatBaseMessages + (groupIndex % 3);
      for (let m = 0; m < msgCount; m += 1) {
        const senderId = members[(m + groupIndex) % members.length];
        const createdAt = plusMinutes(plusDays(now, -12 + groupIndex), m * 23 + groupIndex * 7);
        const message = await prisma.chatConversationMessage.create({
          data: {
            conversationId: convo.id,
            organizationId: topPadelOrg.id,
            senderId,
            body: chatMessages[(groupIndex * 4 + m) % chatMessages.length],
            clientMessageId: `seed_${groupIndex + 1}_${m + 1}_${senderId.slice(0, 6)}`,
            kind: "TEXT",
            metadata: { seed: true },
            createdAt,
          },
        });
        lastMessageId = message.id;
        lastMessageAt = createdAt;
      }

      await prisma.chatConversation.update({
        where: { id: convo.id },
        data: {
          lastMessageId,
          lastMessageAt,
        },
      });
    }

    const leadershipDm = await prisma.chatConversation.create({
      data: {
        organizationId: topPadelOrg.id,
        type: "DIRECT",
        contextType: "ORG_CONTACT",
        contextId: `seed_org_contact_${[miguelProfile.id, rodriUser.id].sort().join("_")}`,
        title: "Direcao Top Padel",
        description: "Conversa privada entre owner e co-owner",
        createdByUserId: miguelProfile.id,
        openAt: plusDays(now, -8),
      },
    });

    await prisma.chatConversationMember.createMany({
      data: [
        {
          conversationId: leadershipDm.id,
          organizationId: topPadelOrg.id,
          userId: miguelProfile.id,
          role: "ADMIN",
          displayAs: "ORGANIZATION",
        },
        {
          conversationId: leadershipDm.id,
          organizationId: topPadelOrg.id,
          userId: rodriUser.id,
          role: "ADMIN",
          displayAs: "ORGANIZATION",
        },
      ],
      skipDuplicates: true,
    });

    const leadershipMessages = [
      { senderId: miguelProfile.id, body: "Bem-vindo a co-gestao da Top Padel, vamos alinhar agenda semanal." },
      { senderId: rodriUser.id, body: "Perfeito. Ja revi o calendario de reservas e canais internos." },
      { senderId: miguelProfile.id, body: "Prioridade de hoje: experiencia mobile e resposta rapida no chat." },
      { senderId: rodriUser.id, body: "Feito. Vou acompanhar suporte e feedback dos jogadores em tempo real." },
      { senderId: miguelProfile.id, body: "Tambem valida os highlights do torneio para publicar ainda hoje." },
      { senderId: rodriUser.id, body: "Combinado. Envio um resumo de operacao no final do dia." },
    ];

    let leadershipLastMessageId: string | null = null;
    let leadershipLastMessageAt: Date | null = null;
    for (let index = 0; index < leadershipMessages.length; index += 1) {
      const message = leadershipMessages[index]!;
      const createdAt = plusMinutes(plusDays(now, -6), index * 38);
      const created = await prisma.chatConversationMessage.create({
        data: {
          conversationId: leadershipDm.id,
          organizationId: topPadelOrg.id,
          senderId: message.senderId,
          body: message.body,
          clientMessageId: `seed_lead_dm_${index + 1}_${message.senderId.slice(0, 6)}`,
          kind: "TEXT",
          metadata: { seed: true, thread: "leadership" },
          createdAt,
        },
      });
      leadershipLastMessageId = created.id;
      leadershipLastMessageAt = createdAt;
    }

    await prisma.chatConversation.update({
      where: { id: leadershipDm.id },
      data: {
        lastMessageId: leadershipLastMessageId,
        lastMessageAt: leadershipLastMessageAt,
      },
    });

    await prisma.store.deleteMany({ where: { ownerOrganizationId: topPadelOrg.id } });
    const store = await prisma.store.create({
      data: {
        ownerOrganizationId: topPadelOrg.id,
        status: "ACTIVE",
        showOnProfile: true,
        catalogLocked: false,
        checkoutEnabled: true,
        currency: "EUR",
        freeShippingThresholdCents: 9000,
      },
    });

    const storeCategoryGear = await prisma.storeCategory.create({
      data: {
        storeId: store.id,
        name: "Equipamento",
        slug: "equipamento",
        description: "Artigos tecnicos de jogo.",
        sortOrder: 1,
        isActive: true,
      },
    });

    const storeCategoryAccessories = await prisma.storeCategory.create({
      data: {
        storeId: store.id,
        name: "Acessorios",
        slug: "acessorios",
        description: "Consumiveis e extras.",
        sortOrder: 2,
        isActive: true,
      },
    });

    const jacket = await prisma.storeProduct.create({
      data: {
        storeId: store.id,
        categoryId: storeCategoryGear.id,
        name: "Casaco Tecnico Top Padel",
        slug: "casaco-tecnico-top-padel",
        shortDescription: "Casaco leve impermeavel para treino.",
        description: "Casaco tecnico com tecido respiravel e corte atletico.",
        visibility: "PUBLIC",
        priceCents: 6900,
        compareAtPriceCents: 8900,
        currency: "EUR",
        sku: "TP-CAS-001",
        stockPolicy: "TRACKED",
        stockQty: 120,
        requiresShipping: true,
        tags: ["casaco", "tecnico", "padel"],
      },
    });

    const balls = await prisma.storeProduct.create({
      data: {
        storeId: store.id,
        categoryId: storeCategoryAccessories.id,
        name: "Pack Bolas Pro 3x",
        slug: "pack-bolas-pro-3x",
        shortDescription: "Pack de bolas pressurizadas para competicao.",
        description: "Bolas de alta durabilidade com excelente resposta.",
        visibility: "PUBLIC",
        priceCents: 1290,
        compareAtPriceCents: 1590,
        currency: "EUR",
        sku: "TP-BOL-003",
        stockPolicy: "TRACKED",
        stockQty: 500,
        requiresShipping: true,
        tags: ["bolas", "consumivel"],
      },
    });

    const racket = await prisma.storeProduct.create({
      data: {
        storeId: store.id,
        categoryId: storeCategoryGear.id,
        name: "Raquete Carbon Pro",
        slug: "raquete-carbon-pro",
        shortDescription: "Raquete equilibrada para controlo e potencia.",
        description: "Raquete de carbono 12K com balance medio e sweet spot amplo.",
        visibility: "PUBLIC",
        priceCents: 14900,
        compareAtPriceCents: 17900,
        currency: "EUR",
        sku: "TP-RAQ-012",
        stockPolicy: "TRACKED",
        stockQty: 75,
        requiresShipping: true,
        tags: ["raquete", "carbono", "premium"],
      },
    });

    const jacketVariant = await prisma.storeProductVariant.create({ data: { productId: jacket.id, label: "M", sku: "TP-CAS-001-M", priceCents: 6900, stockQty: 40, isActive: true } });
    const ballVariant = await prisma.storeProductVariant.create({ data: { productId: balls.id, label: "Standard", sku: "TP-BOL-003-STD", priceCents: 1290, stockQty: 400, isActive: true } });
    const racketVariant = await prisma.storeProductVariant.create({ data: { productId: racket.id, label: "Round", sku: "TP-RAQ-012-RND", priceCents: 14900, stockQty: 45, isActive: true } });

    await prisma.storeProductImage.createMany({
      data: [
        { productId: jacket.id, url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=60", altText: "Casaco tecnico", isPrimary: true },
        { productId: balls.id, url: "https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?auto=format&fit=crop&w=900&q=60", altText: "Bolas de padel", isPrimary: true },
        { productId: racket.id, url: "https://images.unsplash.com/photo-1622279457486-62dcc4a43189?auto=format&fit=crop&w=900&q=60", altText: "Raquete de padel", isPrimary: true },
      ],
    });

    const shippingZone = await prisma.storeShippingZone.create({
      data: {
        storeId: store.id,
        name: "Portugal Continental",
        countries: ["PT"],
        isActive: true,
      },
    });

    const shippingMethod = await prisma.storeShippingMethod.create({
      data: {
        zoneId: shippingZone.id,
        name: "CTT Expresso",
        description: "Entrega 24-48h",
        baseRateCents: 450,
        mode: "FLAT",
        freeOverCents: 9000,
        isDefault: true,
        etaMinDays: 1,
        etaMaxDays: 2,
      },
    });

    await prisma.storeInventoryMovement.createMany({
      data: [
        { productId: jacket.id, variantId: jacketVariant.id, movementType: "ADJUST", quantity: 120, reason: "seed_start" },
        { productId: balls.id, variantId: ballVariant.id, movementType: "ADJUST", quantity: 500, reason: "seed_start" },
        { productId: racket.id, variantId: racketVariant.id, movementType: "ADJUST", quantity: 75, reason: "seed_start" },
      ],
    });

    const storeProducts = [
      { product: jacket, variant: jacketVariant },
      { product: balls, variant: ballVariant },
      { product: racket, variant: racketVariant },
    ];

    for (let i = 0; i < SEED_VOLUME.storeOrders; i += 1) {
      const buyer = allUsers[(i * 7 + 11) % allUsers.length];
      const item = storeProducts[i % storeProducts.length];
      const quantity = i % 4 === 0 ? 2 : 1;
      const subtotal = item.variant.priceCents ?? item.product.priceCents;
      const lineTotal = subtotal * quantity;
      const discount = i % 3 === 0 ? Math.round(lineTotal * 0.1) : 0;
      const shipping = lineTotal - discount >= 9000 ? 0 : 450;
      const total = lineTotal - discount + shipping;
      const orderStatus: "PAID" | "FULFILLED" | "PARTIAL_REFUND" | "REFUNDED" =
        i % 11 === 0 ? "REFUNDED" : i % 7 === 0 ? "PARTIAL_REFUND" : i % 5 === 0 ? "FULFILLED" : "PAID";
      const refundedCents = orderStatus === "REFUNDED" ? total : orderStatus === "PARTIAL_REFUND" ? roundCents(total * 0.35) : 0;
      const netCapturedCents = Math.max(0, total - refundedCents);

      const order = await prisma.storeOrder.create({
        data: {
          storeId: store.id,
          userId: buyer.id,
          orderNumber: `TP-2026-${String(i + 1).padStart(4, "0")}`,
          status: orderStatus,
          paymentIntentId: `pi_seed_store_${String(i + 1).padStart(4, "0")}`,
          purchaseId: `seed-store-purchase-${String(i + 1).padStart(4, "0")}`,
          subtotalCents: lineTotal,
          discountCents: discount,
          shippingCents: shipping,
          shippingZoneId: shippingZone.id,
          shippingMethodId: shippingMethod.id,
          totalCents: total,
          currency: "EUR",
          customerEmail: `${buyer.username}@orya.test`,
          customerName: buyer.fullName,
          customerPhone: `+35191${String(1000000 + i).padStart(7, "0")}`,
          notes: "Pedido seed para ambiente de testes realistas",
          storePolicySnapshotJson: { returns: "14 days", source: "seed" },
          storePolicyVersion: "seed-v1",
          storePolicyCapturedAt: now,
        },
      });

      await prisma.storeOrderLine.create({
        data: {
          orderId: order.id,
          productId: item.product.id,
          variantId: item.variant.id,
          nameSnapshot: item.product.name,
          skuSnapshot: item.variant.sku,
          quantity,
          unitPriceCents: subtotal,
          discountCents: discount,
          totalCents: total,
          requiresShipping: item.product.requiresShipping,
          personalization: {},
        },
      });

      const city = cityPool[(i + 2) % cityPool.length];
      const orderAddress = await upsertAddress(prisma, `${city.address}, Portugal`, city.lat, city.lng);
      await prisma.storeOrderAddress.createMany({
        data: [
          {
            orderId: order.id,
            addressType: "SHIPPING",
            fullName: buyer.fullName,
            addressId: orderAddress.id,
            nif: `PT${200000000 + i}`,
          },
          {
            orderId: order.id,
            addressType: "BILLING",
            fullName: buyer.fullName,
            addressId: orderAddress.id,
            nif: `PT${200000000 + i}`,
          },
        ],
      });

      if (order.status === "FULFILLED") {
        await prisma.storeShipment.create({
          data: {
            orderId: order.id,
            carrier: "CTT",
            trackingNumber: `CTTSEED${10000 + i}`,
            trackingUrl: `https://tracking.orya.test/CTTSEED${10000 + i}`,
            status: "DELIVERED",
            shippedAt: plusDays(now, -randInt(1, 10)),
            deliveredAt: plusDays(now, -randInt(0, 3)),
          },
        });
      }

      const paymentId = `pay_store_${String(i + 1).padStart(4, "0")}`;
      const platformFee = roundCents(total * 0.08);
      const processorFee = roundCents(total * 0.018);
      const paymentStatus = resolveSeedPaymentStatus({
        index: 5000 + i,
        grossCents: total,
        refundedCents,
      });
      await prisma.payment.create({
        data: {
          id: paymentId,
          organizationId: topPadelOrg.id,
          sourceType: "STORE_ORDER",
          sourceId: String(order.id),
          customerIdentityId: buyer.id,
          status: paymentStatus,
          feePolicyVersion: "seed-v1",
          pricingSnapshotJson: {
            total,
            platformFee,
            processorFee,
            refundedCents,
            netCapturedCents,
            seededPaymentStatus: paymentStatus,
          },
          pricingSnapshotHash: makeAddressHash(`store:${order.id}:${total}`),
          processorFeesStatus: "FINAL",
          processorFeesActual: processorFee,
          idempotencyKey: `seed_store_idemp_${order.id}`,
        },
      });

      topPadelFinancialRecords.push({
        organizationId: topPadelOrg.id,
        paymentId,
        purchaseId: order.purchaseId ?? `seed-store-purchase-${String(i + 1).padStart(4, "0")}`,
        sourceType: "STORE_ORDER",
        sourceId: String(order.id),
        customerIdentityId: buyer.id,
        paymentIntentId: order.paymentIntentId ?? null,
        paymentStatus,
        grossCents: total,
        platformFeeCents: platformFee,
        processorFeeCents: processorFee,
        netToOrgCents: Math.max(0, total - platformFee - processorFee),
        refundedCents,
        currency: "EUR",
        occurredAt: order.createdAt,
        eventId: null,
      });

      topPadelPurchaseSnapshots.push({
        organizationId: topPadelOrg.id,
        paymentId: order.purchaseId ?? `seed-store-purchase-${String(i + 1).padStart(4, "0")}`,
        purchaseId: order.purchaseId ?? `seed-store-purchase-${String(i + 1).padStart(4, "0")}`,
        sourceType: "STORE_ORDER",
        sourceId: String(order.id),
        customerIdentityId: buyer.id,
        paymentIntentId: order.paymentIntentId ?? null,
        grossCents: total,
        platformFeeCents: platformFee,
        processorFeeCents: processorFee,
        netToOrgCents: Math.max(0, total - platformFee - processorFee),
        currency: "EUR",
        occurredAt: order.createdAt,
        eventId: null,
      });

      if (refundedCents > 0) {
        storeRefundSeeds.push({
          userId: buyer.id,
          sourceId: String(order.id),
          amountCents: refundedCents,
          occurredAt: plusDays(now, -randInt(1, 45)),
        });
      }

      purchaseRecords.push({
        organizationId: topPadelOrg.id,
        userId: buyer.id,
        amountCents: netCapturedCents,
        occurredAt: order.createdAt,
        sourceType: "STORE_ORDER",
        sourceId: String(order.id),
      });
    }

    const paymentRecordByPurchaseId = new Map(
      topPadelFinancialRecords.map((record) => [record.purchaseId, record] as const),
    );

    for (const snapshot of topPadelPurchaseSnapshots) {
      const linkedPayment = paymentRecordByPurchaseId.get(snapshot.purchaseId);
      await prisma.payment.upsert({
        where: { id: snapshot.paymentId },
        update: {
          organizationId: snapshot.organizationId,
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
          customerIdentityId: snapshot.customerIdentityId,
          status: "SUCCEEDED",
          feePolicyVersion: "seed-v1",
          pricingSnapshotJson: {
            totalCents: snapshot.grossCents,
            platformFeeCents: snapshot.platformFeeCents,
            processorFeeCents: snapshot.processorFeeCents,
            netCents: snapshot.netToOrgCents,
            sourceType: snapshot.sourceType,
            sourceId: snapshot.sourceId,
          },
          pricingSnapshotHash: makeAddressHash(
            `snapshot-payment:${snapshot.paymentId}:${snapshot.grossCents}:${snapshot.sourceId}`,
          ),
          processorFeesStatus: "FINAL",
          processorFeesActual: snapshot.processorFeeCents,
          idempotencyKey: `seed_snapshot_idemp_${snapshot.paymentId}`,
        },
        create: {
          id: snapshot.paymentId,
          organizationId: snapshot.organizationId,
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
          customerIdentityId: snapshot.customerIdentityId,
          status: "SUCCEEDED",
          feePolicyVersion: "seed-v1",
          pricingSnapshotJson: {
            totalCents: snapshot.grossCents,
            platformFeeCents: snapshot.platformFeeCents,
            processorFeeCents: snapshot.processorFeeCents,
            netCents: snapshot.netToOrgCents,
            sourceType: snapshot.sourceType,
            sourceId: snapshot.sourceId,
          },
          pricingSnapshotHash: makeAddressHash(
            `snapshot-payment:${snapshot.paymentId}:${snapshot.grossCents}:${snapshot.sourceId}`,
          ),
          processorFeesStatus: "FINAL",
          processorFeesActual: snapshot.processorFeeCents,
          idempotencyKey: `seed_snapshot_idemp_${snapshot.paymentId}`,
          createdAt: snapshot.occurredAt,
          updatedAt: snapshot.occurredAt,
        },
      });
      await prisma.paymentSnapshot.upsert({
        where: { paymentId: snapshot.paymentId },
        update: {
          organizationId: snapshot.organizationId,
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
          status: "SUCCEEDED",
          currency: snapshot.currency,
          grossCents: snapshot.grossCents,
          platformFeeCents: snapshot.platformFeeCents,
          processorFeesCents: snapshot.processorFeeCents,
          netToOrgCents: snapshot.netToOrgCents,
          lastEventId: linkedPayment?.paymentId ?? linkedPayment?.paymentIntentId ?? null,
        },
        create: {
          paymentId: snapshot.paymentId,
          organizationId: snapshot.organizationId,
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
          status: "SUCCEEDED",
          currency: snapshot.currency,
          grossCents: snapshot.grossCents,
          platformFeeCents: snapshot.platformFeeCents,
          processorFeesCents: snapshot.processorFeeCents,
          netToOrgCents: snapshot.netToOrgCents,
          lastEventId: linkedPayment?.paymentId ?? linkedPayment?.paymentIntentId ?? null,
          createdAt: snapshot.occurredAt,
          updatedAt: snapshot.occurredAt,
        },
      });
    }

    const refundReasonCycle = ["CANCELLED", "DATE_CHANGED", "DELETED"] as const;
    const eventRefundTargets = topPadelFinancialRecords
      .filter(
        (record) =>
          record.sourceType === "TICKET_ORDER" &&
          record.eventId &&
          record.grossCents > 0 &&
          (record.paymentStatus === "SUCCEEDED" || record.paymentStatus === "PARTIAL_REFUND"),
      )
      .slice(0, 10);

    for (let idx = 0; idx < eventRefundTargets.length; idx += 1) {
      const record = eventRefundTargets[idx]!;
      const refundRatio = idx % 3 === 0 ? 0.5 : 0.25;
      const refundAmount = Math.min(record.grossCents, Math.max(100, roundCents(record.grossCents * refundRatio)));
      const platformFeeReversal =
        record.grossCents > 0 ? Math.min(record.platformFeeCents, roundCents((record.platformFeeCents * refundAmount) / record.grossCents)) : 0;
      const processorFeeReversal =
        record.grossCents > 0 ? Math.min(record.processorFeeCents, roundCents((record.processorFeeCents * refundAmount) / record.grossCents)) : 0;
      const feesExcludedCents = platformFeeReversal + processorFeeReversal;

      record.refundedCents = Math.min(record.grossCents, record.refundedCents + refundAmount);

      await prisma.refund.create({
        data: {
          dedupeKey: `seed_refund_${record.purchaseId}`,
          purchaseId: record.purchaseId,
          paymentIntentId: record.paymentIntentId,
          eventId: record.eventId!,
          baseAmountCents: refundAmount,
          feesExcludedCents,
          reason: refundReasonCycle[idx % refundReasonCycle.length]!,
          refundedBy: miguelProfile.id,
          refundedAt: plusDays(now, -randInt(1, 35)),
          stripeRefundId: `re_seed_${record.paymentId}_${idx + 1}`,
          auditPayload: {
            seed: true,
            reason: "Ajuste financeiro seed para reconciliacao e CRM.",
            grossCents: record.grossCents,
            refundAmount,
            feesExcludedCents,
          },
        },
      });
    }

    const ledgerRows: Array<{
      paymentId: string;
      entryType:
        | "GROSS"
        | "PLATFORM_FEE"
        | "PROCESSOR_FEES_FINAL"
        | "REFUND_GROSS"
        | "REFUND_PLATFORM_FEE_REVERSAL"
        | "REFUND_PROCESSOR_FEES_REVERSAL"
        | "DISPUTE_FEE"
        | "CHARGEBACK_GROSS"
        | "CHARGEBACK_PLATFORM_FEE_REVERSAL";
      amount: number;
      currency: "EUR";
      sourceType: "TICKET_ORDER" | "STORE_ORDER";
      sourceId: string;
      causationId: string;
      correlationId: string;
      createdAt: Date;
    }> = [];

    const pushLedgerEntry = (
      record: TopPadelFinancialRecord,
      suffix: string,
      entryType:
        | "GROSS"
        | "PLATFORM_FEE"
        | "PROCESSOR_FEES_FINAL"
        | "REFUND_GROSS"
        | "REFUND_PLATFORM_FEE_REVERSAL"
        | "REFUND_PROCESSOR_FEES_REVERSAL"
        | "DISPUTE_FEE"
        | "CHARGEBACK_GROSS"
        | "CHARGEBACK_PLATFORM_FEE_REVERSAL",
      amount: number,
    ) => {
      ledgerRows.push({
        paymentId: record.paymentId,
        entryType,
        amount,
        currency: "EUR",
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        causationId: `seed_fin_${record.paymentId}_${suffix}`,
        correlationId: `seed_fin_corr_${record.paymentId}`,
        createdAt: record.occurredAt,
      });
    };

    for (const record of topPadelFinancialRecords) {
      if (!shouldEmitLedgerForStatus(record.paymentStatus)) continue;
      pushLedgerEntry(record, "gross", "GROSS", record.grossCents);
      pushLedgerEntry(record, "platform_fee", "PLATFORM_FEE", -record.platformFeeCents);
      pushLedgerEntry(record, "processor_fee", "PROCESSOR_FEES_FINAL", -record.processorFeeCents);

      if (record.refundedCents > 0) {
        const platformFeeReversal =
          record.grossCents > 0 ? Math.min(record.platformFeeCents, roundCents((record.platformFeeCents * record.refundedCents) / record.grossCents)) : 0;
        const processorFeeReversal =
          record.grossCents > 0 ? Math.min(record.processorFeeCents, roundCents((record.processorFeeCents * record.refundedCents) / record.grossCents)) : 0;
        pushLedgerEntry(record, "refund_gross", "REFUND_GROSS", -record.refundedCents);
        pushLedgerEntry(record, "refund_platform_fee", "REFUND_PLATFORM_FEE_REVERSAL", platformFeeReversal);
        pushLedgerEntry(record, "refund_processor_fee", "REFUND_PROCESSOR_FEES_REVERSAL", processorFeeReversal);
      }
    }

    const disputeTargets = topPadelFinancialRecords
      .filter(
        (record) =>
          record.sourceType === "STORE_ORDER" &&
          record.paymentStatus === "DISPUTED" &&
          record.grossCents >= 5000,
      )
      .slice(0, 2);
    for (let idx = 0; idx < disputeTargets.length; idx += 1) {
      const record = disputeTargets[idx]!;
      const disputeFee = 1500 + idx * 300;
      pushLedgerEntry(record, `dispute_fee_${idx + 1}`, "DISPUTE_FEE", -disputeFee);
      pushLedgerEntry(record, `chargeback_gross_${idx + 1}`, "CHARGEBACK_GROSS", -record.grossCents);
      pushLedgerEntry(
        record,
        `chargeback_platform_${idx + 1}`,
        "CHARGEBACK_PLATFORM_FEE_REVERSAL",
        record.platformFeeCents,
      );
    }

    if (ledgerRows.length > 0) {
      await prisma.ledgerEntry.createMany({ data: ledgerRows });
    }

    const invoiceRows = topPadelFinancialRecords.flatMap((record, idx) => {
      const netAfterRefunds = Math.max(0, record.netToOrgCents - record.refundedCents);
      const consumerInvoice = {
        organizationId: topPadelOrg.id,
        customerIdentityId: record.customerIdentityId,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        kind: "CONSUMER" as const,
        status: "PAID" as const,
        invoiceNumber: `SEED-TP-INV-${String(idx + 1).padStart(5, "0")}`,
        currency: "EUR",
        amountCents: record.grossCents,
        issuedAt: plusMinutes(record.occurredAt, 1),
        paidAt: plusMinutes(record.occurredAt, 6),
        metadata: {
          seed: true,
          purchaseId: record.purchaseId,
          grossCents: record.grossCents,
          refundedCents: record.refundedCents,
          netAfterRefunds,
          summaryText: "Fatura seed gerada para analises de bruto, taxas e liquido.",
        },
      };
      const feeInvoice = {
        organizationId: topPadelOrg.id,
        customerIdentityId: record.customerIdentityId,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        kind: "PLATFORM_FEE" as const,
        status: "PAID" as const,
        invoiceNumber: `SEED-TP-FEE-${String(idx + 1).padStart(5, "0")}`,
        currency: "EUR",
        amountCents: record.platformFeeCents + record.processorFeeCents,
        issuedAt: plusMinutes(record.occurredAt, 2),
        paidAt: plusMinutes(record.occurredAt, 7),
        metadata: {
          seed: true,
          purchaseId: record.purchaseId,
          platformFeeCents: record.platformFeeCents,
          processorFeeCents: record.processorFeeCents,
          summaryText: "Encargo seed para testes de taxas operacionais.",
        },
      };
      return [consumerInvoice, feeInvoice];
    });

    if (invoiceRows.length > 0) {
      await prisma.invoice.createMany({ data: invoiceRows });
    }

    const sortedPaymentRecords = [...topPadelFinancialRecords].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );
    const payoutRows: Array<{
      organizationId: number;
      sourceType: string;
      sourceId: string;
      paymentId: string | null;
      paymentIntentId: string | null;
      transferId: string | null;
      currency: "EUR";
      grossAmountCents: number;
      platformFeeCents: number;
      feeMode: "INCLUDED";
      amountCents: number;
      status: "PENDING" | "RELEASED" | "FAILED";
      releasedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    const payoutBatchSize = 12;
    for (let i = 0; i < sortedPaymentRecords.length; i += payoutBatchSize) {
      const batch = sortedPaymentRecords.slice(i, i + payoutBatchSize);
      if (batch.length === 0) continue;
      const grossAmountCents = batch.reduce((sum, row) => sum + row.grossCents, 0);
      const platformFeeCents = batch.reduce((sum, row) => sum + row.platformFeeCents, 0);
      const batchNet = batch.reduce(
        (sum, row) => sum + Math.max(0, row.netToOrgCents - row.refundedCents),
        0,
      );
      const batchIndex = Math.floor(i / payoutBatchSize);
      const status: "PENDING" | "RELEASED" | "FAILED" =
        batchIndex % 6 === 5 ? "FAILED" : batchIndex % 4 === 3 ? "PENDING" : "RELEASED";
      const batchCreatedAt = batch[batch.length - 1]!.occurredAt;
      payoutRows.push({
        organizationId: topPadelOrg.id,
        sourceType: "SEED_BATCH",
        sourceId: `seed-payout-batch-${String(batchIndex + 1).padStart(3, "0")}`,
        paymentId: batch[0]!.paymentId,
        paymentIntentId: batch[0]!.paymentIntentId,
        transferId: status === "RELEASED" ? `tr_seed_tp_${String(batchIndex + 1).padStart(5, "0")}` : null,
        currency: "EUR",
        grossAmountCents,
        platformFeeCents,
        feeMode: "INCLUDED",
        amountCents: Math.max(0, batchNet),
        status,
        releasedAt: status === "RELEASED" ? plusDays(batchCreatedAt, 2) : null,
        createdAt: batchCreatedAt,
        updatedAt: batchCreatedAt,
      });
    }

    if (payoutRows.length > 0) {
      await prisma.payout.createMany({ data: payoutRows });
    }

    let topPadelRollupResult: { rows: number; rollups: number } | null = null;
    if (topPadelFinancialRecords.length > 0) {
      const sortedDates = [...topPadelFinancialRecords]
        .map((record) => record.occurredAt)
        .sort((a, b) => a.getTime() - b.getTime());
      const fromDate = sortedDates[0]!;
      const toDate = sortedDates[sortedDates.length - 1]!;
      topPadelRollupResult = await runSeedAnalyticsRollup({
        prisma,
        organizationId: topPadelOrg.id,
        fromDate,
        toDate,
      });
      console.log(
        `[seed] analytics rollup Top Padel rows=${topPadelRollupResult.rows} rollups=${topPadelRollupResult.rollups}`,
      );
    }

    const followRows: Array<{ follower_id: string; following_id: string }> = [];
    const followSet = new Set<string>();
    const addFollow = (followerId: string, followingId: string) => {
      if (followerId === followingId) return;
      const key = `${followerId}:${followingId}`;
      if (followSet.has(key)) return;
      followSet.add(key);
      followRows.push({ follower_id: followerId, following_id: followingId });
    };

    for (const user of allUsers) {
      const targetCount = randInt(SEED_VOLUME.followMin, SEED_VOLUME.followMax);
      let attempts = 0;
      while (attempts < targetCount * 4) {
        attempts += 1;
        const candidate = pick(allUsers);
        addFollow(user.id, candidate.id);
        if (followRows.length % 50 === 0 && followRows.length >= targetCount) break;
      }
    }

    const nonRodriUsers = allUsers.filter((u) => u.id !== rodriUser.id);
    const rodriTargetCap = Math.min(42, nonRodriUsers.length);
    for (const target of nonRodriUsers.slice(0, rodriTargetCap)) {
      addFollow(rodriUser.id, target.id);
    }
    for (const follower of nonRodriUsers.slice(Math.max(0, rodriTargetCap - 24), rodriTargetCap + 12)) {
      addFollow(follower.id, rodriUser.id);
    }

    await prisma.follows.createMany({ data: followRows, skipDuplicates: true });

    const orgFollowRows: Array<{ follower_id: string; organization_id: number }> = [];
    const orgFollowSet = new Set<string>();
    const addOrgFollow = (followerId: string, organizationId: number) => {
      const key = `${followerId}:${organizationId}`;
      if (orgFollowSet.has(key)) return;
      orgFollowSet.add(key);
      orgFollowRows.push({ follower_id: followerId, organization_id: organizationId });
    };
    for (const user of allUsers) {
      const followed = new Set<number>();
      const followsCount = randInt(SEED_VOLUME.orgFollowMin, SEED_VOLUME.orgFollowMax);
      for (let i = 0; i < followsCount; i += 1) {
        const org = pick(organizations);
        followed.add(org.id);
      }
      followed.add(topPadelOrg.id);
      for (const orgId of followed) {
        addOrgFollow(user.id, orgId);
      }
    }
    for (const org of organizations) {
      addOrgFollow(rodriUser.id, org.id);
    }

    await prisma.organization_follows.createMany({ data: orgFollowRows, skipDuplicates: true });
    await prisma.crmContactNote.deleteMany({
      where: {
        organizationId: topPadelOrg.id,
        OR: [
          { body: "Cliente ativo e recorrente. Perfil criado via seed realista." },
          { body: { startsWith: "[SEED_FINANCE]" } },
        ],
      },
    });

    const topPadelUsers = allUsers;
    const contactsByUser = new Map<string, string>();
    const crmContactFinancialProfiles: CrmContactFinancialProfile[] = [];

    for (const [userIndex, user] of topPadelUsers.entries()) {
      const userPurchases = purchaseRecords.filter((p) => p.organizationId === topPadelOrg.id && p.userId === user.id);
      const userBookings = bookingRecords.filter((b) => b.organizationId === topPadelOrg.id && b.userId === user.id);
      const totalSpent = userPurchases.reduce((sum, row) => sum + row.amountCents, 0);
      const totalStoreOrders = userPurchases.filter((p) => p.sourceType === "STORE_ORDER").length;
      const totalEventOrders = userPurchases.filter((p) => p.sourceType === "EVENT_TICKET").length;
      const isStaffContact = staffUsers.some((s) => s.id === user.id) || user.id === miguelProfile.id || user.id === rodriUser.id;
      const marketingEmailOptIn = maybe(0.84);
      const marketingPushOptIn = maybe(0.78);
      const contactPhone = `+35191${String(2000000 + userIndex).padStart(7, "0")}`;
      const totalOrders = totalEventOrders;
      const valueTier =
        totalSpent >= 120000
          ? "vip"
          : totalSpent >= 60000
            ? "gold"
            : totalSpent >= 20000
              ? "silver"
              : totalSpent > 0
                ? "bronze"
                : "lead";
      const spendBehaviorTag =
        totalStoreOrders > totalEventOrders ? "store-first" : totalEventOrders > 0 ? "event-first" : "prospect";
      const contactTags = isStaffContact
        ? ["staff", "seed"]
        : [
            "seed",
            "active",
            totalSpent > 0 ? "cliente-pagante" : "sem-compra",
            `tier-${valueTier}`,
            spendBehaviorTag,
          ];

      const contact = await prisma.crmContact.upsert({
        where: {
          organizationId_userId: {
            organizationId: topPadelOrg.id,
            userId: user.id,
          },
        },
        update: {
          status: "ACTIVE",
          contactType: isStaffContact ? "STAFF" : "CUSTOMER",
          displayName: user.fullName,
          contactEmail: `${user.username}@orya.test`,
          contactPhone,
          legalBasis: "CONTRACT",
          marketingEmailOptIn,
          marketingPushOptIn,
          firstInteractionAt: userPurchases[0]?.occurredAt ?? userBookings[0]?.occurredAt ?? now,
          lastActivityAt:
            userPurchases.at(-1)?.occurredAt ??
            userBookings.at(-1)?.occurredAt ??
            plusDays(now, -randInt(0, 20)),
          lastPurchaseAt: userPurchases.at(-1)?.occurredAt ?? null,
          totalSpentCents: totalSpent,
          totalOrders,
          totalBookings: userBookings.length,
          totalAttendances: Math.max(0, userBookings.filter((b) => b.status === "BOOKING_COMPLETED").length),
          totalTournaments: randInt(0, 6),
          totalStoreOrders,
          tags: contactTags,
          sourceType: "seed",
          sourceId: user.id,
          customFields: {
            seeded: true,
            financeProfile: {
              valueTier,
              totalOrders,
              totalStoreOrders,
              totalSpentCents: totalSpent,
              estimatedFeeRateBps: 980,
              estimatedNetCents: Math.max(0, totalSpent - roundCents(totalSpent * 0.098)),
              summaryText:
                totalSpent > 0
                  ? "Cliente pagante com historico financeiro valido para analises de taxas e liquido."
                  : "Contacto sem compras; util para analises de conversao.",
            },
          },
        },
        create: {
          organizationId: topPadelOrg.id,
          userId: user.id,
          status: "ACTIVE",
          contactType: isStaffContact ? "STAFF" : "CUSTOMER",
          displayName: user.fullName,
          contactEmail: `${user.username}@orya.test`,
          contactPhone,
          legalBasis: "CONTRACT",
          marketingEmailOptIn,
          marketingPushOptIn,
          firstInteractionAt: userPurchases[0]?.occurredAt ?? userBookings[0]?.occurredAt ?? now,
          lastActivityAt:
            userPurchases.at(-1)?.occurredAt ??
            userBookings.at(-1)?.occurredAt ??
            plusDays(now, -randInt(0, 20)),
          lastPurchaseAt: userPurchases.at(-1)?.occurredAt ?? null,
          totalSpentCents: totalSpent,
          totalOrders,
          totalBookings: userBookings.length,
          totalAttendances: Math.max(0, userBookings.filter((b) => b.status === "BOOKING_COMPLETED").length),
          totalTournaments: randInt(0, 6),
          totalStoreOrders,
          tags: contactTags,
          sourceType: "seed",
          sourceId: user.id,
          customFields: {
            seeded: true,
            financeProfile: {
              valueTier,
              totalOrders,
              totalStoreOrders,
              totalSpentCents: totalSpent,
              estimatedFeeRateBps: 980,
              estimatedNetCents: Math.max(0, totalSpent - roundCents(totalSpent * 0.098)),
              summaryText:
                totalSpent > 0
                  ? "Cliente pagante com historico financeiro valido para analises de taxas e liquido."
                  : "Contacto sem compras; util para analises de conversao.",
            },
          },
        },
      });

      contactsByUser.set(user.id, contact.id);

      for (const consentType of ["MARKETING", "CONTACT_EMAIL", "CONTACT_SMS"] as const) {
        const grantedAt = plusDays(now, -randInt(1, 120));
        const status =
          consentType === "MARKETING"
            ? marketingEmailOptIn
              ? "GRANTED"
              : "REVOKED"
            : consentType === "CONTACT_SMS"
              ? marketingPushOptIn
                ? "GRANTED"
                : "REVOKED"
              : "GRANTED";
        await prisma.crmContactConsent.upsert({
          where: {
            organizationId_contactId_type: {
              organizationId: topPadelOrg.id,
              contactId: contact.id,
              type: consentType,
            },
          },
          update: {
            status,
            source: "seed",
            grantedAt: status === "GRANTED" ? grantedAt : null,
            revokedAt: status === "REVOKED" ? grantedAt : null,
          },
          create: {
            organizationId: topPadelOrg.id,
            contactId: contact.id,
            type: consentType,
            status,
            source: "seed",
            grantedAt: status === "GRANTED" ? grantedAt : null,
            revokedAt: status === "REVOKED" ? grantedAt : null,
          },
        });
      }

      if (maybe(0.2)) {
        await prisma.crmContactNote.create({
          data: {
            organizationId: topPadelOrg.id,
            contactId: contact.id,
            authorUserId: miguelProfile.id,
            body: "Cliente ativo e recorrente. Perfil criado via seed realista.",
          },
        });
      }

      crmContactFinancialProfiles.push({
        contactId: contact.id,
        userId: user.id,
        isStaff: isStaffContact,
        totalSpentCents: totalSpent,
        totalOrders,
        totalStoreOrders,
        lastPurchaseAt: userPurchases.at(-1)?.occurredAt ?? null,
      });

      const playerProfile = await prisma.padelPlayerProfile.findFirst({
        where: {
          organizationId: topPadelOrg.id,
          userId: user.id,
        },
      });

      if (playerProfile) {
        await prisma.crmContactPadel.upsert({
          where: { contactId: contact.id },
          update: {
            organizationId: topPadelOrg.id,
            playerProfileId: playerProfile.id,
            level: playerProfile.level,
            preferredSide: playerProfile.preferredSide,
            clubName: playerProfile.clubName,
            tournamentsCount: randInt(0, 8),
            noShowCount: randInt(0, 2),
          },
          create: {
            organizationId: topPadelOrg.id,
            contactId: contact.id,
            playerProfileId: playerProfile.id,
            level: playerProfile.level,
            preferredSide: playerProfile.preferredSide,
            clubName: playerProfile.clubName,
            tournamentsCount: randInt(0, 8),
            noShowCount: randInt(0, 2),
          },
        });
      }
    }

    const topPayingContacts = [...crmContactFinancialProfiles]
      .filter((profile) => !profile.isStaff && profile.totalSpentCents > 0)
      .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
      .slice(0, 36);

    const churnRiskCutoff = plusDays(now, -75);
    const churnRiskContacts = crmContactFinancialProfiles
      .filter(
        (profile) =>
          !profile.isStaff &&
          profile.totalSpentCents > 0 &&
          (!profile.lastPurchaseAt || profile.lastPurchaseAt.getTime() < churnRiskCutoff.getTime()),
      )
      .slice(0, 20);
    for (const profile of churnRiskContacts) {
      await prisma.crmContact.update({
        where: { id: profile.contactId },
        data: {
          tags: {
            set: ["seed", "active", "cliente-pagante", "churn-risk"],
          },
        },
      });
      await prisma.crmContactNote.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId: profile.contactId,
          authorUserId: miguelProfile.id,
          body: "[SEED_FINANCE] Contacto com risco de churn identificado por baixa atividade recente.",
        },
      });
    }

    for (let idx = 0; idx < topPayingContacts.length; idx += 1) {
      const profile = topPayingContacts[idx]!;
      const avgTicketCents = profile.totalOrders > 0 ? Math.round(profile.totalSpentCents / profile.totalOrders) : profile.totalSpentCents;
      const estimatedFeesCents = roundCents(profile.totalSpentCents * 0.098);
      const estimatedNetCents = Math.max(0, profile.totalSpentCents - estimatedFeesCents);
      const body = `[SEED_FINANCE] Cliente pagante segmentado em carteira ativa. Total gasto: ${(profile.totalSpentCents / 100).toFixed(2)} EUR. Ticket medio: ${(avgTicketCents / 100).toFixed(2)} EUR. Taxas estimadas: ${(estimatedFeesCents / 100).toFixed(2)} EUR. Liquido estimado: ${(estimatedNetCents / 100).toFixed(2)} EUR.`;
      await prisma.crmContactNote.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId: profile.contactId,
          authorUserId: miguelProfile.id,
          body,
        },
      });
    }

    const noteCounts = await prisma.crmContactNote.groupBy({
      by: ["contactId"],
      where: { organizationId: topPadelOrg.id },
      _count: { _all: true },
    });
    await prisma.crmContact.updateMany({
      where: { organizationId: topPadelOrg.id },
      data: { notesCount: 0 },
    });
    for (const row of noteCounts) {
      await prisma.crmContact.update({
        where: { id: row.contactId },
        data: { notesCount: row._count._all },
      });
    }

    await prisma.crmInteraction.deleteMany({
      where: {
        organizationId: topPadelOrg.id,
        OR: [
          { externalId: { startsWith: "seed_crm_" } },
          { sourceId: { startsWith: "seed_" } },
          { sourceId: { startsWith: "org_" } },
        ],
      },
    });

    let crmInteractionCounter = 1;
    for (const purchase of purchaseRecords.filter((p) => p.organizationId === topPadelOrg.id)) {
      const contactId = contactsByUser.get(purchase.userId);
      if (!contactId) continue;
      await prisma.crmInteraction.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId,
          userId: purchase.userId,
          externalId: `seed_crm_purchase_${crmInteractionCounter++}`,
          type: purchase.sourceType === "STORE_ORDER" ? "STORE_ORDER_PAID" : "EVENT_TICKET",
          sourceType: purchase.sourceType === "STORE_ORDER" ? "STORE_ORDER" : "TICKET",
          sourceId: purchase.sourceId,
          occurredAt: purchase.occurredAt,
          amountCents: purchase.amountCents,
          currency: "EUR",
          metadata: { seed: true },
        },
      });
    }

    for (const booking of bookingRecords) {
      const contactId = contactsByUser.get(booking.userId);
      if (!contactId) continue;
      await prisma.crmInteraction.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId,
          userId: booking.userId,
          externalId: `seed_crm_booking_${crmInteractionCounter++}`,
          type: booking.status,
          sourceType: "BOOKING",
          sourceId: String(booking.bookingId),
          occurredAt: booking.occurredAt,
          amountCents: null,
          currency: "EUR",
          metadata: { seed: true },
        },
      });
    }

    for (const row of orgFollowRows.filter((r) => r.organization_id === topPadelOrg.id)) {
      const contactId = contactsByUser.get(row.follower_id);
      if (!contactId) continue;
      if (!maybe(0.2)) continue;
      await prisma.crmInteraction.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId,
          userId: row.follower_id,
          externalId: `seed_crm_follow_${crmInteractionCounter++}`,
          type: "ORG_FOLLOWED",
          sourceType: "SOCIAL",
          sourceId: `org_${topPadelOrg.id}_user_${row.follower_id}`,
          occurredAt: plusDays(now, -randInt(0, 120)),
          amountCents: null,
          currency: "EUR",
          metadata: { seed: true },
        },
      });
    }

    const refundContacts = storeRefundSeeds
      .map((refund) => ({
        ...refund,
        contactId: contactsByUser.get(refund.userId) ?? null,
      }))
      .filter((entry): entry is StoreRefundSeed & { contactId: string } => Boolean(entry.contactId));
    for (const refund of refundContacts) {
      await prisma.crmInteraction.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId: refund.contactId,
          userId: refund.userId,
          externalId: `seed_crm_store_refund_${crmInteractionCounter++}`,
          type: "STORE_ORDER_REFUNDED",
          sourceType: "STORE_ORDER",
          sourceId: refund.sourceId,
          occurredAt: refund.occurredAt,
          amountCents: -Math.abs(refund.amountCents),
          currency: "EUR",
          metadata: {
            seed: true,
            reason: "refund_seed",
            summaryText: "Reembolso seed para analises CRM financeiras.",
          },
        },
      });
    }

    const membershipContacts = [...topPayingContacts].slice(0, 28);
    for (let idx = 0; idx < membershipContacts.length; idx += 1) {
      const profile = membershipContacts[idx]!;
      await prisma.crmInteraction.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId: profile.contactId,
          userId: profile.userId,
          externalId: `seed_crm_membership_start_${crmInteractionCounter++}`,
          type: "MEMBERSHIP_STARTED",
          sourceType: "MEMBERSHIP",
          sourceId: `seed_membership_${profile.userId}`,
          occurredAt: plusDays(now, -(120 - idx * 2)),
          amountCents: idx < 10 ? 3490 : 2490,
          currency: "EUR",
          metadata: {
            seed: true,
            plan: idx < 10 ? "premium" : "club",
            summaryText: "Inicio de subscricao seed para metricas de retencao.",
          },
        },
      });

      if (idx % 2 === 0) {
        await prisma.crmInteraction.create({
          data: {
            organizationId: topPadelOrg.id,
            contactId: profile.contactId,
            userId: profile.userId,
            externalId: `seed_crm_membership_renew_${crmInteractionCounter++}`,
            type: "MEMBERSHIP_RENEWED",
            sourceType: "MEMBERSHIP",
            sourceId: `seed_membership_${profile.userId}`,
            occurredAt: plusDays(now, -(60 - idx)),
            amountCents: idx < 8 ? 3490 : 2490,
            currency: "EUR",
            metadata: { seed: true, cycle: "monthly" },
          },
        });
      }

      if (idx % 7 === 0) {
        await prisma.crmInteraction.create({
          data: {
            organizationId: topPadelOrg.id,
            contactId: profile.contactId,
            userId: profile.userId,
            externalId: `seed_crm_membership_cancel_${crmInteractionCounter++}`,
            type: "MEMBERSHIP_CANCELLED",
            sourceType: "MEMBERSHIP",
            sourceId: `seed_membership_${profile.userId}`,
            occurredAt: plusDays(now, -randInt(1, 40)),
            amountCents: null,
            currency: "EUR",
            metadata: { seed: true, reason: "budget_adjustment" },
          },
        });
      }

      await prisma.crmInteraction.create({
        data: {
          organizationId: topPadelOrg.id,
          contactId: profile.contactId,
          userId: profile.userId,
          externalId: `seed_crm_manual_adjust_${crmInteractionCounter++}`,
          type: "MANUAL_ADJUSTMENT",
          sourceType: "MANUAL",
          sourceId: `seed_manual_${profile.userId}_${idx + 1}`,
          occurredAt: plusDays(now, -randInt(1, 90)),
          amountCents: idx % 4 === 0 ? -500 : 300,
          currency: "EUR",
          metadata: {
            seed: true,
            category: idx % 4 === 0 ? "credit_note" : "upsell_adjustment",
            summaryText: "Ajuste manual seed para relatorios de CRM.",
          },
        },
      });
    }

    const counts = {
      profiles: await prisma.profile.count(),
      organizations: await prisma.organization.count(),
      events: await prisma.event.count(),
      tournaments: await prisma.padelTournamentConfig.count(),
      pairings: await prisma.padelPairing.count(),
      matches: await prisma.eventMatchSlot.count(),
      ratingProfiles: await prisma.padelRatingProfile.count(),
      bookings: await prisma.booking.count(),
      storeOrders: await prisma.storeOrder.count(),
      tickets: await prisma.ticket.count(),
      sales: await prisma.saleSummary.count(),
      payments: await prisma.payment.count(),
      paymentSnapshots: await prisma.paymentSnapshot.count(),
      ledgerEntries: await prisma.ledgerEntry.count(),
      refunds: await prisma.refund.count(),
      invoices: await prisma.invoice.count(),
      payouts: await prisma.payout.count(),
      analyticsRollups: await prisma.analyticsRollup.count(),
      chatConversations: await prisma.chatConversation.count(),
      chatMessages: await prisma.chatConversationMessage.count(),
      crmContacts: await prisma.crmContact.count(),
      follows: await prisma.follows.count(),
      orgFollows: await prisma.organization_follows.count(),
    };

    console.log("\\nSeed rich demo completed.");
    console.table(counts);
    console.log("Seed mode:", FAST_MODE ? "FAST" : "FULL");
    console.log("Top Padel organization id:", topPadelOrg.id);
    console.log("Top Padel leadership:", { owner: "migueloryatest", coOwner: rodriUser.username });
    console.log("RNG seed:", RNG_SEED);
    console.log("Demo login:", {
      email: demoFriendUser.email,
      username: demoFriendUser.username,
      password: demoFriendUser.password,
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("seed_rich_demo failed:", error);
  process.exit(1);
});
