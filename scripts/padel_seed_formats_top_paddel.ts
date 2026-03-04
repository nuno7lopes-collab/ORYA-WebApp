/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import crypto from "crypto";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  Gender,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPreferredSide,
  PadelRegistrationStatus,
  padel_format,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PADEL_FORMAT_CATALOG } from "@/domain/padel/formatCatalog";

type CliOptions = {
  orgUsername: string;
  runTag: string;
  priceMin: number;
  priceMax: number;
  targetMaxTeams: number;
  dryRun: boolean;
  resetExisting: boolean;
  baseUrl: string;
};

type ApiResult<T = Record<string, unknown>> = {
  raw: Record<string, unknown>;
  payload: T;
};

type SeedUser = {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
  gender: Gender | null;
  padelLevel: string | null;
  padelPreferredSide: PadelPreferredSide | null;
  onboardingDone: boolean;
};

type SeedCategory = {
  id: number;
  label: string;
  genderRestriction: string | null;
  minLevel: string | null;
  maxLevel: string | null;
};

type TournamentSeedSummary = {
  format: padel_format;
  title: string;
  eventId: number | null;
  created: boolean;
  categories: Array<{ categoryId: number; label: string; linkId: number | null; pricePerPlayerCents: number | null }>;
  teamsPerCategory: number;
  pairsPlanned: number;
  pairsCreated: number;
  paymentsConfirmed: number;
  finalizedPairs: number;
  errors: string[];
};

type SeedReport = {
  runTag: string;
  organization: { id: number; username: string | null; name: string | null };
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  options: Omit<CliOptions, "orgUsername" | "runTag">;
  totals: {
    tournamentsTarget: number;
    tournamentsProcessed: number;
    pairsPlanned: number;
    pairsCreated: number;
    paymentsConfirmed: number;
    finalizedPairs: number;
    errors: number;
  };
  tournaments: TournamentSeedSummary[];
};

type SupabaseClients = {
  service: SupabaseClient;
  anon: SupabaseClient;
};

const DEFAULT_BASE_URL = "http://localhost:3000";

const pickNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnvForScript() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./load-env.js");
  } catch {
    // no-op
  }
}

function decodeJwtSub(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const decoded = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function parsePositiveInt(raw: string | null | undefined, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parsePrice(raw: string | null | undefined, fallback: number) {
  if (!raw) return fallback;
  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function parseSeedArgs(argv: string[]): CliOptions {
  const flags = new Map<string, string | boolean>();
  for (let idx = 0; idx < argv.length; idx += 1) {
    const key = argv[idx];
    if (!key || !key.startsWith("--")) continue;
    const value = argv[idx + 1];
    if (!value || value.startsWith("--")) {
      flags.set(key, true);
      continue;
    }
    flags.set(key, value);
    idx += 1;
  }

  const orgUsername = String(flags.get("--org-username") || "top_padel").trim();
  const runTag = String(flags.get("--run-tag") || "").trim();
  if (!runTag) {
    throw new Error("Missing --run-tag");
  }

  const priceMin = parsePrice(flags.get("--price-min") as string | undefined, 10);
  const priceMax = parsePrice(flags.get("--price-max") as string | undefined, 20);
  if (priceMin > priceMax) {
    throw new Error("--price-min cannot be greater than --price-max");
  }

  const baseUrl =
    pickNonEmpty(
      flags.get("--base-url") as string | undefined,
      process.env.APP_BASE_URL,
      process.env.NEXT_PUBLIC_BASE_URL,
      DEFAULT_BASE_URL,
    ) || DEFAULT_BASE_URL;

  return {
    orgUsername,
    runTag,
    priceMin,
    priceMax,
    targetMaxTeams: parsePositiveInt(flags.get("--target-max-teams") as string | undefined, 20),
    dryRun: flags.has("--dry-run"),
    resetExisting: flags.has("--reset-existing"),
    baseUrl: baseUrl.replace(/\/+$/, ""),
  };
}

export function pickTournamentPriceCents(params: {
  runTag: string;
  format: padel_format;
  minEuros: number;
  maxEuros: number;
}) {
  const minCents = Math.round(params.minEuros * 100);
  const maxCents = Math.round(params.maxEuros * 100);
  if (minCents >= maxCents) return minCents;
  const hash = crypto.createHash("sha256").update(`${params.runTag}:${params.format}`).digest("hex");
  const bucket = Number.parseInt(hash.slice(0, 8), 16) % (maxCents - minCents + 1);
  return minCents + bucket;
}

function unwrapPayload(raw: Record<string, unknown>) {
  const payload = (raw.result ?? raw.data ?? raw) as Record<string, unknown>;
  const rawOk = raw.ok;
  const payloadOk = payload?.ok;
  const isOk = rawOk !== false && payloadOk !== false;
  return { payload, isOk };
}

async function postJson<T = Record<string, unknown>>(params: {
  baseUrl: string;
  path: string;
  bearer?: string | null;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(params.headers ?? {}),
  };
  if (params.bearer) headers.Authorization = `Bearer ${params.bearer}`;

  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params.body),
  });
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const { payload, isOk } = unwrapPayload(raw);
  if (!response.ok || !isOk) {
    const code = String(payload.errorCode ?? raw.errorCode ?? payload.error ?? raw.error ?? "REQUEST_FAILED");
    const message = String(payload.message ?? raw.message ?? code);
    throw new Error(`${params.path} -> ${response.status} ${code}: ${message}`);
  }
  return { raw, payload: payload as T };
}

