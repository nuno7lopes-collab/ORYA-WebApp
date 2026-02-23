import crypto from "crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnalyticsDimensionKey,
  AnalyticsMetricKey,
  FeeMode,
  LedgerEntryType,
  PaymentStatus,
  PrismaClient,
  PayoutStatus,
  SourceType,
} from "@prisma/client";
import { Pool } from "pg";

config({ path: ".env.local" });
config();

type SeedEvent = {
  slug: string;
  title: string;
  venueName: string;
  venueAddress: string;
  lat: number;
  lng: number;
  startsAtIso: string;
  endsAtIso: string;
  coverImageUrl: string;
  description: string;
  attendees: number;
  grossCents: number;
  sourceUrl: string;
};

const USER_EMAIL = "nelsonorya@gmail.com";
const USER_PASSWORD = "NelsonORYA#2026";
const USERNAME = "nelson";
const FULL_NAME = "Nelson";

const ORG_USERNAME = "matosinhostech";
const ORG_PUBLIC_NAME = "Matosinhos Tech";
const ORG_OFFICIAL_EMAIL = "hello@matosinhos.tech";

const ORG_DESCRIPTION =
  "Matosinhos Tech e uma comunidade tecnologica no norte de Portugal que organiza eventos unicos e partilha insights de lideres da industria. A comunidade destaca inovacao, talento e empresas pioneiras, promovendo aprendizagem e ligacoes relevantes.";

const SEED_EVENTS: SeedEvent[] = [
  {
    slug: "matosinhos-tech-shapping-digital-products",
    title: "Shapping Digital Products",
    venueName: "Teatro Constantino Nery",
    venueAddress: "Cine-Teatro Constantino Nery, Avenida de Serpa Pinto, Matosinhos, Porto, 4450-277, Portugal",
    lat: 41.1841226,
    lng: -8.6949029,
    startsAtIso: "2024-06-06T18:00:00+01:00",
    endsAtIso: "2024-06-06T22:30:00+01:00",
    coverImageUrl: "https://framerusercontent.com/images/rzoCuLdOMVpkgj0puMimVO5WPU.jpg?width=6720&height=4480",
    description:
      "An inspiring deep dive into how design, usability, and AI can create more human-centered digital experiences.",
    attendees: 160,
    grossCents: 1120000,
    sourceUrl: "https://matosinhos.tech/events/digital-products",
  },
  {
    slug: "matosinhos-tech-mt-connect",
    title: "mt connect",
    venueName: "CM Matosinhos",
    venueAddress: "Camara Municipal de Matosinhos, Avenida Dom Afonso Henriques, Matosinhos, Porto, 4454-510, Portugal",
    lat: 41.1831869,
    lng: -8.6832399,
    startsAtIso: "2024-11-14T18:30:00+00:00",
    endsAtIso: "2024-11-14T23:00:00+00:00",
    coverImageUrl: "https://framerusercontent.com/images/dNicNCxncVwmnqGymdNp0qdtCw.jpg?width=2250&height=1500",
    description: "A vibrant evening of tech community insights and networking.",
    attendees: 190,
    grossCents: 870000,
    sourceUrl: "https://matosinhos.tech/events/mt-connect",
  },
  {
    slug: "matosinhos-tech-game-knights",
    title: "Game Knights",
    venueName: "Mosteiro Leca do Balio",
    venueAddress: "Mosteiro de Leca do Balio, Rua do Mosteiro, Leca do Balio, Matosinhos, Porto, 4465-602, Portugal",
    lat: 41.20993,
    lng: -8.6234244,
    startsAtIso: "2024-12-08T17:00:00+00:00",
    endsAtIso: "2024-12-08T22:30:00+00:00",
    coverImageUrl: "https://framerusercontent.com/images/kmRlYBT6eY9RLOGV4O7x82Xreg.jpg?width=2250&height=1500",
    description:
      "A magical evening where medieval charm met modern game development through inspiring talks and immersive atmosphere.",
    attendees: 175,
    grossCents: 960000,
    sourceUrl: "https://matosinhos.tech/events/game-knight",
  },
  {
    slug: "matosinhos-tech-hack-the-planet",
    title: "Hack the Planet",
    venueName: "Teatro Constantino Nery",
    venueAddress: "Cine-Teatro Constantino Nery, Avenida de Serpa Pinto, Matosinhos, Porto, 4450-277, Portugal",
    lat: 41.1841226,
    lng: -8.6949029,
    startsAtIso: "2025-04-01T18:00:00+01:00",
    endsAtIso: "2025-04-01T23:00:00+01:00",
    coverImageUrl: "https://framerusercontent.com/images/PDP9bC8XxaZhSDqueioCGLJg.jpg?width=2048&height=1365",
    description:
      "A powerful, hands-on look at cybersecurity in a fun, high-energy setting that left everyone more aware and better prepared.",
    attendees: 240,
    grossCents: 1540000,
    sourceUrl: "https://matosinhos.tech/events/hack-the-planet",
  },
  {
    slug: "matosinhos-tech-tech-waves",
    title: "Tech Waves",
    venueName: "Piscina das Mares",
    venueAddress: "Piscina das Mares, Avenida da Liberdade, Leca da Palmeira, Matosinhos, Porto, 4450-716, Portugal",
    lat: 41.1930765,
    lng: -8.7072863,
    startsAtIso: "2025-07-09T19:00:00+01:00",
    endsAtIso: "2025-07-09T23:30:00+01:00",
    coverImageUrl: "https://framerusercontent.com/images/aXzZz4yff1R32rFipJ4OQtSWJw.jpg?width=2189&height=1460",
    description: "A sunset gathering where startups, founders, and investors connected over ideas and music.",
    attendees: 280,
    grossCents: 1890000,
    sourceUrl: "https://matosinhos.tech/events/tech-waves",
  },
  {
    slug: "matosinhos-tech-mt-generate",
    title: "MT Generate",
    venueName: "Fabrica Vasco da Gama",
    venueAddress: "Fabrica Vasco da Gama, Avenida Meneres, Matosinhos Sul, Matosinhos, Porto, 4450-191, Portugal",
    lat: 41.178953,
    lng: -8.6848348,
    startsAtIso: "2025-11-06T18:00:00+00:00",
    endsAtIso: "2025-11-06T23:59:00+00:00",
    coverImageUrl: "https://framerusercontent.com/images/XSCvRDgjXzQu7LeEt1s8dPj1ZA.jpg?width=7008&height=4672",
    description:
      "MT Generate delivered an evening of insights and innovation, from a live podcast with Miguel Correia to talks by Tonic App, Talka.AI, and Google DeepMind, ending with a lively networking session and DJs.",
    attendees: 320,
    grossCents: 2475000,
    sourceUrl: "https://matosinhos.tech/events/mt-generate",
  },
];

function assertEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Variavel obrigatoria em falta: ${name}`);
  return value;
}

function makeAddressHash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function roundCents(value: number): number {
  return Math.round(value);
}

function plusDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function listAllAuthUsers(supabase: ReturnType<typeof createClient>) {
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

async function ensureGlobalUsername(
  prisma: PrismaClient,
  username: string,
  ownerType: "USER" | "ORG",
  ownerId: string,
) {
  const existing = await prisma.globalUsername.findUnique({ where: { username } });
  if (existing && (existing.ownerType !== ownerType || existing.ownerId !== ownerId)) {
    throw new Error(
      `Username global @${username} ja pertence a ${existing.ownerType}:${existing.ownerId}.`,
    );
  }

  await prisma.globalUsername.upsert({
    where: { username },
    update: { ownerType, ownerId },
    create: { username, ownerType, ownerId },
  });
}

async function upsertAddress(
  prisma: PrismaClient,
  input: { formattedAddress: string; city: string; lat: number; lng: number },
) {
  const hash = makeAddressHash(`${input.formattedAddress}|${input.lat}|${input.lng}`);

  return prisma.address.upsert({
    where: { addressHash: hash },
    update: {
      formattedAddress: input.formattedAddress,
      canonical: {
        line1: input.formattedAddress,
        city: input.city,
        country: "PT",
      },
      latitude: input.lat,
      longitude: input.lng,
      sourceProvider: "APPLE_MAPS",
      sourceProviderPlaceId: `matosinhos_migration_${hash.slice(0, 16)}`,
      confidenceScore: 95,
      validationStatus: "VERIFIED",
    },
    create: {
      formattedAddress: input.formattedAddress,
      canonical: {
        line1: input.formattedAddress,
        city: input.city,
        country: "PT",
      },
      latitude: input.lat,
      longitude: input.lng,
      sourceProvider: "APPLE_MAPS",
      sourceProviderPlaceId: `matosinhos_migration_${hash.slice(0, 16)}`,
      confidenceScore: 95,
      validationStatus: "VERIFIED",
      addressHash: hash,
    },
  });
}

async function ensureAuthUser(
  supabase: ReturnType<typeof createClient>,
  input: { email: string; password: string; fullName: string },
) {
  const allAuthUsers = await listAllAuthUsers(supabase);
  const normalized = input.email.toLowerCase();
  const existing = allAuthUsers.find((u) => (u.email ?? "").toLowerCase() === normalized);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
    if (error) throw error;
    return existing.id;
  }

  const created = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (created.error || !created.data.user?.id) {
    throw created.error ?? new Error(`Nao foi possivel criar auth user ${input.email}`);
  }

  return created.data.user.id;
}

async function ensureProfile(
  prisma: PrismaClient,
  input: { userId: string; username: string; fullName: string },
) {
  const existingByUsername = await prisma.profile.findUnique({
    where: { username: input.username },
    select: { id: true },
  });

  if (existingByUsername && existingByUsername.id !== input.userId) {
    throw new Error(`Username @${input.username} ja esta associado a outro utilizador.`);
  }

  await prisma.profile.upsert({
    where: { id: input.userId },
    update: {
      username: input.username,
      fullName: input.fullName,
      roles: ["user", "organization"],
      onboardingDone: true,
      visibility: "PUBLIC",
      locationConsent: "GRANTED",
      locationGranularity: "COARSE",
      status: "ACTIVE",
      isDeleted: false,
      deletedAt: null,
      deletedAtFinal: null,
      deletionRequestedAt: null,
      deletionScheduledFor: null,
    },
    create: {
      id: input.userId,
      username: input.username,
      fullName: input.fullName,
      roles: ["user", "organization"],
      onboardingDone: true,
      visibility: "PUBLIC",
      locationConsent: "GRANTED",
      locationGranularity: "COARSE",
      status: "ACTIVE",
      isDeleted: false,
    },
  });

  await ensureGlobalUsername(prisma, input.username, "USER", input.userId);
}

async function ensureOrganization(
  prisma: PrismaClient,
  input: {
    username: string;
    publicName: string;
    ownerUserId: string;
    officialEmail: string;
    addressId: string;
  },
) {
  const existing = await prisma.organization.findUnique({ where: { username: input.username } });

  if (existing) {
    const org = await prisma.organization.update({
      where: { id: existing.id },
      data: {
        publicName: input.publicName,
        status: "ACTIVE",
        organizationKind: "ASSOCIACAO",
        orgType: "EXTERNAL",
        primaryModule: "EVENTOS",
        officialEmail: input.officialEmail,
        officialEmailVerifiedAt: new Date(),
        alertsEmail: input.officialEmail,
        stripeAccountId: existing.stripeAccountId ?? "acct_platform_orya_shared",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        platformFeeBps: 200,
        platformFeeFixedCents: 0,
        feeMode: FeeMode.ADDED,
        language: "pt",
        timezone: "Europe/Lisbon",
        publicWebsite: "https://matosinhos.tech",
        publicInstagram: "https://www.instagram.com/matosinhos.tech/",
        publicLinkedin: "https://www.linkedin.com/company/matosinhos-tech/about/?viewAsMember=true",
        publicTiktok: "https://www.tiktok.com/@matosinhostech",
        publicYoutube: "https://www.youtube.com/@matosinhostech",
        publicDescription: ORG_DESCRIPTION,
        publicHours: "Comunidade e eventos em calendario sazonal.",
        infoLocationNotes: "Eventos presenciais em Matosinhos e Leça da Palmeira.",
        brandingPrimaryColor: "#2BB683",
        brandingSecondaryColor: "#111011",
        addressId: input.addressId,
        showAddressPublicly: true,
      },
    });

    await prisma.organizationGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: org.groupId,
          userId: input.ownerUserId,
        },
      },
      update: { role: "OWNER", scopeAllOrgs: true, scopeOrgIds: [] },
      create: {
        groupId: org.groupId,
        userId: input.ownerUserId,
        role: "OWNER",
        scopeAllOrgs: true,
        scopeOrgIds: [],
      },
    });

    await ensureGlobalUsername(prisma, input.username, "ORG", String(org.id));
    return org;
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
      organizationKind: "ASSOCIACAO",
      orgType: "EXTERNAL",
      primaryModule: "EVENTOS",
      officialEmail: input.officialEmail,
      officialEmailVerifiedAt: new Date(),
      alertsEmail: input.officialEmail,
      stripeAccountId: "acct_platform_orya_shared",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      platformFeeBps: 200,
      platformFeeFixedCents: 0,
      feeMode: FeeMode.ADDED,
      language: "pt",
      timezone: "Europe/Lisbon",
      publicWebsite: "https://matosinhos.tech",
      publicInstagram: "https://www.instagram.com/matosinhos.tech/",
      publicLinkedin: "https://www.linkedin.com/company/matosinhos-tech/about/?viewAsMember=true",
      publicTiktok: "https://www.tiktok.com/@matosinhostech",
      publicYoutube: "https://www.youtube.com/@matosinhostech",
      publicDescription: ORG_DESCRIPTION,
      publicHours: "Comunidade e eventos em calendario sazonal.",
      infoLocationNotes: "Eventos presenciais em Matosinhos e Leça da Palmeira.",
      brandingPrimaryColor: "#2BB683",
      brandingSecondaryColor: "#111011",
      addressId: input.addressId,
      showAddressPublicly: true,
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
  return org;
}

async function upsertAnalyticsRollups(
  prisma: PrismaClient,
  input: {
    organizationId: number;
    bucketDate: Date;
    grossCents: number;
    platformFeeCents: number;
    processorFeeCents: number;
    netToOrgCents: number;
  },
) {
  const metrics: Array<[AnalyticsMetricKey, number]> = [
    [AnalyticsMetricKey.GROSS, input.grossCents],
    [AnalyticsMetricKey.PLATFORM_FEES, input.platformFeeCents],
    [AnalyticsMetricKey.PROCESSOR_FEES, input.processorFeeCents],
    [AnalyticsMetricKey.NET_TO_ORG, input.netToOrgCents],
  ];

  const dimensions: Array<[AnalyticsDimensionKey, string]> = [
    [AnalyticsDimensionKey.MODULE, "EVENTOS"],
    [AnalyticsDimensionKey.SOURCE_TYPE, "TICKET_ORDER"],
    [AnalyticsDimensionKey.PAYMENT_PROVIDER, "STRIPE"],
    [AnalyticsDimensionKey.CURRENCY, "EUR"],
  ];

  for (const [metricKey, value] of metrics) {
    for (const [dimensionKey, dimensionValue] of dimensions) {
      await prisma.analyticsRollup.upsert({
        where: {
          organizationId_bucketDate_metricKey_dimensionKey_dimensionValue: {
            organizationId: input.organizationId,
            bucketDate: input.bucketDate,
            metricKey,
            dimensionKey,
            dimensionValue,
          },
        },
        update: { value },
        create: {
          organizationId: input.organizationId,
          bucketDate: input.bucketDate,
          metricKey,
          dimensionKey,
          dimensionValue,
          value,
        },
      });
    }
  }
}

async function main() {
  const supabaseUrl = assertEnv(
    "SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL",
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const supabaseServiceRole = assertEnv("SUPABASE_SERVICE_ROLE", process.env.SUPABASE_SERVICE_ROLE);
  const databaseUrl = assertEnv("DATABASE_URL", process.env.DATABASE_URL);

  const supabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const userId = await ensureAuthUser(supabase, {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      fullName: FULL_NAME,
    });

    await ensureProfile(prisma, {
      userId,
      username: USERNAME,
      fullName: FULL_NAME,
    });

    const orgAddress = await upsertAddress(prisma, {
      formattedAddress: "Matosinhos, Porto, Portugal",
      city: "Matosinhos",
      lat: 41.1806814,
      lng: -8.6821998,
    });

    const organization = await ensureOrganization(prisma, {
      username: ORG_USERNAME,
      publicName: ORG_PUBLIC_NAME,
      ownerUserId: userId,
      officialEmail: ORG_OFFICIAL_EMAIL,
      addressId: orgAddress.id,
    });

    await prisma.profile.update({
      where: { id: userId },
      data: { activeOrganizationId: organization.id, roles: ["user", "organization"] },
    });

    const now = new Date();
    const eventsCreated: Array<{ id: number; slug: string; status: string }> = [];

    for (const seedEvent of SEED_EVENTS) {
      const eventAddress = await upsertAddress(prisma, {
        formattedAddress: seedEvent.venueAddress,
        city: "Matosinhos",
        lat: seedEvent.lat,
        lng: seedEvent.lng,
      });

      const startsAt = new Date(seedEvent.startsAtIso);
      const endsAt = new Date(seedEvent.endsAtIso);
      const status = endsAt < now ? "FINISHED" : "PUBLISHED";
      const paymentId = `mt_migration_payment_${seedEvent.slug}`;
      const purchaseId = `mt_migration_purchase_${seedEvent.slug}`;
      const paymentIntentId = `pi_mt_migration_${seedEvent.slug}`;
      const financeSourceType = SourceType.TICKET_ORDER;
      const financeSourceId = purchaseId;

      const event = await prisma.event.upsert({
        where: { slug: seedEvent.slug },
        update: {
          title: seedEvent.title,
          description: `${seedEvent.description}\n\nVenue: ${seedEvent.venueName}\nSource: ${seedEvent.sourceUrl}`,
          organizationId: organization.id,
          startsAt,
          endsAt,
          addressId: eventAddress.id,
          pricingMode: "STANDARD",
          status: status as "FINISHED" | "PUBLISHED",
          timezone: "Europe/Lisbon",
          coverImageUrl: seedEvent.coverImageUrl,
          ownerUserId: userId,
          templateType: "TALK",
          interestTags: ["tech", "community", "networking", "matosinhos"],
          feeMode: FeeMode.ADDED,
          payoutMode: "ORGANIZATION",
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          slug: seedEvent.slug,
          title: seedEvent.title,
          description: `${seedEvent.description}\n\nVenue: ${seedEvent.venueName}\nSource: ${seedEvent.sourceUrl}`,
          organizationId: organization.id,
          startsAt,
          endsAt,
          addressId: eventAddress.id,
          pricingMode: "STANDARD",
          status: status as "FINISHED" | "PUBLISHED",
          timezone: "Europe/Lisbon",
          coverImageUrl: seedEvent.coverImageUrl,
          ownerUserId: userId,
          templateType: "TALK",
          interestTags: ["tech", "community", "networking", "matosinhos"],
          feeMode: FeeMode.ADDED,
          payoutMode: "ORGANIZATION",
        },
      });

      const avgTicketCents = Math.max(1200, roundCents(seedEvent.grossCents / Math.max(seedEvent.attendees, 1)));
      const ticketType = await prisma.ticketType.findFirst({
        where: { eventId: event.id, name: "Entrada Geral" },
        select: { id: true },
      });
      let ticketTypeId = ticketType?.id ?? null;

      if (ticketType) {
        await prisma.ticketType.update({
          where: { id: ticketType.id },
          data: {
            description: `Bilhete geral para ${seedEvent.title}`,
            price: avgTicketCents,
            currency: "EUR",
            totalQuantity: seedEvent.attendees + Math.max(30, Math.round(seedEvent.attendees * 0.15)),
            soldQuantity: seedEvent.attendees,
            status: status === "FINISHED" ? "CLOSED" : "ON_SALE",
            startsAt: plusDays(startsAt, -30),
            endsAt,
          },
        });
      } else {
        const createdTicketType = await prisma.ticketType.create({
          data: {
            eventId: event.id,
            name: "Entrada Geral",
            description: `Bilhete geral para ${seedEvent.title}`,
            price: avgTicketCents,
            currency: "EUR",
            totalQuantity: seedEvent.attendees + Math.max(30, Math.round(seedEvent.attendees * 0.15)),
            soldQuantity: seedEvent.attendees,
            status: status === "FINISHED" ? "CLOSED" : "ON_SALE",
            startsAt: plusDays(startsAt, -30),
            endsAt,
          },
        });
        ticketTypeId = createdTicketType.id;
      }

      if (!ticketTypeId) {
        throw new Error(`Nao foi possivel resolver ticket type para ${seedEvent.slug}.`);
      }

      const platformFeeCents = roundCents(seedEvent.grossCents * 0.02);
      const processorFeeCents = roundCents(seedEvent.grossCents * 0.018) + 30;
      const netToOrgCents = Math.max(0, seedEvent.grossCents - platformFeeCents - processorFeeCents);

      await prisma.payment.upsert({
        where: { id: paymentId },
        update: {
          organizationId: organization.id,
          sourceType: financeSourceType,
          sourceId: financeSourceId,
          status: PaymentStatus.SUCCEEDED,
          feePolicyVersion: "matosinhos-tech-migration-v1",
          pricingSnapshotJson: {
            source: "matosinhos-tech-migration",
            eventSlug: seedEvent.slug,
            eventTitle: seedEvent.title,
            attendees: seedEvent.attendees,
            grossCents: seedEvent.grossCents,
            platformFeeCents,
            processorFeeCents,
            netToOrgCents,
            currency: "EUR",
          },
          pricingSnapshotHash: null,
          processorFeesStatus: "FINAL",
          processorFeesActual: processorFeeCents,
          idempotencyKey: `idemp_${paymentId}`,
        },
        create: {
          id: paymentId,
          organizationId: organization.id,
          sourceType: financeSourceType,
          sourceId: financeSourceId,
          status: PaymentStatus.SUCCEEDED,
          feePolicyVersion: "matosinhos-tech-migration-v1",
          pricingSnapshotJson: {
            source: "matosinhos-tech-migration",
            eventSlug: seedEvent.slug,
            eventTitle: seedEvent.title,
            attendees: seedEvent.attendees,
            grossCents: seedEvent.grossCents,
            platformFeeCents,
            processorFeeCents,
            netToOrgCents,
            currency: "EUR",
          },
          pricingSnapshotHash: null,
          processorFeesStatus: "FINAL",
          processorFeesActual: processorFeeCents,
          idempotencyKey: `idemp_${paymentId}`,
        },
      });

      await prisma.paymentSnapshot.upsert({
        where: { paymentId },
        update: {
          organizationId: organization.id,
          sourceType: financeSourceType,
          sourceId: financeSourceId,
          status: PaymentStatus.SUCCEEDED,
          currency: "EUR",
          grossCents: seedEvent.grossCents,
          platformFeeCents,
          processorFeesCents: processorFeeCents,
          netToOrgCents,
          lastEventId: `migration:${seedEvent.slug}`,
        },
        create: {
          paymentId,
          organizationId: organization.id,
          sourceType: financeSourceType,
          sourceId: financeSourceId,
          status: PaymentStatus.SUCCEEDED,
          currency: "EUR",
          grossCents: seedEvent.grossCents,
          platformFeeCents,
          processorFeesCents: processorFeeCents,
          netToOrgCents,
          lastEventId: `migration:${seedEvent.slug}`,
        },
      });

      const correlationId = `mt_migration_${seedEvent.slug}`;
      const ledgerRows: Array<{ causationId: string; entryType: LedgerEntryType; amount: number }> = [
        { causationId: `${correlationId}:gross`, entryType: LedgerEntryType.GROSS, amount: seedEvent.grossCents },
        {
          causationId: `${correlationId}:platform_fee`,
          entryType: LedgerEntryType.PLATFORM_FEE,
          amount: -platformFeeCents,
        },
        {
          causationId: `${correlationId}:processor_fee`,
          entryType: LedgerEntryType.PROCESSOR_FEES_FINAL,
          amount: -processorFeeCents,
        },
      ];

      for (const row of ledgerRows) {
        await prisma.ledgerEntry.upsert({
          where: {
            paymentId_causationId: {
              paymentId,
              causationId: row.causationId,
            },
          },
          update: {
            entryType: row.entryType,
            amount: row.amount,
            currency: "EUR",
            sourceType: financeSourceType,
            sourceId: financeSourceId,
            correlationId,
            createdAt: endsAt,
          },
          create: {
            paymentId,
            entryType: row.entryType,
            amount: row.amount,
            currency: "EUR",
            sourceType: financeSourceType,
            sourceId: financeSourceId,
            causationId: row.causationId,
            correlationId,
            createdAt: endsAt,
          },
        });
      }

      const saleSummary = await prisma.saleSummary.upsert({
        where: { purchaseId },
        update: {
          eventId: event.id,
          userId,
          ownerUserId: userId,
          paymentIntentId,
          subtotalCents: seedEvent.grossCents,
          discountCents: 0,
          platformFeeCents,
          cardPlatformFeeCents: platformFeeCents,
          stripeFeeCents: processorFeeCents,
          totalCents: seedEvent.grossCents,
          netCents: netToOrgCents,
          feeMode: FeeMode.ADDED,
          paymentMethod: "card",
          currency: "EUR",
          status: "PAID",
          createdAt: startsAt,
        },
        create: {
          eventId: event.id,
          userId,
          ownerUserId: userId,
          purchaseId,
          paymentIntentId,
          subtotalCents: seedEvent.grossCents,
          discountCents: 0,
          platformFeeCents,
          cardPlatformFeeCents: platformFeeCents,
          stripeFeeCents: processorFeeCents,
          totalCents: seedEvent.grossCents,
          netCents: netToOrgCents,
          feeMode: FeeMode.ADDED,
          paymentMethod: "card",
          currency: "EUR",
          status: "PAID",
          createdAt: startsAt,
        },
      });

      await prisma.saleLine.deleteMany({ where: { saleSummaryId: saleSummary.id } });
      await prisma.saleLine.create({
        data: {
          saleSummaryId: saleSummary.id,
          eventId: event.id,
          ticketTypeId,
          quantity: 1,
          unitPriceCents: seedEvent.grossCents,
          discountPerUnitCents: 0,
          grossCents: seedEvent.grossCents,
          netCents: netToOrgCents,
          platformFeeCents,
          createdAt: startsAt,
        },
      });

      const existingPayouts = await prisma.payout.findMany({
        where: { paymentId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (existingPayouts.length === 0) {
        await prisma.payout.create({
          data: {
            organizationId: organization.id,
            sourceType: financeSourceType,
            sourceId: financeSourceId,
            paymentId,
            paymentIntentId,
            transferId: `tr_${seedEvent.slug}`,
            currency: "EUR",
            grossAmountCents: seedEvent.grossCents,
            platformFeeCents,
            feeMode: FeeMode.ADDED,
            amountCents: netToOrgCents,
            status: PayoutStatus.RELEASED,
            releasedAt: plusDays(endsAt, 2),
            createdAt: plusDays(endsAt, 2),
          },
        });
      } else {
        await prisma.payout.update({
          where: { id: existingPayouts[0]!.id },
          data: {
            organizationId: organization.id,
            sourceType: financeSourceType,
            sourceId: financeSourceId,
            paymentId,
            paymentIntentId,
            transferId: `tr_${seedEvent.slug}`,
            currency: "EUR",
            grossAmountCents: seedEvent.grossCents,
            platformFeeCents,
            feeMode: FeeMode.ADDED,
            amountCents: netToOrgCents,
            status: PayoutStatus.RELEASED,
            releasedAt: plusDays(endsAt, 2),
          },
        });

        if (existingPayouts.length > 1) {
          await prisma.payout.deleteMany({
            where: { id: { in: existingPayouts.slice(1).map((row) => row.id) } },
          });
        }
      }

      const bucketDate = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate()));
      await upsertAnalyticsRollups(prisma, {
        organizationId: organization.id,
        bucketDate,
        grossCents: seedEvent.grossCents,
        platformFeeCents,
        processorFeeCents,
        netToOrgCents,
      });

      eventsCreated.push({ id: event.id, slug: event.slug, status });
    }

    console.log("[matosinhos-migration] concluido com sucesso");
    console.log(`[matosinhos-migration] user: ${USERNAME} (${USER_EMAIL})`);
    console.log(`[matosinhos-migration] organization: ${organization.publicName} (#${organization.id})`);
    console.log(`[matosinhos-migration] events: ${eventsCreated.length}`);
    for (const event of eventsCreated) {
      console.log(`  - #${event.id} ${event.slug} [${event.status}]`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[matosinhos-migration] erro:", error);
  process.exitCode = 1;
});
