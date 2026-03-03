import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  CrmInteractionSource,
  CrmInteractionType,
  EventTemplateType,
  OrganizationKind,
  PrismaClient,
  ServiceKind,
  padel_match_status,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import {
  buildPadelExternalId,
  type PadelCrmCanonicalType,
  validatePadelInteractionMetadata,
} from "@/lib/crm/padelEventContract";
import { ingestPadelMatchInteractions } from "@/lib/crm/padelMatchInteractions";

type Args = {
  execute: boolean;
  days: number;
  limit: number;
  maxBatches: number;
};

type Summary = {
  mode: "dry-run" | "execute";
  days: number;
  booking: {
    scanned: number;
    eligible: number;
    emitted: number;
    skippedExisting: number;
    skippedMissingContact: number;
    skippedInvalidMetadata: number;
    errors: number;
  };
  match: {
    scanned: number;
    eligible: number;
    emittedPlayed: number;
    emittedOutcomes: number;
    skippedExisting: number;
    skippedWithoutUser: number;
    errors: number;
  };
};

const BOOKING_CANCELLED_STATUSES = new Set([
  "CANCELLED",
  "CANCELLED_BY_CLIENT",
  "CANCELLED_BY_ORG",
]);
const BOOKING_CONFIRMED_STATUSES = new Set([
  "CONFIRMED",
  "COMPLETED",
  "DISPUTED",
]);
const MATCH_OFFICIAL_STATUSES = [
  padel_match_status.OFFICIAL,
  padel_match_status.WALKOVER,
  padel_match_status.RETIRED,
] as const;

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep < 0) continue;
    const key = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function readNumberArg(argv: string[], prefix: string) {
  const raw = argv.find((token) => token.startsWith(prefix));
  if (!raw) return null;
  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function parseArgs(argv: string[]): Args {
  const execute = argv.includes("--execute");
  const days = Math.min(3650, Math.max(1, readNumberArg(argv, "--days=") ?? 365));
  const limit = Math.min(500, Math.max(20, readNumberArg(argv, "--limit=") ?? 200));
  const maxBatches = Math.min(10_000, Math.max(1, readNumberArg(argv, "--max-batches=") ?? 100));
  return { execute, days, limit, maxBatches };
}

function resolveBookingInteractionType(status: string): PadelCrmCanonicalType | null {
  const normalized = status.trim().toUpperCase();
  if (normalized === "NO_SHOW") return CrmInteractionType.PADEL_BOOKING_NO_SHOW;
  if (BOOKING_CANCELLED_STATUSES.has(normalized)) return CrmInteractionType.PADEL_BOOKING_CANCELLED;
  if (BOOKING_CONFIRMED_STATUSES.has(normalized)) return CrmInteractionType.PADEL_BOOKING_CONFIRMED;
  return null;
}

function resolveMatchResultType(status: padel_match_status): string {
  if (status === padel_match_status.WALKOVER) return "WALKOVER";
  if (status === padel_match_status.RETIRED) return "RETIREMENT";
  return "NORMAL";
}

async function backfillBookings(params: {
  prisma: PrismaClient;
  since: Date;
  execute: boolean;
  limit: number;
  maxBatches: number;
  summary: Summary["booking"];
}) {
  let cursorId = 0;
  for (let batch = 1; batch <= params.maxBatches; batch += 1) {
    const rows = await params.prisma.booking.findMany({
      where: {
        id: { gt: cursorId },
        startsAt: { gte: params.since },
        organization: { organizationKind: OrganizationKind.CLUBE_PADEL },
        service: { kind: { in: [ServiceKind.COURT, ServiceKind.CLASS] } },
        status: {
          in: [
            "CONFIRMED",
            "COMPLETED",
            "DISPUTED",
            "CANCELLED",
            "CANCELLED_BY_CLIENT",
            "CANCELLED_BY_ORG",
            "NO_SHOW",
          ],
        },
      },
      orderBy: { id: "asc" },
      take: params.limit,
      select: {
        id: true,
        organizationId: true,
        userId: true,
        guestEmail: true,
        serviceId: true,
        courtId: true,
        startsAt: true,
        updatedAt: true,
        status: true,
      },
    });
    if (!rows.length) break;

    const bookingIds = rows.map((row) => String(row.id));
    const existing = await params.prisma.crmInteraction.findMany({
      where: {
        sourceType: CrmInteractionSource.BOOKING,
        sourceId: { in: bookingIds },
        type: {
          in: [
            CrmInteractionType.PADEL_BOOKING_CONFIRMED,
            CrmInteractionType.PADEL_BOOKING_CANCELLED,
            CrmInteractionType.PADEL_BOOKING_NO_SHOW,
          ],
        },
      },
      select: {
        organizationId: true,
        type: true,
        sourceId: true,
      },
    });
    const existingSet = new Set(
      existing.map((item) => `${item.organizationId}:${item.type}:${item.sourceId ?? ""}`),
    );

    for (const row of rows) {
      params.summary.scanned += 1;
      const type = resolveBookingInteractionType(row.status);
      if (!type) continue;
      params.summary.eligible += 1;

      const existingKey = `${row.organizationId}:${type}:${row.id}`;
      if (existingSet.has(existingKey)) {
        params.summary.skippedExisting += 1;
        continue;
      }
      if (!row.userId && !row.guestEmail) {
        params.summary.skippedMissingContact += 1;
        continue;
      }

      const metadata = {
        bookingId: row.id,
        serviceId: row.serviceId ?? null,
        courtId: row.courtId ?? null,
        clubId: row.organizationId,
        timeslot: row.startsAt.toISOString(),
      };
      const validation = validatePadelInteractionMetadata(type, metadata);
      if (!validation.ok) {
        params.summary.skippedInvalidMetadata += 1;
        continue;
      }

      if (params.execute) {
        try {
          await ingestCrmInteraction({
            organizationId: row.organizationId,
            userId: row.userId ?? undefined,
            type,
            sourceType: CrmInteractionSource.BOOKING,
            sourceId: String(row.id),
            externalId: buildPadelExternalId(
              type,
              CrmInteractionSource.BOOKING,
              row.id,
              row.userId ?? row.guestEmail ?? null,
            ),
            occurredAt:
              type === CrmInteractionType.PADEL_BOOKING_CONFIRMED
                ? row.startsAt
                : row.updatedAt,
            contactEmail: row.guestEmail ?? undefined,
            metadata,
          });
          params.summary.emitted += 1;
        } catch (err) {
          params.summary.errors += 1;
          console.error("[backfill-padel-booking] erro", {
            bookingId: row.id,
            organizationId: row.organizationId,
            type,
            err,
          });
        }
      } else {
        params.summary.emitted += 1;
      }
    }

    cursorId = rows[rows.length - 1]?.id ?? cursorId;
    if (rows.length < params.limit) break;
    console.log(`[backfill-padel-booking] batch=${batch} cursor=${cursorId}`);
  }
}

async function backfillMatches(params: {
  prisma: PrismaClient;
  since: Date;
  execute: boolean;
  limit: number;
  maxBatches: number;
  summary: Summary["match"];
}) {
  let cursorId = 0;
  for (let batch = 1; batch <= params.maxBatches; batch += 1) {
    const rows = await params.prisma.eventMatchSlot.findMany({
      where: {
        id: { gt: cursorId },
        updatedAt: { gte: params.since },
        status: { in: [...MATCH_OFFICIAL_STATUSES] },
        event: {
          templateType: EventTemplateType.PADEL,
          organization: { organizationKind: OrganizationKind.CLUBE_PADEL },
        },
      },
      orderBy: { id: "asc" },
      take: params.limit,
      select: {
        id: true,
        eventId: true,
        categoryId: true,
        status: true,
        winnerSide: true,
        updatedAt: true,
        event: {
          select: {
            organizationId: true,
          },
        },
        participants: {
          orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
          select: {
            participantId: true,
            side: true,
            participant: {
              select: {
                playerProfile: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!rows.length) break;

    const matchIds = rows.map((row) => String(row.id));
    const existing = await params.prisma.crmInteraction.findMany({
      where: {
        sourceType: CrmInteractionSource.EVENT,
        sourceId: { in: matchIds },
        type: {
          in: [
            CrmInteractionType.PADEL_MATCH_PLAYED,
            CrmInteractionType.PADEL_MATCH_WIN,
            CrmInteractionType.PADEL_MATCH_LOSS,
          ],
        },
      },
      select: {
        organizationId: true,
        sourceId: true,
      },
    });
    const existingSet = new Set(
      existing.map((item) => `${item.organizationId}:${item.sourceId ?? ""}`),
    );

    for (const row of rows) {
      params.summary.scanned += 1;
      const organizationIdRaw = row.event.organizationId;
      if (typeof organizationIdRaw !== "number") {
        params.summary.errors += 1;
        continue;
      }
      const organizationId = organizationIdRaw;
      const existingKey = `${organizationId}:${row.id}`;
      if (existingSet.has(existingKey)) {
        params.summary.skippedExisting += 1;
        continue;
      }

      params.summary.eligible += 1;
      const statusVersion = `backfill:${row.status}:${row.updatedAt.getTime()}`;
      const winnerSide = row.winnerSide === "A" || row.winnerSide === "B" ? row.winnerSide : null;
      const resultType = resolveMatchResultType(row.status);

      if (params.execute) {
        const emitted = await ingestPadelMatchInteractions({
          organizationId,
          eventId: row.eventId,
          categoryId: row.categoryId ?? null,
          matchId: row.id,
          winnerSide,
          resultType,
          statusVersion,
          occurredAt: row.updatedAt,
          participants: row.participants.map((participant) => ({
            participantId: participant.participantId,
            side: participant.side === "B" ? "B" : "A",
            userId: participant.participant.playerProfile?.userId ?? null,
          })),
        });
        params.summary.emittedPlayed += emitted.playedEmitted;
        params.summary.emittedOutcomes += emitted.outcomesEmitted;
        params.summary.skippedWithoutUser += emitted.skippedWithoutUser;
        params.summary.errors += emitted.errors;
      } else {
        const participantsWithUser = row.participants.filter(
          (participant) => Boolean(participant.participant.playerProfile?.userId),
        );
        params.summary.emittedPlayed += participantsWithUser.length;
        params.summary.emittedOutcomes += winnerSide ? participantsWithUser.length : 0;
        params.summary.skippedWithoutUser += row.participants.length - participantsWithUser.length;
      }
    }

    cursorId = rows[rows.length - 1]?.id ?? cursorId;
    if (rows.length < params.limit) break;
    console.log(`[backfill-padel-match] batch=${batch} cursor=${cursorId}`);
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const args = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL ou DIRECT_URL.");
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

  const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
  const summary: Summary = {
    mode: args.execute ? "execute" : "dry-run",
    days: args.days,
    booking: {
      scanned: 0,
      eligible: 0,
      emitted: 0,
      skippedExisting: 0,
      skippedMissingContact: 0,
      skippedInvalidMetadata: 0,
      errors: 0,
    },
    match: {
      scanned: 0,
      eligible: 0,
      emittedPlayed: 0,
      emittedOutcomes: 0,
      skippedExisting: 0,
      skippedWithoutUser: 0,
      errors: 0,
    },
  };

  try {
    await backfillBookings({
      prisma,
      since,
      execute: args.execute,
      limit: args.limit,
      maxBatches: args.maxBatches,
      summary: summary.booking,
    });
    await backfillMatches({
      prisma,
      since,
      execute: args.execute,
      limit: args.limit,
      maxBatches: args.maxBatches,
      summary: summary.match,
    });

    console.log(JSON.stringify(summary, null, 2));
    if (args.execute) {
      console.log(
        "[backfill-padel] concluído. Próximo passo recomendado: reconstruir projeções com rebuildCrmContacts.",
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[backfill-padel] failed", err);
  process.exit(1);
});