async function getSupabaseClients(baseUrl: string): Promise<SupabaseClients> {
  const supabaseUrl = pickNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = pickNonEmpty(process.env.SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRole = pickNonEmpty(process.env.SUPABASE_SERVICE_ROLE);
  if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
    throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE are required");
  }
  const service = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await anon.auth.signOut().catch(() => {});
  await service.auth.signOut().catch(() => {});
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("Invalid base URL");
  }
  return { service, anon };
}

async function mintTokenForEmail(params: {
  email: string;
  baseUrl: string;
  clients: SupabaseClients;
}): Promise<string> {
  const redirectTo = `${params.baseUrl}/auth/callback`;
  const generated = await params.clients.service.auth.admin.generateLink({
    type: "magiclink",
    email: params.email,
    options: { redirectTo },
  });
  if (generated.error) {
    throw new Error(`generateLink failed for ${params.email}: ${generated.error.message}`);
  }

  const payload = generated.data as any;
  const properties = payload?.properties ?? {};
  const emailOtp = typeof properties.email_otp === "string" ? properties.email_otp : null;
  const directTokenHash =
    typeof properties.hashed_token === "string"
      ? properties.hashed_token
      : typeof properties.token_hash === "string"
        ? properties.token_hash
        : null;
  const actionLink =
    typeof properties.action_link === "string"
      ? properties.action_link
      : typeof payload?.action_link === "string"
        ? payload.action_link
        : null;
  const parsedLink =
    actionLink && actionLink.startsWith("http")
      ? new URL(actionLink)
      : null;
  const linkTokenHash = parsedLink?.searchParams.get("token_hash");
  const linkType = parsedLink?.searchParams.get("type");

  const attempts: Array<Promise<any>> = [];
  if (emailOtp) {
    attempts.push(
      params.clients.anon.auth.verifyOtp({ email: params.email, token: emailOtp, type: "email" } as any),
      params.clients.anon.auth.verifyOtp({ email: params.email, token: emailOtp, type: "magiclink" } as any),
    );
  }
  if (directTokenHash) {
    attempts.push(
      params.clients.anon.auth.verifyOtp({
        email: params.email,
        token_hash: directTokenHash,
        type: "magiclink",
      } as any),
    );
  }
  if (linkTokenHash) {
    attempts.push(
      params.clients.anon.auth.verifyOtp({
        email: params.email,
        token_hash: linkTokenHash,
        type: linkType || "magiclink",
      } as any),
    );
  }

  for (const attempt of attempts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await attempt.catch(() => null);
    const token = result?.data?.session?.access_token;
    if (typeof token === "string" && token.length > 20) return token;
  }

  throw new Error(`verifyOtp failed for ${params.email}`);
}

async function ensureOperationQueueSettled(params: {
  baseUrl: string;
  internalSecret: string | null;
  paymentIntentId: string;
}) {
  if (!params.internalSecret) return;
  await postJson({
    baseUrl: params.baseUrl,
    path: "/api/internal/reprocess/payment-intent",
    body: { paymentIntentId: params.paymentIntentId },
    headers: { "X-ORYA-CRON-SECRET": params.internalSecret },
  }).catch(() => null);
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await postJson({
      baseUrl: params.baseUrl,
      path: "/api/internal/worker/operations",
      body: { operationType: "FULFILL_PAYMENT", batchSize: 50 },
      headers: { "X-ORYA-CRON-SECRET": params.internalSecret },
    }).catch(() => null);
    // eslint-disable-next-line no-await-in-loop
    await sleep(900);
  }
}

