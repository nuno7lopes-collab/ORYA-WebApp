/**
 * Seed Mobile V2 (dataset realista para app mobile).
 *
 * Uso:
 *   node scripts/run-ts.cjs scripts/seed_mobile_v2.ts
 *
 * Opcional env:
 *   SEED_ENV=prod|test
 *   SEED_PREFIX=mobilev2
 *   SEED_USERS=24
 *   SEED_ORGS=8
 *   SEED_EVENTS=64
 *   SEED_CLEAR=true
 *   SEED_RICH=true
 *   SEED_PASSWORD=TestOrya123!
 *   SEED_PORTO_RATIO=0.25
 *   SEED_FOLLOWS_MIN=2
 *   SEED_FOLLOWS_MAX=7
 *   SEED_ORG_FOLLOWS_MAX=3
 *   SEED_ADDRESS_ID=<uuid>
 *   SEED_ADDRESS_IDS=<uuid,uuid,...>
 *   SEED_PORTO_ADDRESS_IDS=<uuid,uuid,...>
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  AddressSourceProvider,
  AddressValidationStatus,
  EventPricingMode,
  EventStatus,
  EventTemplateType,
  EventAccessMode,
  InviteIdentityMatch,
  CheckinMethod,
  OrganizationModule,
  OrganizationStatus,
  PadelPreferredSide,
  PrismaClient,
  TicketTypeStatus,
  TournamentFormat,
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
const seedPrefix = (process.env.SEED_PREFIX || "mobilev2").toLowerCase().replace(/[^a-z0-9-]/g, "");
const seedUsers = Math.max(4, Number(process.env.SEED_USERS || 24));
const seedOrgs = Math.max(3, Number(process.env.SEED_ORGS || 8));
const seedEvents = Math.max(8, Number(process.env.SEED_EVENTS || seedOrgs * 8));
const shouldClear = ["1", "true", "yes"].includes(String(process.env.SEED_CLEAR || "").toLowerCase());
const seedPassword = process.env.SEED_PASSWORD || "TestOrya123!";
const seedPortoRatio = Math.min(0.8, Math.max(0.1, Number(process.env.SEED_PORTO_RATIO || 0.25)));
const followsMin = Math.max(1, Number(process.env.SEED_FOLLOWS_MIN || 2));
const followsMax = Math.max(followsMin, Number(process.env.SEED_FOLLOWS_MAX || 7));
const orgFollowsMax = Math.max(0, Number(process.env.SEED_ORG_FOLLOWS_MAX || 3));
const seedRich = ["1", "true", "yes"].includes(String(process.env.SEED_RICH || "").toLowerCase());
const seedAddressId = typeof process.env.SEED_ADDRESS_ID === "string" ? process.env.SEED_ADDRESS_ID.trim() : "";
const seedAddressIds = (process.env.SEED_ADDRESS_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const seedPortoAddressIds = (process.env.SEED_PORTO_ADDRESS_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const addressIds = seedAddressIds.length > 0 ? seedAddressIds : seedAddressId ? [seedAddressId] : [];

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
  "Andre",
  "Francisca",
  "Hugo",
  "Catarina",
  "Miguel",
  "Sofia",
  "Leonor",
  "Pedro",
  "Rui",
  "Bruna",
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
  "Barbosa",
  "Gomes",
  "Rocha",
  "Teixeira",
  "Pinto",
  "Cardoso",
];
const BIOS = [
  "Apaixonado por eventos e experiências únicas.",
  "Sempre à procura do próximo plano com amigos.",
  "Música, desporto e boas vibes.",
  "Explora a cidade e os melhores planos.",
  "Marca presença onde a energia acontece.",
  "Curioso por experiências novas e diferentes.",
  "Padel, concertos e fins de semana bem passados.",
  "Gastronomia, viagens e workshops criativos.",
];
const AVATARS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1524503033411-c9566986fc8f?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
];
const COVERS = [
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1515165562835-c4c1b9d1cb2f?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=1600&q=80",
];

const ORG_NAMES = [
  "ORYA Studio Lisboa",
  "ORYA Arena Porto",
  "ORYA Social Club",
  "ORYA Padel Lab",
  "ORYA Experience House",
  "ORYA Rooftop Sessions",
  "ORYA Creative Factory",
  "ORYA City Lab",
];
const ORG_DESCRIPTIONS = [
  "Curadoria de eventos premium e experiências únicas.",
  "Clubhouse com torneios e comunidade ativa.",
  "Espaço de cultura, música e desporto.",
  "Clube de padel com torneios semanais.",
  "Plataforma de experiências e serviços urbanos.",
  "Eventos sunset e noites especiais.",
  "Workshops e experiências criativas na cidade.",
  "Hub de comunidade e eventos urbanos.",
];

const INTERESTS = [
  "padel",
  "concertos",
  "festas",
  "viagens",
  "bem_estar",
  "gastronomia",
  "aulas",
  "workshops",
];

const PADEL_LEVELS = ["M3", "M4", "M5"];
const PADEL_CLUBS = [
  "Clube Padel Demo",
  "Padel Factory",
  "Smash House",
  "Arena Padel",
  "Racket Club",
];

const EVENT_THEMES = [
  {
    title: "Padel Night Series",
    description: "Torneio de padel com ambiente competitivo e boa energia.",
    templateType: EventTemplateType.PADEL,
    interest: "padel",
    cover: COVERS[0],
    padel: true,
  },
  {
    title: "Open Padel Weekend",
    description: "Fim de semana de padel com jogos e after vibes.",
    templateType: EventTemplateType.PADEL,
    interest: "padel",
    cover: COVERS[1],
    padel: true,
  },
  {
    title: "Concerto Indie ao Vivo",
    description: "Concerto íntimo com bandas locais e convidados especiais.",
    templateType: EventTemplateType.PARTY,
    interest: "concertos",
    cover: COVERS[2],
  },
  {
    title: "Festival de Verão",
    description: "Festival com música ao vivo, food trucks e sunsets.",
    templateType: EventTemplateType.PARTY,
    interest: "concertos",
    cover: COVERS[3],
  },
  {
    title: "Festa Neon",
    description: "Festa com luzes neon, DJs convidados e pista cheia.",
    templateType: EventTemplateType.PARTY,
    interest: "festas",
    cover: COVERS[4],
  },
  {
    title: "Sunset Rooftop Party",
    description: "Festa sunset com vista e vibes de verão.",
    templateType: EventTemplateType.PARTY,
    interest: "festas",
    cover: COVERS[5],
  },
  {
    title: "Workshop de Fotografia Urbana",
    description: "Workshop prático de fotografia na cidade.",
    templateType: EventTemplateType.TALK,
    interest: "workshops",
    cover: COVERS[6],
  },
  {
    title: "Workshop de Cerâmica",
    description: "Workshop criativo com técnicas base e peças únicas.",
    templateType: EventTemplateType.TALK,
    interest: "workshops",
    cover: COVERS[7],
  },
  {
    title: "Aula de Dança",
    description: "Aula aberta de dança com coreografia e boa energia.",
    templateType: EventTemplateType.OTHER,
    interest: "aulas",
    cover: COVERS[8],
  },
  {
    title: "Aula de Surf Indoor",
    description: "Aula de surf com instrutor e experiência completa.",
    templateType: EventTemplateType.OTHER,
    interest: "aulas",
    cover: COVERS[0],
  },
  {
    title: "Retiro de Bem-Estar & Yoga",
    description: "Sessão de bem-estar com yoga, breathwork e relax.",
    templateType: EventTemplateType.OTHER,
    interest: "bem_estar",
    cover: COVERS[1],
  },
  {
    title: "Sound Bath Session",
    description: "Bem-estar profundo com sound bath e meditação guiada.",
    templateType: EventTemplateType.OTHER,
    interest: "bem_estar",
    cover: COVERS[2],
  },
  {
    title: "Jantar de Degustação",
    description: "Gastronomia premium com menu degustação e pairing.",
    templateType: EventTemplateType.OTHER,
    interest: "gastronomia",
    cover: COVERS[3],
  },
  {
    title: "Food Market Experience",
    description: "Gastronomia de rua com sabores locais e internacionais.",
    templateType: EventTemplateType.OTHER,
    interest: "gastronomia",
    cover: COVERS[4],
  },
  {
    title: "Viagem Surpresa Weekend",
    description: "Viagem surpresa com roteiro curado e experiências únicas.",
    templateType: EventTemplateType.OTHER,
    interest: "viagens",
    cover: COVERS[5],
  },
  {
    title: "Roadtrip Criativa",
    description: "Viagem com paragens criativas e momentos inesperados.",
    templateType: EventTemplateType.OTHER,
    interest: "viagens",
    cover: COVERS[6],
  },
  {
    title: "Talk: Futuro da Música",
    description: "Talk com convidados sobre o futuro da música e cultura.",
    templateType: EventTemplateType.TALK,
    interest: "concertos",
    cover: COVERS[7],
  },
  {
    title: "Meetup Criativo",
    description: "Talk e networking com creators e makers locais.",
    templateType: EventTemplateType.TALK,
    interest: "workshops",
    cover: COVERS[8],
  },
];

const DEFAULT_ADDRESSES = [
  {
    label: "Av. da Liberdade 1250-140, Lisboa",
    city: "Lisboa",
    region: "Lisboa",
    country: "Portugal",
    lat: 38.721646,
    lng: -9.146308,
  },
  {
    label: "Praca da Ribeira, 4050-513 Porto",
    city: "Porto",
    region: "Porto",
    country: "Portugal",
    lat: 41.140301,
    lng: -8.611,
  },
  {
    label: "Largo do Paço, 4704-524 Braga",
    city: "Braga",
    region: "Braga",
    country: "Portugal",
    lat: 41.5518,
    lng: -8.4274,
  },
  {
    label: "Rua da Sofia, 3000-389 Coimbra",
    city: "Coimbra",
    region: "Coimbra",
    country: "Portugal",
    lat: 40.2057,
    lng: -8.4122,
  },
  {
    label: "Marina de Lagos, 8600-315 Lagos",
    city: "Lagos",
    region: "Algarve",
    country: "Portugal",
    lat: 37.1087,
    lng: -8.6695,
  },
  {
    label: "Praca do Giraldo, 7000-508 Evora",
    city: "Evora",
    region: "Alentejo",
    country: "Portugal",
    lat: 38.5712,
    lng: -7.9079,
  },
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

const shuffle = <T>(list: T[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildCanonical = (entry: (typeof DEFAULT_ADDRESSES)[number]) => ({
  label: entry.label,
  addressLine1: entry.label,
  city: entry.city,
  region: entry.region,
  country: entry.country,
});

const hashAddress = (canonical: Record<string, unknown>, lat: number, lng: number) => {
  const payload = `${JSON.stringify(canonical)}:${lat}:${lng}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
};

const ensureAddresses = async () => {
  if (addressIds.length > 0 || seedPortoAddressIds.length > 0) return;
  for (const entry of DEFAULT_ADDRESSES) {
    const canonical = buildCanonical(entry);
    const addressHash = hashAddress(canonical, entry.lat, entry.lng);
    await prisma.address.upsert({
      where: { addressHash },
      update: {
        env: seedEnv,
        formattedAddress: entry.label,
        canonical,
        latitude: entry.lat,
        longitude: entry.lng,
        sourceProvider: AddressSourceProvider.MANUAL,
        confidenceScore: 20,
        validationStatus: AddressValidationStatus.RAW,
      },
      create: {
        env: seedEnv,
        formattedAddress: entry.label,
        canonical,
        latitude: entry.lat,
        longitude: entry.lng,
        sourceProvider: AddressSourceProvider.MANUAL,
        confidenceScore: 20,
        validationStatus: AddressValidationStatus.RAW,
        addressHash,
      },
    });
  }
};

async function resolveAuthUser(email: string) {
  let user: User | null = null;

  try {
    const admin = supabaseAdmin.auth.admin as typeof supabaseAdmin.auth.admin & {
      getUserByEmail?: (value: string) => Promise<{ data?: { user?: User | null } | null }>;
    };
    if (typeof admin.getUserByEmail === "function") {
      const { data } = await admin.getUserByEmail(email);
      user = data?.user ?? null;
    }
  } catch {
    // ignore and fallback to list/create
  }

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

const buildInterestSet = (forcePadel = false) => {
  const count = randomBetween(2, 4);
  const shuffled = shuffle(INTERESTS);
  let picked = shuffled.slice(0, count);
  if (forcePadel && !picked.includes("padel")) {
    if (picked.length === 0) {
      picked = ["padel"];
    } else {
      picked[picked.length - 1] = "padel";
    }
  }
  return Array.from(new Set(picked));
};

const TIME_WINDOWS = [
  { key: "live", offsetMinutes: -30, durationHours: 2 },
  { key: "live", offsetMinutes: -60, durationHours: 3 },
  { key: "soon", offsetMinutes: 45, durationHours: 2 },
  { key: "soon", offsetMinutes: 75, durationHours: 2 },
  { key: "today", offsetHours: 6, durationHours: 3 },
  { key: "today", offsetHours: 12, durationHours: 3 },
  { key: "tomorrow", offsetHours: 30, durationHours: 3 },
  { key: "48h", offsetHours: 48, durationHours: 4 },
  { key: "72h", offsetHours: 72, durationHours: 4 },
  { key: "week", offsetDays: 7, durationHours: 4 },
  { key: "two-weeks", offsetDays: 14, durationHours: 5 },
  { key: "month", offsetDays: 30, durationHours: 6 },
  { key: "past", offsetHours: -8, durationHours: 3 },
  { key: "past", offsetDays: -3, durationHours: 4 },
];

const resolveTimeWindow = (index: number, now: Date) => {
  const window = pick(TIME_WINDOWS, index);
  let offsetMinutes = 0;
  if (typeof window.offsetMinutes === "number") offsetMinutes = window.offsetMinutes;
  if (typeof window.offsetHours === "number") offsetMinutes = window.offsetHours * 60;
  if (typeof window.offsetDays === "number") offsetMinutes = window.offsetDays * 24 * 60;
  const jitter = randomBetween(-15, 15);
  const start = new Date(now.getTime() + (offsetMinutes + jitter) * 60 * 1000);
  const durationMs = window.durationHours * 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  return { start, end, key: window.key };
};

const resolveProfileVisibility = (index: number) => {
  if (!seedRich) return "PUBLIC";
  if (index % 10 === 0) return "PRIVATE";
  if (index % 5 === 0) return "FOLLOWERS";
  return "PUBLIC";
};

const resolveEventStatus = (index: number, timeKey: string) => {
  if (!seedRich) return EventStatus.PUBLISHED;
  if (timeKey === "past") {
    return index % 4 === 0 ? EventStatus.CANCELLED : EventStatus.FINISHED;
  }
  if (index % 6 === 0) return EventStatus.DATE_CHANGED;
  return EventStatus.PUBLISHED;
};

const resolveAccessMode = (index: number) => {
  if (!seedRich) return EventAccessMode.UNLISTED;
  if (index % 9 === 0) return EventAccessMode.INVITE_ONLY;
  if (index % 4 === 0) return EventAccessMode.UNLISTED;
  return EventAccessMode.PUBLIC;
};

const resolveCheckinMethods = (templateType: EventTemplateType | null) => {
  if (templateType === EventTemplateType.PADEL) {
    return [CheckinMethod.QR_REGISTRATION];
  }
  return [CheckinMethod.QR_TICKET];
};

const buildTicketTypes = (index: number, isFree: boolean, startsAt: Date) => {
  const ticketTypes: Array<{
    name: string;
    description: string | null;
    price: number;
    currency: string;
    totalQuantity: number;
    soldQuantity: number;
    status: TicketTypeStatus;
    startsAt: Date | null;
    endsAt: Date | null;
  }> = [];

  const totalQuantity = randomBetween(60, 200);
  const saleStart = new Date(startsAt.getTime() - randomBetween(3, 14) * 24 * 60 * 60 * 1000);
  const saleEnd = new Date(startsAt.getTime() - randomBetween(1, 6) * 60 * 60 * 1000);

  if (isFree) {
    const sold = Math.min(totalQuantity, randomBetween(0, Math.floor(totalQuantity * 0.9)));
    ticketTypes.push({
      name: "Entrada livre",
      description: null,
      price: 0,
      currency: "EUR",
      totalQuantity,
      soldQuantity: sold,
      status: sold >= totalQuantity ? TicketTypeStatus.SOLD_OUT : TicketTypeStatus.ON_SALE,
      startsAt: saleStart,
      endsAt: saleEnd,
    });
    return ticketTypes;
  }

  const multiWave = index % 4 === 0;
  if (multiWave) {
    const earlyTotal = Math.floor(totalQuantity * 0.4);
    const regularTotal = totalQuantity - earlyTotal;
    const earlySold = Math.min(earlyTotal, randomBetween(0, Math.floor(earlyTotal * 0.9)));
    const regularSold = Math.min(regularTotal, randomBetween(0, Math.floor(regularTotal * 0.7)));

    ticketTypes.push({
      name: "Early Bird",
      description: null,
      price: randomBetween(1500, 2500),
      currency: "EUR",
      totalQuantity: earlyTotal,
      soldQuantity: earlySold,
      status: earlySold >= earlyTotal ? TicketTypeStatus.SOLD_OUT : TicketTypeStatus.ON_SALE,
      startsAt: saleStart,
      endsAt: saleEnd,
    });
    ticketTypes.push({
      name: "Entrada geral",
      description: null,
      price: randomBetween(2500, 4500),
      currency: "EUR",
      totalQuantity: regularTotal,
      soldQuantity: regularSold,
      status: regularSold >= regularTotal ? TicketTypeStatus.SOLD_OUT : TicketTypeStatus.ON_SALE,
      startsAt: saleStart,
      endsAt: saleEnd,
    });
    return ticketTypes;
  }

  const sold = Math.min(totalQuantity, randomBetween(0, Math.floor(totalQuantity * 0.8)));
  ticketTypes.push({
    name: "Entrada geral",
    description: null,
    price: randomBetween(2000, 6000),
    currency: "EUR",
    totalQuantity,
    soldQuantity: sold,
    status: sold >= totalQuantity ? TicketTypeStatus.SOLD_OUT : TicketTypeStatus.ON_SALE,
    startsAt: saleStart,
    endsAt: saleEnd,
  });
  return ticketTypes;
};

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
    await prisma.inviteToken.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.eventInvite.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.eventAccessPolicy.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.padelEventCategoryLink.deleteMany({ where: { eventId: { in: eventIds } } });
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
  const profileIds = profiles.map((profile) => profile.id);

  if (profileIds.length > 0) {
    await prisma.follows.deleteMany({
      where: {
        OR: [{ follower_id: { in: profileIds } }, { following_id: { in: profileIds } }],
      },
    });
    await prisma.organization_follows.deleteMany({
      where: {
        OR: [{ follower_id: { in: profileIds } }, { organization_id: { in: orgIds } }],
      },
    });
  }

  if (profiles.length > 0) {
    await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });
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
    console.log(`[seed-mobile-v2] Clearing previous seed data for prefix ${seedPrefix}...`);
    await clearSeedData();
  }

  await ensureAddresses();

  const allAddresses = addressIds.length
    ? await prisma.address.findMany({
        where: { id: { in: addressIds } },
        select: { id: true, formattedAddress: true },
      })
    : await prisma.address.findMany({
        select: { id: true, formattedAddress: true },
        orderBy: { createdAt: "desc" },
      });

  if (allAddresses.length === 0) {
    throw new Error("Nenhum address encontrado. Usa SEED_ADDRESS_IDS ou corre seed_addresses.js.");
  }

  const portoAddresses = seedPortoAddressIds.length
    ? await prisma.address.findMany({
        where: { id: { in: seedPortoAddressIds } },
        select: { id: true, formattedAddress: true },
      })
    : allAddresses.filter((address) => /porto/i.test(address.formattedAddress));

  const nonPortoAddresses = allAddresses.filter((address) => !/porto/i.test(address.formattedAddress));

  const pickAddressId = (preferPorto: boolean) => {
    if (preferPorto && portoAddresses.length > 0) {
      return pick(portoAddresses, randomBetween(0, portoAddresses.length - 1)).id;
    }
    if (nonPortoAddresses.length > 0) {
      return pick(nonPortoAddresses, randomBetween(0, nonPortoAddresses.length - 1)).id;
    }
    if (portoAddresses.length > 0) {
      return pick(portoAddresses, randomBetween(0, portoAddresses.length - 1)).id;
    }
    return pick(allAddresses, randomBetween(0, allAddresses.length - 1)).id;
  };

  const users: Array<{ id: string; username: string; fullName: string; email: string }> = [];

  for (let i = 0; i < seedUsers; i += 1) {
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i + 3);
    const fullName = `${first} ${last}`;
    const username = `${seedPrefix}-user-${i + 1}`;
    const email = `${seedPrefix}.${i + 1}@orya.pt`;
    const user = await resolveAuthUser(email);

    const existing = await prisma.profile.findUnique({ where: { id: user.id } });
    if (existing && existing.username && !existing.username.startsWith(seedPrefix)) {
      console.warn(`[seed-mobile-v2] Skip profile update for ${existing.username}`);
      users.push({
        id: user.id,
        username: existing.username,
        fullName: existing.fullName ?? fullName,
        email,
      });
      continue;
    }

    const hasPadelProfile = seedRich && i % 3 === 0;
    const interests = buildInterestSet(hasPadelProfile);
    const visibility = resolveProfileVisibility(i);
    const padelLevel = hasPadelProfile ? pick(PADEL_LEVELS, i) : null;
    const padelPreferredSide = hasPadelProfile
      ? pick([PadelPreferredSide.ESQUERDA, PadelPreferredSide.DIREITA, PadelPreferredSide.QUALQUER], i)
      : null;
    const padelClubName = hasPadelProfile ? pick(PADEL_CLUBS, i) : null;
    const profile = await prisma.profile.upsert({
      where: { id: user.id },
      update: {
        env: seedEnv,
        username,
        fullName,
        bio: pick(BIOS, i),
        avatarUrl: pick(AVATARS, i),
        coverUrl: pick(COVERS, i),
        favouriteCategories: interests,
        padelLevel,
        padelPreferredSide,
        padelClubName,
        onboardingDone: true,
        roles: ["user"],
        status: "ACTIVE",
        visibility,
        isDeleted: false,
      },
      create: {
        env: seedEnv,
        username,
        fullName,
        bio: pick(BIOS, i),
        avatarUrl: pick(AVATARS, i),
        coverUrl: pick(COVERS, i),
        favouriteCategories: interests,
        padelLevel,
        padelPreferredSide,
        padelClubName,
        onboardingDone: true,
        roles: ["user"],
        status: "ACTIVE",
        visibility,
        isDeleted: false,
        users: { connect: { id: user.id } },
      },
    });

    users.push({
      id: profile.id,
      username: profile.username ?? username,
      fullName: profile.fullName ?? fullName,
      email,
    });
  }

  const organizations: Array<{ id: number; username: string }> = [];

  for (let i = 0; i < seedOrgs; i += 1) {
    const name = pick(ORG_NAMES, i);
    const username = `${seedPrefix}-org-${i + 1}`;
    const description = pick(ORG_DESCRIPTIONS, i);
    const avatar = pick(AVATARS, i + 1);
    const cover = pick(COVERS, i + 2);

    const existing = await prisma.organization.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true },
    });

    const orgAddressId = pickAddressId(i % 3 === 0 && portoAddresses.length > 0);

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
          addressId: orgAddressId,
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
          addressId: orgAddressId,
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
  const portoTarget = Math.min(seedEvents, Math.max(2, Math.round(seedEvents * seedPortoRatio)));
  const portoIndices = new Set(shuffle([...Array(seedEvents).keys()]).slice(0, portoTarget));

  const createdEvents: Array<{
    id: number;
    templateType: EventTemplateType | null;
    startsAt: Date;
    endsAt: Date;
    addressId: string | null;
    timeKey: string;
  }> = [];

  const inviteTokensCreated: Array<{ eventSlug: string; email: string; token: string; expiresAt: Date }> = [];

  for (let i = 0; i < seedEvents; i += 1) {
    const org = organizations[i % organizations.length];
    const owner = users[(i + 2) % users.length];
    const theme = pick(EVENT_THEMES, i);
    const { start, end, key } = resolveTimeWindow(i, now);
    const status = resolveEventStatus(i, key);
    const accessMode = resolveAccessMode(i);
    const isPorto = portoIndices.has(i);
    const addressId = pickAddressId(isPorto);
    const isFree = theme.templateType !== EventTemplateType.PADEL && i % 5 === 0;
    const ticketTypes = buildTicketTypes(i, isFree, start);
    const ticketPrices = ticketTypes.map((ticket) => ticket.price);
    const hasZero = ticketPrices.some((price) => price === 0);
    const hasPaid = ticketPrices.some((price) => price > 0);
    const pricingMode = hasZero && !hasPaid ? EventPricingMode.FREE_ONLY : EventPricingMode.STANDARD;

    const titleSuffix = `${i + 1}`;
    const title = `${theme.title} #${titleSuffix}`;
    const slug = `${seedPrefix}-${slugify(theme.title)}-${i + 1}`;

    const event = await prisma.event.create({
      data: {
        env: seedEnv,
        slug,
        title,
        description: theme.description,
        templateType: theme.templateType,
        status,
        organizationId: org.id,
        ownerUserId: owner?.id ?? users[0].id,
        startsAt: start,
        endsAt: end,
        addressId,
        coverImageUrl: theme.cover,
        pricingMode,
        interestTags: theme.interest ? [theme.interest] : [],
        ticketTypes: { create: ticketTypes },
      },
    });

    if (seedRich) {
      const requiresEntitlement = theme.templateType === EventTemplateType.PADEL;
      const inviteTokenAllowed = accessMode === EventAccessMode.INVITE_ONLY;
      await prisma.eventAccessPolicy.create({
        data: {
          env: seedEnv,
          eventId: event.id,
          policyVersion: 1,
          mode: accessMode,
          guestCheckoutAllowed: accessMode === EventAccessMode.PUBLIC && i % 7 === 0,
          inviteTokenAllowed,
          inviteIdentityMatch: InviteIdentityMatch.BOTH,
          inviteTokenTtlSeconds: inviteTokenAllowed ? 7 * 24 * 60 * 60 : null,
          requiresEntitlementForEntry: requiresEntitlement,
          checkinMethods: resolveCheckinMethods(theme.templateType),
          scannerRequired: false,
          allowReentry: false,
          reentryWindowMinutes: 15,
          maxEntries: 1,
          undoWindowMinutes: 10,
        },
      });
    }

    if (theme.templateType === EventTemplateType.PADEL && theme.padel) {
      const categoryLabels = ["M3", "M4"];
      const padelCategories = await Promise.all(
        categoryLabels.map(async (label, idx) => {
          const existing = await prisma.padelCategory.findFirst({
            where: { organizationId: org.id, label },
          });
          if (existing) return existing;
          return prisma.padelCategory.create({
            data: {
              env: seedEnv,
              organizationId: org.id,
              label,
              minLevel: label,
              maxLevel: label,
              isDefault: idx === 0,
            },
          });
        }),
      );

      const links = await Promise.all(
        padelCategories.map((category) =>
          prisma.padelEventCategoryLink.create({
            data: {
              env: seedEnv,
              eventId: event.id,
              padelCategoryId: category.id,
              format: padel_format.GRUPOS_ELIMINATORIAS,
              capacityTeams: randomBetween(6, 16),
              pricePerPlayerCents: 0,
              currency: "EUR",
              isEnabled: true,
              isHidden: false,
            },
          }),
        ),
      );

      const createdTickets = await prisma.ticketType.findMany({
        where: { eventId: event.id },
        orderBy: { id: "asc" },
        take: links.length,
      });
      for (let t = 0; t < createdTickets.length; t += 1) {
        const link = links[t];
        if (!link) continue;
        await prisma.ticketType.update({
          where: { id: createdTickets[t].id },
          data: { padelEventCategoryLinkId: link.id },
        });
      }

      await prisma.padelTournamentConfig.create({
        data: {
          env: seedEnv,
          eventId: event.id,
          organizationId: org.id,
          format: padel_format.GRUPOS_ELIMINATORIAS,
          numberOfCourts: randomBetween(1, 3),
          defaultCategoryId: links[0]?.padelCategoryId ?? null,
          padelV2Enabled: true,
        },
      });
    }

    if (seedRich && accessMode === EventAccessMode.INVITE_ONLY) {
      const inviteUser = users[(i + 1) % users.length];
      if (inviteUser) {
        const emailNormalized = inviteUser.email.trim().toLowerCase();
        await prisma.eventInvite.create({
          data: {
            env: seedEnv,
            eventId: event.id,
            invitedByUserId: event.ownerUserId,
            targetIdentifier: emailNormalized,
            targetUserId: inviteUser.id,
            scope: "PUBLIC",
          },
        });
        const token = crypto.randomUUID();
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const firstTicket = await prisma.ticketType.findFirst({ where: { eventId: event.id } });
        await prisma.inviteToken.create({
          data: {
            env: seedEnv,
            tokenHash,
            eventId: event.id,
            ticketTypeId: firstTicket?.id ?? null,
            emailNormalized,
            expiresAt,
          },
        });
        inviteTokensCreated.push({ eventSlug: event.slug, email: inviteUser.email, token, expiresAt });
      }
    }

    if (seedRich && i % 10 === 0) {
      await prisma.tournament.create({
        data: {
          env: seedEnv,
          eventId: event.id,
          format: TournamentFormat.GROUPS_PLUS_PLAYOFF,
          generatedAt: null,
        },
      });
    }

    createdEvents.push({
      id: event.id,
      templateType: theme.templateType,
      startsAt: start,
      endsAt: end,
      addressId,
      timeKey: key,
    });
  }

  const seededUsers = users.filter((user) => user.username.startsWith(seedPrefix));
  const followPairs: Array<{ env: string; follower_id: string; following_id: string }> = [];
  const followSet = new Set<string>();

  for (const follower of seededUsers) {
    const others = seededUsers.filter((user) => user.id !== follower.id);
    const followCount = Math.min(others.length, randomBetween(followsMin, followsMax));
    const targets = shuffle(others).slice(0, followCount);
    for (const target of targets) {
      const key = `${follower.id}:${target.id}`;
      if (followSet.has(key)) continue;
      followSet.add(key);
      followPairs.push({ env: seedEnv, follower_id: follower.id, following_id: target.id });
    }
  }

  if (followPairs.length > 0) {
    await prisma.follows.createMany({ data: followPairs, skipDuplicates: true });
  }

  const orgFollowPairs: Array<{ env: string; follower_id: string; organization_id: number }> = [];
  for (const follower of seededUsers) {
    const count = Math.min(organizations.length, randomBetween(0, orgFollowsMax));
    const picks = shuffle(organizations).slice(0, count);
    for (const org of picks) {
      orgFollowPairs.push({ env: seedEnv, follower_id: follower.id, organization_id: org.id });
    }
  }

  if (orgFollowPairs.length > 0) {
    await prisma.organization_follows.createMany({ data: orgFollowPairs, skipDuplicates: true });
  }

  const portoCount = createdEvents.filter((event) => {
    if (!event.addressId) return false;
    const address = allAddresses.find((item) => item.id === event.addressId);
    return address ? /porto/i.test(address.formattedAddress) : false;
  }).length;

  const categoryCounts = createdEvents.reduce<Record<string, number>>((acc, event) => {
    const key = event.templateType ?? "OTHER";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const timeBuckets = createdEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.timeKey] = (acc[event.timeKey] ?? 0) + 1;
    return acc;
  }, {});

  const nowMs = Date.now();
  const liveCount = createdEvents.filter((event) => event.startsAt.getTime() <= nowMs && event.endsAt.getTime() >= nowMs)
    .length;
  const soonCount = createdEvents.filter((event) => {
    const diffMinutes = (event.startsAt.getTime() - nowMs) / (1000 * 60);
    return diffMinutes > 0 && diffMinutes <= 90;
  }).length;
  const within72Count = createdEvents.filter((event) => {
    const diffHours = (event.startsAt.getTime() - nowMs) / (1000 * 60 * 60);
    return diffHours >= 24 && diffHours <= 72;
  }).length;

  if (portoCount < Math.max(2, Math.floor(seedEvents * seedPortoRatio * 0.7))) {
    throw new Error("Seed incompleto: poucos eventos em Porto.");
  }
  if (seedEvents >= 12 && liveCount < 1) {
    throw new Error("Seed incompleto: nenhum evento live.");
  }
  if (seedEvents >= 12 && soonCount < 1) {
    throw new Error("Seed incompleto: nenhum evento a começar em breve.");
  }
  if (seedEvents >= 18 && within72Count < 2) {
    throw new Error("Seed incompleto: poucos eventos entre 24-72h.");
  }

  console.log(`[seed-mobile-v2] Seed completo.`);
  console.log(`[seed-mobile-v2] Users: ${users.length} (seeded=${seededUsers.length})`);
  console.log(`[seed-mobile-v2] Orgs: ${organizations.length}`);
  console.log(`[seed-mobile-v2] Events: ${createdEvents.length}`);
  console.log(`[seed-mobile-v2] Porto events: ${portoCount}`);
  console.log(`[seed-mobile-v2] Category counts:`, categoryCounts);
  console.log(`[seed-mobile-v2] Time buckets:`, timeBuckets);
  console.log(`[seed-mobile-v2] Live/soon/24-72h:`, { liveCount, soonCount, within72Count });
  console.log(`[seed-mobile-v2] Follows: ${followPairs.length}, Org follows: ${orgFollowPairs.length}`);
  if (inviteTokensCreated.length > 0) {
    console.log(`[seed-mobile-v2] Invite tokens (sample):`);
    inviteTokensCreated.slice(0, 5).forEach((token) => {
      console.log(
        `  /eventos/${token.eventSlug}?inviteToken=${token.token} (${token.email}) expira ${token.expiresAt.toISOString()}`,
      );
    });
  }
}

main()
  .catch((err) => {
    console.error("[seed-mobile-v2] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
