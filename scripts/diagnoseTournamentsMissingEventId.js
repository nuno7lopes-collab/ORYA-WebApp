#!/usr/bin/env node
/**
 * Diagnóstico read-only: torneios sem eventId ou com eventId sem evento associado.
 * Uso:
 *   node scripts/diagnoseTournamentsMissingEventId.js --format json --out /tmp/diagnose.json
 *   node scripts/diagnoseTournamentsMissingEventId.js --format csv
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient, Prisma } = require("@prisma/client");
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

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
}

function toCsv(rows) {
  const header = [
    "tournamentId",
    "eventId",
    "organizationId",
    "eventStatus",
    "eventStartsAt",
    "eventEndsAt",
    "hasAnyCandidateEventDirectLink",
    "candidateEventId",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const values = [
      row.tournamentId,
      row.eventId ?? "",
      row.organizationId ?? "",
      row.eventStatus ?? "",
      row.eventStartsAt ?? "",
      row.eventEndsAt ?? "",
      row.hasAnyCandidateEventDirectLink ? "true" : "false",
      row.candidateEventId ?? "",
    ];
    lines.push(values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

async function main() {
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

  try {
    const format = (readArg("--format") || "json").toLowerCase();
    const outPath = readArg("--out");

    const columnCheck = await prisma.$queryRaw`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'app_v3'
        AND table_name = 'events'
        AND column_name = 'tournament_id'
      LIMIT 1
    `;
    const hasEventTournamentId = Array.isArray(columnCheck) && columnCheck.length > 0;

    const rawRows = await prisma.$queryRaw`
      SELECT
        t.id AS tournament_id,
        t.event_id AS event_id,
        e.id AS event_exists_id,
        e.organization_id AS organization_id,
        e.status AS event_status,
        e.starts_at AS event_starts_at,
        e.ends_at AS event_ends_at
      FROM app_v3.tournaments t
      LEFT JOIN app_v3.events e ON e.id = t.event_id
      WHERE t.event_id IS NULL OR e.id IS NULL
      ORDER BY t.id ASC
    `;

    const rows = Array.isArray(rawRows) ? rawRows : [];
    const tournamentIds = rows.map((r) => Number(r.tournament_id)).filter((id) => Number.isFinite(id));

    const directLinkMap = new Map();
    if (hasEventTournamentId && tournamentIds.length > 0) {
      const directLinks = await prisma.$queryRaw`
        SELECT id AS event_id, tournament_id
        FROM app_v3.events
        WHERE tournament_id IN (${Prisma.join(tournamentIds)})
      `;
      for (const row of directLinks) {
        const tid = Number(row.tournament_id);
        const eid = Number(row.event_id);
        if (Number.isFinite(tid) && Number.isFinite(eid)) {
          directLinkMap.set(tid, eid);
        }
      }
    }

    const outputRows = rows.map((r) => {
      const tournamentId = Number(r.tournament_id);
      const candidateEventId = directLinkMap.get(tournamentId) ?? null;
      return {
        tournamentId,
        eventId: r.event_id ?? null,
        organizationId: r.organization_id ?? null,
        eventStatus: r.event_status ?? null,
        eventStartsAt: r.event_starts_at ? new Date(r.event_starts_at).toISOString() : null,
        eventEndsAt: r.event_ends_at ? new Date(r.event_ends_at).toISOString() : null,
        hasAnyCandidateEventDirectLink: Boolean(candidateEventId),
        candidateEventId,
      };
    });

    const summary = new Map();
    for (const row of outputRows) {
      const orgKey = row.organizationId ?? "null";
      const statusKey = row.eventStatus ?? "null";
      const key = `${orgKey}::${statusKey}`;
      summary.set(key, (summary.get(key) || 0) + 1);
    }

    const summaryRows = Array.from(summary.entries()).map(([key, count]) => {
      const [orgId, status] = key.split("::");
      return { organizationId: orgId === "null" ? null : Number(orgId), eventStatus: status === "null" ? null : status, count };
    });

    const payload = {
      generatedAt: new Date().toISOString(),
      hasEventTournamentIdColumn: hasEventTournamentId,
      total: outputRows.length,
      items: outputRows,
      countsByOrgAndStatus: summaryRows,
    };

    let content = "";
    if (format === "csv") {
      content = toCsv(outputRows);
    } else {
      content = JSON.stringify(payload, null, 2);
    }

    if (outPath) {
      fs.writeFileSync(outPath, content, "utf8");
      console.log(`Escrito: ${outPath}`);
    } else {
      process.stdout.write(content + "\n");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[diagnoseTournamentsMissingEventId] Erro:", err);
  process.exit(1);
});