async function waitForPairingFinalized(pairingId: number, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    // eslint-disable-next-line no-await-in-loop
    const pairing = await prisma.padelPairing.findUnique({
      where: { id: pairingId },
      select: {
        id: true,
        player1UserId: true,
        player2UserId: true,
        registration: { select: { status: true } },
        slots: {
          select: { paymentStatus: true, slotStatus: true, profileId: true },
        },
      },
    });
    if (!pairing) return { ok: false as const, reason: "PAIRING_NOT_FOUND" };
    const allPaid = pairing.slots.every((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID);
    const allFilled = pairing.slots.every((slot) => slot.slotStatus === PadelPairingSlotStatus.FILLED && slot.profileId);
    const confirmed = pairing.registration?.status === PadelRegistrationStatus.CONFIRMED;
    if (allPaid && allFilled && confirmed && pairing.player1UserId && pairing.player2UserId) {
      return { ok: true as const };
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(2500);
  }
  return { ok: false as const, reason: "PAIRING_FINALIZE_TIMEOUT" };
}

async function resolveTeamsPerCategory(params: {
  baseUrl: string;
  bearer: string;
  eventId: number;
  format: padel_format;
  categoryIds: number[];
  targetMaxTeams: number;
}) {
  const categoryCount = Math.max(1, params.categoryIds.length);
  const maxPerCategory = Math.max(1, Math.floor(params.targetMaxTeams / categoryCount));
  for (let teams = maxPerCategory; teams >= 1; teams -= 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const plan = await postJson<{ plan?: { feasible?: boolean } }>({
        baseUrl: params.baseUrl,
        path: "/api/padel/formats/plan",
        bearer: params.bearer,
        body: {
          eventId: params.eventId,
          format: params.format,
          categories: params.categoryIds.map((categoryId) => ({
            categoryId,
            teams,
            format: params.format,
          })),
        },
      });
      if (plan.payload?.plan?.feasible) return teams;
    } catch {
      // keep trying with less teams
    }
  }
  return 1;
}

function formatToLabel(format: padel_format) {
  return format.replace(/_/g, " ").toLowerCase();
}

function normalizeCategoryLevel(category: SeedCategory) {
  return (category.minLevel ?? category.maxLevel ?? "3").trim() || "3";
}

function buildPairs(users: SeedUser[]): Array<[SeedUser, SeedUser]> {
  const pairs: Array<[SeedUser, SeedUser]> = [];
  for (let idx = 0; idx + 1 < users.length; idx += 2) {
    pairs.push([users[idx]!, users[idx + 1]!]);
  }
  return pairs;
}

function pickUsersByGender(params: {
  users: SeedUser[];
  requiredGender: Gender;
  count: number;
  usedIds: Set<string>;
}) {
  const picked: SeedUser[] = [];
  const matching = params.users.filter((user) => user.gender === params.requiredGender);
  const unknown = params.users.filter((user) => user.gender == null);
  for (const candidate of [...matching, ...unknown]) {
    if (params.usedIds.has(candidate.id)) continue;
    picked.push(candidate);
    params.usedIds.add(candidate.id);
    if (picked.length >= params.count) break;
  }
  return picked;
}

