import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type Args = {
  execute: boolean;
  env: "prod" | "test";
  onlyUpcoming: boolean;
  organizationId: number | null;
  eventId: number | null;
  limit: number;
  maxBatches: number;
};

type Summary = {
  mode: "dry-run" | "execute";
  env: "prod" | "test";
  onlyUpcoming: boolean;
  scannedEvents: number;
  touchedEvents: number;
  touchedCategoryLinks: number;
  touchedTournamentConfigs: number;
  maxEntriesBackfilled: number;
  maxEntriesRaisedToActive: number;
  categoryFromPlayers: number;
  categoryFromTeams: number;
  categoryFromTickets: number;
  categoryFromActiveTeams: number;
  eventsWithoutEnabledCategories: number;
  eventsMissingConfigForMaxEntries: number;
  eventsStillWithoutReliableCapacity: number;
  sampleMissingCapacity: Array<{
    eventId: number;
    title: string;
    organizationId: number | null;
    startsAt: string;
    categoriesEnabled: number;
    categoriesWithTeams: number;
    activeTeams: number;
  }>;
};

type CategoryDecisionReason =
  | "FROM_PLAYERS"
  | "FROM_TEAMS"
  | "FROM_TICKET_QUANTITY"
  | "FROM_ACTIVE_TEAMS"
  | "PLAYERS_ALIGNED_WITH_TEAMS"
  | "RAISED_TO_ACTIVE_TEAMS";

type CategoryDecision = {
  nextTeams: number | null;
  nextPlayers: number | null;
  changed: boolean;
  reasons: CategoryDecisionReason[];
};

type EventRow = {
  id: number;
  title: string;
  organizationId: number | null;
  startsAt: Date;
  padelTournamentConfig: {
    id: number;
    advancedSettings: unknown;
  } | null;
  padelCategoryLinks: Array<{
    id: number;
    padelCategoryId: number;
    capacityTeams: number | null;
    capacityPlayers: number | null;
    ticketTypes: Array<{
      totalQuantity: number | null;
      soldQuantity: number;
    }>;
  }>;
};