async function main() {
  loadEnvForScript();
  const options = parseSeedArgs(process.argv.slice(2));
  const startedAt = new Date();
  let adminBearer = pickNonEmpty(process.env.E2E_ADMIN_BEARER, process.env.E2E_USER_BEARER);
  const internalSecret = pickNonEmpty(process.env.ORYA_CRON_SECRET);
  const stripeSecret = pickNonEmpty(process.env.STRIPE_SECRET_KEY_TEST, process.env.STRIPE_SECRET_KEY);
  if (!options.dryRun && !stripeSecret) {
    throw new Error("Missing STRIPE_SECRET_KEY_TEST/STRIPE_SECRET_KEY");
  }

  const organization = await prisma.organization.findFirst({
    where: { username: options.orgUsername },
    select: { id: true, groupId: true, username: true, publicName: true },
  });
  if (!organization) {
    throw new Error(`Organization not found for username=${options.orgUsername}`);
  }

  const supabaseClients = await getSupabaseClients(options.baseUrl);
  if (!adminBearer) {
    const owner = await prisma.organizationGroup.findUnique({
      where: { id: organization.groupId },
      select: {
        owner: {
          select: {
            users: {
              select: { email: true },
            },
          },
        },
      },
    });
    const ownerEmail = owner?.owner?.users?.email?.trim().toLowerCase() ?? null;
    if (!ownerEmail) {
      throw new Error(
        "Missing E2E_ADMIN_BEARER (or E2E_USER_BEARER) and could not resolve organization owner email",
      );
    }
    adminBearer = await mintTokenForEmail({
      email: ownerEmail,
      baseUrl: options.baseUrl,
      clients: supabaseClients,
    });
  }
  if (!adminBearer) {
    throw new Error("Could not resolve admin bearer");
  }
  const adminBearerToken = adminBearer;

  const club = await prisma.padelClub.findFirst({
    where: { organizationId: organization.id, isActive: true, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    select: { id: true, name: true, addressId: true },
  });
  if (!club?.addressId) {
    throw new Error("No active club/address found for target organization");
  }

  const categoriesRaw = await prisma.padelCategory.findMany({
    where: { organizationId: organization.id, isActive: true },
    select: {
      id: true,
      label: true,
      isDefault: true,
      genderRestriction: true,
      minLevel: true,
      maxLevel: true,
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });
  if (categoriesRaw.length < 2) {
    throw new Error("At least 2 active padel categories are required");
  }
  const categories: SeedCategory[] = categoriesRaw.map((entry) => ({
    id: entry.id,
    label: entry.label,
    genderRestriction: entry.genderRestriction ?? null,
    minLevel: entry.minLevel ?? null,
    maxLevel: entry.maxLevel ?? null,
  }));
  const maleCategories = categories.filter((entry) => entry.genderRestriction === "MALE");
  const femaleCategories = categories.filter((entry) => entry.genderRestriction === "FEMALE");
  if (maleCategories.length === 0 || femaleCategories.length === 0) {
    throw new Error("Need at least one MALE and one FEMALE category for deterministic seed");
  }

  if (options.resetExisting && !options.dryRun) {
    const existingEvents = await prisma.event.findMany({
      where: {
        organizationId: organization.id,
        templateType: "PADEL",
        isDeleted: false,
        title: { contains: `[seed:${options.runTag}]` },
      },
      select: { id: true },
    });
    if (existingEvents.length > 0) {
      const eventIds = existingEvents.map((event) => event.id);
      await prisma.event.updateMany({
        where: { id: { in: eventIds } },
        data: { isDeleted: true, deletedAt: new Date(), status: "CANCELLED" },
      });
      await prisma.padelTournamentConfig.updateMany({
        where: { eventId: { in: eventIds } },
        data: { lifecycleStatus: "CANCELLED", cancelledAt: new Date(), lifecycleUpdatedAt: new Date() },
      });
    }
  }

  const adminUserId = decodeJwtSub(adminBearerToken);
  const usersRaw = await prisma.profile.findMany({
    where: {
      isDeleted: false,
      users: {
        is: {
          email: {
            not: null,
          },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      gender: true,
      padelLevel: true,
      padelPreferredSide: true,
      onboardingDone: true,
      users: { select: { email: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 1200,
  });
  const userPool: SeedUser[] = usersRaw
    .map((profile) => ({
      id: profile.id,
      email: profile.users?.email?.trim().toLowerCase() ?? "",
      fullName: profile.fullName ?? null,
      username: profile.username ?? null,
      gender: profile.gender ?? null,
      padelLevel: profile.padelLevel ?? null,
      padelPreferredSide: profile.padelPreferredSide ?? null,
      onboardingDone: Boolean(profile.onboardingDone),
    }))
    .filter((profile) => profile.email.length > 0 && profile.id !== adminUserId);
  if (userPool.length < 8) {
    throw new Error("User pool too small. Need at least 8 users with auth email.");
  }

  const usedIds = new Set<string>();
  const maleSeedUsers = pickUsersByGender({
    users: userPool,
    requiredGender: Gender.MALE,
    count: 4,
    usedIds,
  });
  const femaleSeedUsers = pickUsersByGender({
    users: userPool,
    requiredGender: Gender.FEMALE,
    count: 4,
    usedIds,
  });
  if (maleSeedUsers.length < 4 || femaleSeedUsers.length < 4) {
    throw new Error("Unable to allocate enough male/female users for seed pairs");
  }
  const malePairs = buildPairs(maleSeedUsers);
  const femalePairs = buildPairs(femaleSeedUsers);
  const maxPairsPerCategory = Math.max(1, Math.min(malePairs.length, femalePairs.length));

  const ensureProfileReady = async (user: SeedUser, requiredGender: Gender, requiredLevel: string) => {
    const updates: Record<string, unknown> = {};
    if (!user.fullName?.trim()) {
      updates.fullName = `Seed ${requiredGender} ${user.id.slice(0, 8)}`;
    }
    if (!user.username?.trim()) {
      updates.username = `seed_${options.runTag}_${user.id.replace(/-/g, "").slice(0, 12)}`.toLowerCase();
    }
    if (user.gender !== requiredGender) {
      updates.gender = requiredGender;
    }
    if (!user.padelLevel?.trim()) {
      updates.padelLevel = requiredLevel;
    }
    if (!user.padelPreferredSide) {
      updates.padelPreferredSide = PadelPreferredSide.QUALQUER;
    }
    if (!user.onboardingDone) {
      updates.onboardingDone = true;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.profile.update({
        where: { id: user.id },
        data: updates,
      });
      user.fullName = (updates.fullName as string | undefined) ?? user.fullName;
      user.username = (updates.username as string | undefined) ?? user.username;
      user.gender = (updates.gender as Gender | undefined) ?? user.gender;
      user.padelLevel = (updates.padelLevel as string | undefined) ?? user.padelLevel;
      user.padelPreferredSide =
        (updates.padelPreferredSide as PadelPreferredSide | undefined) ?? user.padelPreferredSide;
      user.onboardingDone = (updates.onboardingDone as boolean | undefined) ?? user.onboardingDone;
    }
  };

  const tokenCache = new Map<string, string>();
  const ensureToken = async (user: SeedUser) => {
    const cached = tokenCache.get(user.id);
    if (cached) return cached;
    const token = await mintTokenForEmail({
      email: user.email,
      baseUrl: options.baseUrl,
      clients: supabaseClients,
    });
    tokenCache.set(user.id, token);
    return token;
  };

  const stripe = !options.dryRun ? new Stripe(stripeSecret!, { maxNetworkRetries: 2 }) : null;
  const report: SeedReport = {
    runTag: options.runTag,
    organization: {
      id: organization.id,
      username: organization.username ?? null,
      name: organization.publicName ?? null,
    },
    dryRun: options.dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
    options: {
      priceMin: options.priceMin,
      priceMax: options.priceMax,
      targetMaxTeams: options.targetMaxTeams,
      dryRun: options.dryRun,
      resetExisting: options.resetExisting,
      baseUrl: options.baseUrl,
    },
    totals: {
      tournamentsTarget: PADEL_FORMAT_CATALOG.length,
      tournamentsProcessed: 0,
      pairsPlanned: 0,
      pairsCreated: 0,
      paymentsConfirmed: 0,
      finalizedPairs: 0,
      errors: 0,
    },
    tournaments: [],
  };

  for (let formatIdx = 0; formatIdx < PADEL_FORMAT_CATALOG.length; formatIdx += 1) {
    const format = PADEL_FORMAT_CATALOG[formatIdx]!;
    const title = `[seed:${options.runTag}] top_padel ${formatToLabel(format)}`;
    const summary: TournamentSeedSummary = {
      format,
      title,
      eventId: null,
      created: false,
      categories: [],
      teamsPerCategory: 0,
      pairsPlanned: 0,
      pairsCreated: 0,
      paymentsConfirmed: 0,
      finalizedPairs: 0,
      errors: [],
    };
    report.tournaments.push(summary);

    try {
      const maleCategory = maleCategories[formatIdx % maleCategories.length]!;
      const femaleCategory = femaleCategories[formatIdx % femaleCategories.length]!;
      const selectedCategories: SeedCategory[] = [maleCategory, femaleCategory];
      const categoryIds = selectedCategories.map((entry) => entry.id);
      const categoryById = new Map<number, SeedCategory>(selectedCategories.map((entry) => [entry.id, entry]));

      const pricePerPlayerCents = pickTournamentPriceCents({
        runTag: options.runTag,
        format,
        minEuros: options.priceMin,
        maxEuros: options.priceMax,
      });

      let eventId: number | null = null;
      const existing = await prisma.event.findFirst({
        where: {
          organizationId: organization.id,
          templateType: "PADEL",
          isDeleted: false,
          title,
        },
        select: { id: true },
      });
      if (existing) {
        eventId = existing.id;
      }

      if (!eventId && !options.dryRun) {
        const startsAt = new Date();
        startsAt.setDate(startsAt.getDate() + 7 + formatIdx);
        startsAt.setHours(9, 0, 0, 0);
        const endsAt = new Date(startsAt.getTime() + 10 * 60 * 60 * 1000);
        const registrationStartsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const registrationEndsAt = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000).toISOString();

        const created = await postJson<{ event?: { id?: number } }>({
          baseUrl: options.baseUrl,
          path: `/api/org/${organization.id}/tournaments/create`,
          bearer: adminBearerToken,
          body: {
            title,
            description: `Seed automático ${options.runTag} (${format})`,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            timezone: "Europe/Lisbon",
            addressId: club.addressId,
            templateType: "PADEL",
            padel: {
              clubId: club.id,
              format,
              eligibilityType: "OPEN",
              categoryIds,
              defaultCategoryId: categoryIds[0],
              categoryConfigs: categoryIds.map((categoryId) => ({
                padelCategoryId: categoryId,
                format,
                pricePerPlayer: pricePerPlayerCents / 100,
                currency: "EUR",
              })),
              advancedSettings: {
                registrationStartsAt,
                registrationEndsAt,
                competitionState: "DEVELOPMENT",
              },
            },
          },
        });
        eventId = Number(created.payload?.event?.id ?? 0) || null;
        if (!eventId) throw new Error("Tournament creation response missing event.id");
        summary.created = true;
      }
      summary.eventId = eventId;

      if (!eventId) {
        if (options.dryRun) continue;
        throw new Error("Missing eventId");
      }

      if (!options.dryRun) {
        await postJson({
          baseUrl: options.baseUrl,
          path: "/api/padel/tournaments/lifecycle",
          bearer: adminBearerToken,
          body: { eventId, nextStatus: "PUBLISHED" },
        });
      }

      const links = await prisma.padelEventCategoryLink.findMany({
        where: { eventId, padelCategoryId: { in: categoryIds }, isEnabled: true },
        select: {
          id: true,
          padelCategoryId: true,
          pricePerPlayerCents: true,
          category: { select: { label: true } },
        },
        orderBy: { id: "asc" },
      });
      if (links.length < 2) throw new Error("Event does not have 2 active category links");
      summary.categories = categoryIds.map((categoryId) => {
        const link = links.find((entry) => entry.padelCategoryId === categoryId);
        return {
          categoryId,
          label: link?.category?.label ?? String(categoryId),
          linkId: link?.id ?? null,
          pricePerPlayerCents: link?.pricePerPlayerCents ?? null,
        };
      });

      if (!options.dryRun) {
        await prisma.padelEventCategoryLink.updateMany({
          where: { eventId, padelCategoryId: { in: categoryIds } },
          data: { pricePerPlayerCents, currency: "EUR" },
        });

        const linkIds = links.map((entry) => entry.id);
        const ticketTypes = await prisma.ticketType.findMany({
          where: {
            eventId,
            padelEventCategoryLinkId: { in: linkIds },
          },
          select: { id: true, padelEventCategoryLinkId: true },
        });
        const existingByLink = new Map<number, number>();
        for (const ticketType of ticketTypes) {
          if (!ticketType.padelEventCategoryLinkId) continue;
          existingByLink.set(ticketType.padelEventCategoryLinkId, ticketType.id);
        }

        let sortCursor = 0;
        for (const link of links) {
          if (existingByLink.has(link.id)) continue;
          await prisma.ticketType.create({
            data: {
              eventId,
              padelEventCategoryLinkId: link.id,
              name: `Inscricao ${link.category?.label ?? link.padelCategoryId}`,
              price: pricePerPlayerCents,
              currency: "EUR",
              publicAccess: true,
              participantAccess: false,
              status: "ON_SALE",
              sortOrder: sortCursor,
            },
          });
          sortCursor += 1;
        }
      }

      const plannedTeamsPerCategory = await resolveTeamsPerCategory({
        baseUrl: options.baseUrl,
        bearer: adminBearerToken,
        eventId,
        format,
        categoryIds,
        targetMaxTeams: options.targetMaxTeams,
      });

      const teamsPerCategory = Math.max(1, Math.min(plannedTeamsPerCategory, maxPairsPerCategory));
      summary.teamsPerCategory = teamsPerCategory;
      summary.pairsPlanned = teamsPerCategory * categoryIds.length;
      report.totals.pairsPlanned += summary.pairsPlanned;

      for (const categoryId of categoryIds) {
        const categoryLink = links.find((entry) => entry.padelCategoryId === categoryId);
        const categoryMeta = categoryById.get(categoryId);
        if (!categoryLink?.id) {
          summary.errors.push(`CATEGORY_LINK_MISSING:${categoryId}`);
          continue;
        }
        if (!categoryMeta) {
          summary.errors.push(`CATEGORY_META_MISSING:${categoryId}`);
          continue;
        }
        const requiredGender =
          categoryMeta.genderRestriction === "FEMALE"
            ? Gender.FEMALE
            : categoryMeta.genderRestriction === "MALE"
              ? Gender.MALE
              : null;
        if (!requiredGender) {
          summary.errors.push(`CATEGORY_GENDER_UNSUPPORTED:${categoryId}:${categoryMeta.genderRestriction ?? "null"}`);
          continue;
        }
        const requiredLevel = normalizeCategoryLevel(categoryMeta);
        const pairPool = requiredGender === Gender.FEMALE ? femalePairs : malePairs;
        const teamsForCategory = Math.max(1, Math.min(teamsPerCategory, pairPool.length));
        if (teamsForCategory < teamsPerCategory) {
          summary.errors.push(`TEAMS_CAPPED_BY_POOL:${categoryId}:${teamsForCategory}`);
        }

        for (let teamIdx = 0; teamIdx < teamsForCategory; teamIdx += 1) {
          const pair = pairPool[teamIdx];
          if (!pair) {
            summary.errors.push(`USER_PAIR_MISSING:${categoryId}:${teamIdx}`);
            break;
          }
          const [captain, partner] = pair;

          if (options.dryRun) continue;

          await ensureProfileReady(captain, requiredGender, requiredLevel);
          await ensureProfileReady(partner, requiredGender, requiredLevel);

          const captainBearer = await ensureToken(captain);
          const partnerBearer = await ensureToken(partner);
          const pairingIdempotency = `seed:${options.runTag}:${eventId}:${categoryId}:${captain.id}:${partner.id}`;

          let pairingId: number | null = null;
          try {
            const pairingRes = await postJson<{ pairing?: { id?: number } }>({
              baseUrl: options.baseUrl,
              path: "/api/padel/pairings",
              bearer: captainBearer,
              body: {
                eventId,
                organizationId: organization.id,
                categoryId,
                paymentMode: "FULL",
                pairingJoinMode: "INVITE_PARTNER",
                targetUserId: partner.id,
              },
            });
            pairingId = Number(pairingRes.payload?.pairing?.id ?? 0) || null;
          } catch {
            const existingPairing = await prisma.padelPairing.findFirst({
              where: {
                eventId,
                categoryId,
                AND: [
                  {
                    OR: [
                      { createdByUserId: captain.id },
                      { player1UserId: captain.id },
                      { player2UserId: captain.id },
                      { slots: { some: { profileId: captain.id } } },
                    ],
                  },
                  {
                    OR: [
                      { player1UserId: partner.id },
                      { player2UserId: partner.id },
                      { slots: { some: { profileId: partner.id } } },
                      { slots: { some: { invitedUserId: partner.id } } },
                    ],
                  },
                ],
              },
              select: { id: true },
            });
            pairingId = existingPairing?.id ?? null;
          }
          if (!pairingId) {
            summary.errors.push(`PAIRING_CREATE_FAILED:${categoryId}:${captain.id}:${partner.id}`);
            continue;
          }
          summary.pairsCreated += 1;
          report.totals.pairsCreated += 1;

          const readPairingStatus = () =>
            prisma.padelPairing.findUnique({
              where: { id: pairingId },
              select: {
                slots: { select: { paymentStatus: true } },
                player2UserId: true,
                registration: { select: { status: true } },
              },
            });
          let pairingStatus = await readPairingStatus();
          const alreadyPaid = Boolean(
            pairingStatus &&
              pairingStatus.slots.length > 0 &&
              pairingStatus.slots.every((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID),
          );

          let paymentIntentId: string | null = null;
          if (!alreadyPaid) {
            try {
              const checkout = await postJson<{
                paymentIntentId?: string;
              }>({
                baseUrl: options.baseUrl,
                path: `/api/padel/pairings/${pairingId}/checkout`,
                bearer: captainBearer,
                body: {
                  padelCategoryLinkId: categoryLink.id,
                  idempotencyKey: pairingIdempotency,
                },
              });
              paymentIntentId = typeof checkout.payload.paymentIntentId === "string" ? checkout.payload.paymentIntentId : null;
              if (!paymentIntentId || !stripe) {
                throw new Error("Missing paymentIntentId");
              }
              await stripe.paymentIntents.confirm(paymentIntentId, { payment_method: "pm_card_visa" });
              summary.paymentsConfirmed += 1;
              report.totals.paymentsConfirmed += 1;
              await ensureOperationQueueSettled({
                baseUrl: options.baseUrl,
                internalSecret,
                paymentIntentId,
              });
            } catch (error) {
              summary.errors.push(`PAYMENT_FAILED:${pairingId}:${error instanceof Error ? error.message : String(error)}`);
              continue;
            }
          }

          pairingStatus = await readPairingStatus();
          if (!pairingStatus?.player2UserId) {
            let accepted = false;
            for (let attempt = 0; attempt < 5; attempt += 1) {
              // eslint-disable-next-line no-await-in-loop
              const acceptedNow = await postJson({
                baseUrl: options.baseUrl,
                path: `/api/padel/pairings/${pairingId}/accept`,
                bearer: partnerBearer,
                body: {},
              })
                .then(() => true)
                .catch(() => false);
              if (acceptedNow) {
                accepted = true;
              }
              if (paymentIntentId) {
                // eslint-disable-next-line no-await-in-loop
                await ensureOperationQueueSettled({
                  baseUrl: options.baseUrl,
                  internalSecret,
                  paymentIntentId,
                });
              }
              // eslint-disable-next-line no-await-in-loop
              pairingStatus = await readPairingStatus();
              if (pairingStatus?.player2UserId) {
                accepted = true;
                break;
              }
              if (!acceptedNow) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(1500);
              }
            }
            if (!accepted && !pairingStatus?.player2UserId) {
              summary.errors.push(`PAIRING_ACCEPT_FAILED:${pairingId}`);
            }
          }

          if (paymentIntentId) {
            await ensureOperationQueueSettled({
              baseUrl: options.baseUrl,
              internalSecret,
              paymentIntentId,
            });
          }

          const finalized = await waitForPairingFinalized(pairingId);
          if (finalized.ok) {
            summary.finalizedPairs += 1;
            report.totals.finalizedPairs += 1;
          } else {
            summary.errors.push(`PAIRING_NOT_FINALIZED:${pairingId}:${finalized.reason}`);
          }
        }
      }

      const prices = summary.categories
        .map((entry) => entry.pricePerPlayerCents)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      if (prices.length > 0) {
        const uniquePrices = Array.from(new Set(prices));
        if (uniquePrices.length > 1) {
          summary.errors.push("PRICE_NOT_UNIFORM_ACROSS_CATEGORIES");
        }
        const price = uniquePrices[0] ?? 0;
        if (price < Math.round(options.priceMin * 100) || price > Math.round(options.priceMax * 100)) {
          summary.errors.push("PRICE_OUT_OF_EXPECTED_RANGE");
        }
      }
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      report.totals.tournamentsProcessed += 1;
      report.totals.errors += summary.errors.length;
    }
  }

  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
  if (report.totals.errors > 0) {
    process.exitCode = 1;
  }
}

function shouldRunAsCli() {
  if (require.main === module) return true;
  const argv1 = process.argv[1] ?? "";
  const argv2 = process.argv[2] ?? "";
  return argv1.endsWith("scripts/run-ts.cjs") && argv2.includes("padel_seed_formats_top_paddel.ts");
}

if (shouldRunAsCli()) {
  main()
    .catch((error) => {
      console.error("[padel_seed_formats_top_paddel] failed", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma?.$disconnect?.().catch(() => {});
    });
}