const INACTIVE_REGISTRATION_STATUSES = ["EXPIRED", "CANCELLED", "REFUNDED"] as const;
type MutableJsonObject = Record<string, Prisma.InputJsonValue | null>;

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function readNumericArg(argv: string[], prefix: string) {
  const token = argv.find((arg) => arg.startsWith(prefix));
  if (!token) return null;
  const parsed = Number(token.slice(prefix.length));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Argumento inválido: ${token}`);
  }
  return Math.trunc(parsed);
}

function clampPositive(value: number | null, fallback: number, max: number) {
  if (!value || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function parseEnvArg(raw: string | null | undefined): "prod" | "test" {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "test" || normalized === "staging" || normalized === "testing") return "test";
  return "prod";
}

function parseArgs(argv: string[]): Args {
  const envToken = argv.find((arg) => arg.startsWith("--env="));
  const env = parseEnvArg(envToken ? envToken.slice("--env=".length) : process.env.APP_ENV ?? process.env.FORCE_APP_ENV ?? null);
  const eventId = readNumericArg(argv, "--event-id=");
  const organizationId = readNumericArg(argv, "--organization-id=");

  return {
    execute: argv.includes("--execute"),
    env,
    onlyUpcoming: !argv.includes("--include-past"),
    organizationId: organizationId && organizationId > 0 ? organizationId : null,
    eventId: eventId && eventId > 0 ? eventId : null,
    limit: clampPositive(readNumericArg(argv, "--limit="), 100, 500),
    maxBatches: clampPositive(readNumericArg(argv, "--max-batches="), 50, 1000),
  };
}

function normalizePositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function parseAdvancedSettings(raw: unknown): MutableJsonObject {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...(raw as MutableJsonObject) };
}

function parseMaxEntriesTotal(advanced: MutableJsonObject) {
  return normalizePositiveInt(advanced.maxEntriesTotal);
}

function computeTicketQuantitySignal(ticketTypes: Array<{ totalQuantity: number | null; soldQuantity: number }>) {
  const totalQuantity = ticketTypes.reduce((sum, ticket) => sum + (normalizePositiveInt(ticket.totalQuantity) ?? 0), 0);
  if (totalQuantity > 0) return totalQuantity;
  const soldQuantity = ticketTypes.reduce((sum, ticket) => sum + (normalizePositiveInt(ticket.soldQuantity) ?? 0), 0);
  return soldQuantity > 0 ? soldQuantity : null;
}

function deriveCategoryDecision(params: {
  currentTeams: number | null;
  currentPlayers: number | null;
  ticketQuantitySignal: number | null;
  activeTeams: number;
}): CategoryDecision {
  const reasons: CategoryDecisionReason[] = [];
  let teams = normalizePositiveInt(params.currentTeams);
  let players = normalizePositiveInt(params.currentPlayers);

  if (!teams && players) {
    teams = Math.ceil(players / 2);
    reasons.push("FROM_PLAYERS");
  }
  if (!players && teams) {
    players = teams * 2;
    reasons.push("FROM_TEAMS");
  }

  if (!teams && !players && params.ticketQuantitySignal && params.ticketQuantitySignal > 0) {
    players = params.ticketQuantitySignal;
    teams = Math.ceil(params.ticketQuantitySignal / 2);
    reasons.push("FROM_TICKET_QUANTITY");
  }

  if (!teams && params.activeTeams > 0) {
    teams = params.activeTeams;
    players = Math.max(players ?? 0, params.activeTeams * 2);
    reasons.push("FROM_ACTIVE_TEAMS");
  }

  if (teams && params.activeTeams > teams) {
    teams = params.activeTeams;
    players = Math.max(players ?? 0, params.activeTeams * 2);
    reasons.push("RAISED_TO_ACTIVE_TEAMS");
  }

  if (teams && (!players || players < teams * 2)) {
    players = teams * 2;
    reasons.push("PLAYERS_ALIGNED_WITH_TEAMS");
  }

  const nextTeams = teams ?? null;
  const nextPlayers = players ?? null;
  const changed =
    normalizePositiveInt(params.currentTeams) !== nextTeams ||
    normalizePositiveInt(params.currentPlayers) !== nextPlayers;

  return { nextTeams, nextPlayers, changed, reasons };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const args = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL ou DIRECT_URL no ambiente.");
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

  const summary: Summary = {
    mode: args.execute ? "execute" : "dry-run",
    env: args.env,
    onlyUpcoming: args.onlyUpcoming,
    scannedEvents: 0,
    touchedEvents: 0,
    touchedCategoryLinks: 0,
    touchedTournamentConfigs: 0,
    maxEntriesBackfilled: 0,
    maxEntriesRaisedToActive: 0,
    categoryFromPlayers: 0,
    categoryFromTeams: 0,
    categoryFromTickets: 0,
    categoryFromActiveTeams: 0,
    eventsWithoutEnabledCategories: 0,
    eventsMissingConfigForMaxEntries: 0,
    eventsStillWithoutReliableCapacity: 0,
    sampleMissingCapacity: [],
  };

  let cursor = 0;
  const now = new Date();

  try {
    for (let batch = 1; batch <= args.maxBatches; batch += 1) {
      const events = (await prisma.event.findMany({
        where: {
          env: args.env,
          id: { gt: cursor },
          isDeleted: false,
          templateType: "PADEL",
          ...(args.onlyUpcoming ? { startsAt: { gte: now } } : {}),
          ...(args.organizationId ? { organizationId: args.organizationId } : {}),
          ...(args.eventId ? { id: args.eventId } : {}),
        },
        select: {
          id: true,
          title: true,
          organizationId: true,
          startsAt: true,
          padelTournamentConfig: {
            select: {
              id: true,
              advancedSettings: true,
            },
          },
          padelCategoryLinks: {
            where: { env: args.env, isEnabled: true },
            select: {
              id: true,
              padelCategoryId: true,
              capacityTeams: true,
              capacityPlayers: true,
              ticketTypes: {
                where: { env: args.env },
                select: {
                  totalQuantity: true,
                  soldQuantity: true,
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
        take: args.limit,
      })) as EventRow[];

      if (!events.length) break;
      summary.scannedEvents += events.length;
      cursor = events[events.length - 1]?.id ?? cursor;

      const eventIds = events.map((event) => event.id);
      const [activePairingsByEvent, activePairingsByCategory] = await Promise.all([
        prisma.padelPairing.groupBy({
          by: ["eventId"],
          where: {
            env: args.env,
            eventId: { in: eventIds },
            pairingStatus: { not: "CANCELLED" },
            OR: [
              { registration: { status: { notIn: [...INACTIVE_REGISTRATION_STATUSES] } } },
              { registration: null },
            ],
          },
          _count: { _all: true },
        }),
        prisma.padelPairing.groupBy({
          by: ["eventId", "categoryId"],
          where: {
            env: args.env,
            eventId: { in: eventIds },
            pairingStatus: { not: "CANCELLED" },
            OR: [
              { registration: { status: { notIn: [...INACTIVE_REGISTRATION_STATUSES] } } },
              { registration: null },
            ],
          },
          _count: { _all: true },
        }),
      ]);

      const activeEventMap = new Map<number, number>();
      activePairingsByEvent.forEach((row) => {
        activeEventMap.set(row.eventId, row._count._all);
      });
      const activeCategoryMap = new Map<string, number>();
      activePairingsByCategory.forEach((row) => {
        if (!row.categoryId) return;
        activeCategoryMap.set(`${row.eventId}:${row.categoryId}`, row._count._all);
      });

      for (const event of events) {
        const categoryDecisions = event.padelCategoryLinks.map((link) => {
          const activeTeams = activeCategoryMap.get(`${event.id}:${link.padelCategoryId}`) ?? 0;
          const ticketQuantitySignal = computeTicketQuantitySignal(link.ticketTypes);
          const decision = deriveCategoryDecision({
            currentTeams: link.capacityTeams,
            currentPlayers: link.capacityPlayers,
            ticketQuantitySignal,
            activeTeams,
          });
          return { linkId: link.id, decision };
        });

        const categoryUpdates = categoryDecisions.filter((item) => item.decision.changed);
        categoryUpdates.forEach((item) => {
          if (item.decision.reasons.includes("FROM_PLAYERS")) summary.categoryFromPlayers += 1;
          if (item.decision.reasons.includes("FROM_TEAMS")) summary.categoryFromTeams += 1;
          if (item.decision.reasons.includes("FROM_TICKET_QUANTITY")) summary.categoryFromTickets += 1;
          if (item.decision.reasons.includes("FROM_ACTIVE_TEAMS")) summary.categoryFromActiveTeams += 1;
        });

        if (event.padelCategoryLinks.length === 0) {
          summary.eventsWithoutEnabledCategories += 1;
        }

        const categoriesWithTeams = categoryDecisions.filter(
          (item) => typeof item.decision.nextTeams === "number" && item.decision.nextTeams > 0,
        ).length;
        const allCategoriesHaveTeams =
          event.padelCategoryLinks.length > 0 && categoriesWithTeams === event.padelCategoryLinks.length;
        const sumCategoryTeams = allCategoriesHaveTeams
          ? categoryDecisions.reduce((sum, item) => sum + (item.decision.nextTeams ?? 0), 0)
          : null;

        const activeTeamsEvent = activeEventMap.get(event.id) ?? 0;
        const advanced = parseAdvancedSettings(event.padelTournamentConfig?.advancedSettings);
        const rawMaxEntries = advanced.maxEntriesTotal;
        const normalizedExistingMaxEntries = parseMaxEntriesTotal(advanced);
        let nextMaxEntries = normalizedExistingMaxEntries;
        let maxEntriesBackfilled = false;
        let maxEntriesRaisedToActive = false;

        if (!nextMaxEntries) {
          if (sumCategoryTeams && sumCategoryTeams > 0) {
            nextMaxEntries = sumCategoryTeams;
            maxEntriesBackfilled = true;
          } else if (activeTeamsEvent > 0) {
            nextMaxEntries = activeTeamsEvent;
            maxEntriesBackfilled = true;
          }
        }
        if (nextMaxEntries && activeTeamsEvent > nextMaxEntries) {
          nextMaxEntries = activeTeamsEvent;
          maxEntriesRaisedToActive = true;
        }

        const hasRawMaxEntries = Object.prototype.hasOwnProperty.call(advanced, "maxEntriesTotal");
        const shouldWriteMaxEntries =
          (typeof nextMaxEntries === "number" && nextMaxEntries > 0) ||
          hasRawMaxEntries;
        const needsMaxEntriesUpdate =
          shouldWriteMaxEntries &&
          (nextMaxEntries !== normalizedExistingMaxEntries ||
            (typeof nextMaxEntries === "number" && typeof rawMaxEntries !== "number") ||
            (nextMaxEntries === null && hasRawMaxEntries));

        const hasReliableEventCapacity =
          (typeof nextMaxEntries === "number" && nextMaxEntries > 0) ||
          (allCategoriesHaveTeams && (sumCategoryTeams ?? 0) > 0);
        if (!hasReliableEventCapacity) {
          summary.eventsStillWithoutReliableCapacity += 1;
          if (summary.sampleMissingCapacity.length < 20) {
            summary.sampleMissingCapacity.push({
              eventId: event.id,
              title: event.title,
              organizationId: event.organizationId ?? null,
              startsAt: event.startsAt.toISOString(),
              categoriesEnabled: event.padelCategoryLinks.length,
              categoriesWithTeams,
              activeTeams: activeTeamsEvent,
            });
          }
        }

        const shouldUpdateEvent = categoryUpdates.length > 0 || needsMaxEntriesUpdate;
        if (!shouldUpdateEvent) continue;

        summary.touchedEvents += 1;
        summary.touchedCategoryLinks += categoryUpdates.length;
        if (needsMaxEntriesUpdate) {
          if (maxEntriesBackfilled) summary.maxEntriesBackfilled += 1;
          if (maxEntriesRaisedToActive) summary.maxEntriesRaisedToActive += 1;
          if (!event.padelTournamentConfig) summary.eventsMissingConfigForMaxEntries += 1;
        }

        if (!args.execute) continue;

        await prisma.$transaction(async (tx) => {
          for (const update of categoryUpdates) {
            await tx.padelEventCategoryLink.updateMany({
              where: { id: update.linkId, env: args.env },
              data: {
                capacityTeams: update.decision.nextTeams,
                capacityPlayers: update.decision.nextPlayers,
              },
            });
          }

          if (needsMaxEntriesUpdate && event.padelTournamentConfig) {
            const nextAdvanced = parseAdvancedSettings(event.padelTournamentConfig.advancedSettings);
            if (typeof nextMaxEntries === "number" && nextMaxEntries > 0) {
              nextAdvanced.maxEntriesTotal = nextMaxEntries;
            } else {
              delete nextAdvanced.maxEntriesTotal;
            }

            await tx.padelTournamentConfig.updateMany({
              where: { id: event.padelTournamentConfig.id, env: args.env },
              data: {
                advancedSettings: nextAdvanced as Prisma.InputJsonValue,
              },
            });
            summary.touchedTournamentConfigs += 1;
          }
        });
      }

      console.log(
        `[padel_capacity_backfill] batch=${batch} scanned=${events.length} cursor=${cursor} mode=${summary.mode}`,
      );

      if (args.eventId) break;
      if (events.length < args.limit) break;
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[padel_capacity_backfill] failed", error);
  process.exit(1);
});
