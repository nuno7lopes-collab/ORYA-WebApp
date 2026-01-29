const path = require("node:path");
const fs = require("node:fs");
const { Pool } = require("pg");
const { URL } = require("node:url");

require("./load-env");

function usage() {
  console.log(`
Uso:
  node scripts/delete_test_events.js [--dry-run] [--force] [--env=staging|production]
    [--pattern=test-,qa-] [--batch-size=100] [--limit=500]
    [--ssl-no-verify]

Notas:
  - Por defeito corre em dry-run (sem apagar).
  - Para apagar mesmo, usa --force e indica --env=staging|production.
  - --pattern define prefixos de slug (comma-separated). Ex: "test-,qa-".
  - --ssl-no-verify desativa validacao de certificado (usar apenas se necessario).
`);
}

function getArg(name) {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toLikePatterns(prefixes) {
  return prefixes
    .map((item) => item.toLowerCase())
    .map((item) => (item.includes("%") || item.includes("_") ? item : `${item}%`));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL no ambiente.");
    process.exit(1);
  }

  const force = hasFlag("--force");
  const dryRun = hasFlag("--dry-run") || !force;
  const envName = getArg("--env");
  const batchSizeRaw = getArg("--batch-size");
  const limitRaw = getArg("--limit");
  const batchSize = Number(batchSizeRaw ?? 100);
  const limit = Number(limitRaw ?? 500);

  if (Number.isNaN(batchSize) || batchSize <= 0) {
    console.error("batch-size invalido.");
    process.exit(1);
  }
  if (Number.isNaN(limit) || limit <= 0) {
    console.error("limit invalido.");
    process.exit(1);
  }

  if (force && !envName) {
    console.error("Para apagar em definitivo usa --env=staging ou --env=production.");
    process.exit(1);
  }

  const slugPrefixes = parseList(getArg("--pattern"), ["test-", "qa-"]);
  const slugPatterns = toLikePatterns(slugPrefixes);
  const titlePatterns = ["%test%", "%qa%"];
  const ownerPatterns = ["%test%", "%qa%"];

  const sslNoVerify = hasFlag("--ssl-no-verify");
  let dbUrl;
  try {
    dbUrl = new URL(process.env.DATABASE_URL);
  } catch (err) {
    console.error("DATABASE_URL invalida.");
    process.exit(1);
  }

  const sslConfig = sslNoVerify
    ? { rejectUnauthorized: false }
    : process.env.NODE_ENV === "production"
    ? undefined
    : { rejectUnauthorized: false };

  const pool = new Pool({
    host: dbUrl.hostname,
    port: dbUrl.port ? Number(dbUrl.port) : 5432,
    database: dbUrl.pathname.replace("/", ""),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    ssl: sslConfig,
  });

  ensureDir(path.join(process.cwd(), "reports"));

  const candidateSql = `
    SELECT
      e.id,
      e.slug,
      e.title,
      e.created_at,
      e.owner_user_id,
      e.invite_only,
      e.public_access_mode
    FROM app_v3.events e
    WHERE
      (lower(e.slug) LIKE ANY($1::text[]))
      OR (lower(e.title) LIKE ANY($2::text[]))
      OR EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = e.owner_user_id
          AND lower(u.email) LIKE ANY($3::text[])
      )
      OR EXISTS (
        SELECT 1
        FROM app_v3.profiles p
        WHERE p.id = e.owner_user_id
          AND (
            lower(p.username) LIKE ANY($3::text[])
            OR lower(p.full_name) LIKE ANY($3::text[])
          )
      )
    ORDER BY e.created_at DESC
    LIMIT $4;
  `;

  const candidatesResult = await pool.query(candidateSql, [
    slugPatterns,
    titlePatterns,
    ownerPatterns,
    limit,
  ]);

  const candidates = candidatesResult.rows;

  const countSql = `
    WITH
      event_tickets AS (SELECT id FROM app_v3.tickets WHERE event_id = $1),
      event_ticket_types AS (SELECT id FROM app_v3.ticket_types WHERE event_id = $1),
      event_ticket_orders AS (SELECT id FROM app_v3.ticket_orders WHERE event_id = $1),
      event_sale_summaries AS (SELECT id FROM app_v3.sale_summaries WHERE event_id = $1),
      event_promo_codes AS (SELECT id FROM app_v3.promo_codes WHERE event_id = $1),
      event_padel_pairings AS (SELECT id FROM app_v3.padel_pairings WHERE event_id = $1),
      event_padel_regs AS (SELECT id FROM app_v3.padel_registrations WHERE event_id = $1),
      event_tournaments AS (SELECT id FROM app_v3.tournaments WHERE event_id = $1)
    SELECT
      (SELECT COUNT(*) FROM app_v3.event_access_policies WHERE event_id = $1) AS event_access_policies,
      (SELECT COUNT(*) FROM app_v3.event_invites WHERE event_id = $1) AS event_invites,
      (SELECT COUNT(*) FROM app_v3.invite_tokens WHERE event_id = $1) AS invite_tokens,
      (SELECT COUNT(*) FROM app_v3.ticket_types WHERE event_id = $1) AS ticket_types,
      (SELECT COUNT(*) FROM app_v3.tickets WHERE event_id = $1) AS tickets,
      (SELECT COUNT(*) FROM app_v3.ticket_reservations WHERE event_id = $1) AS ticket_reservations,
      (SELECT COUNT(*) FROM app_v3.ticket_orders WHERE event_id = $1) AS ticket_orders,
      (SELECT COUNT(*) FROM app_v3.ticket_order_lines WHERE ticket_order_id IN (SELECT id FROM event_ticket_orders)) AS ticket_order_lines,
      (SELECT COUNT(*) FROM app_v3.sale_summaries WHERE event_id = $1) AS sale_summaries,
      (SELECT COUNT(*) FROM app_v3.sale_lines WHERE event_id = $1) AS sale_lines,
      (SELECT COUNT(*) FROM app_v3.entitlements WHERE event_id = $1) AS entitlements,
      (SELECT COUNT(*) FROM app_v3.entitlement_checkins WHERE event_id = $1) AS entitlement_checkins,
      (SELECT COUNT(*) FROM app_v3.entitlement_qr_tokens WHERE entitlement_id IN (SELECT id FROM app_v3.entitlements WHERE event_id = $1)) AS entitlement_qr_tokens,
      (SELECT COUNT(*) FROM app_v3.ticket_resales WHERE ticket_id IN (SELECT id FROM event_tickets)) AS ticket_resales,
      (SELECT COUNT(*) FROM app_v3.guest_ticket_links WHERE ticket_id IN (SELECT id FROM event_tickets)) AS guest_ticket_links,
      (SELECT COUNT(*) FROM app_v3.notifications WHERE event_id = $1 OR ticket_id IN (SELECT id FROM event_tickets)) AS notifications,
      (SELECT COUNT(*) FROM app_v3.promo_codes WHERE event_id = $1) AS promo_codes,
      (SELECT COUNT(*) FROM app_v3.promo_redemptions WHERE promo_code_id IN (SELECT id FROM event_promo_codes)) AS promo_redemptions,
      (SELECT COUNT(*) FROM app_v3.refunds WHERE event_id = $1) AS refunds,
      (SELECT COUNT(*) FROM app_v3.payment_events WHERE event_id = $1) AS payment_events,
      (SELECT COUNT(*) FROM app_v3.operations WHERE event_id = $1) AS operations,
      (SELECT COUNT(*) FROM app_v3.padel_event_category_links WHERE event_id = $1) AS padel_event_category_links,
      (SELECT COUNT(*) FROM app_v3.padel_tournament_configs WHERE event_id = $1) AS padel_tournament_configs,
      (SELECT COUNT(*) FROM app_v3.padel_court_blocks WHERE event_id = $1) AS padel_court_blocks,
      (SELECT COUNT(*) FROM app_v3.padel_availabilities WHERE event_id = $1) AS padel_availabilities,
      (SELECT COUNT(*) FROM app_v3.padel_pairings WHERE event_id = $1) AS padel_pairings,
      (SELECT COUNT(*) FROM app_v3.padel_pairing_holds WHERE event_id = $1) AS padel_pairing_holds,
      (SELECT COUNT(*) FROM app_v3.padel_pairing_slots WHERE pairing_id IN (SELECT id FROM event_padel_pairings)) AS padel_pairing_slots,
      (SELECT COUNT(*) FROM app_v3.padel_matches WHERE event_id = $1) AS padel_matches,
      (SELECT COUNT(*) FROM app_v3.padel_registrations WHERE event_id = $1) AS padel_registrations,
      (SELECT COUNT(*) FROM app_v3.padel_registration_lines WHERE padel_registration_id IN (SELECT id FROM event_padel_regs)) AS padel_registration_lines,
      (SELECT COUNT(*) FROM app_v3.padel_waitlist_entries WHERE event_id = $1) AS padel_waitlist_entries,
      (SELECT COUNT(*) FROM app_v3.padel_ranking_entries WHERE event_id = $1) AS padel_ranking_entries,
      (SELECT COUNT(*) FROM app_v3.tournament_entries WHERE event_id = $1) AS tournament_entries,
      (SELECT COUNT(*) FROM app_v3.tournaments WHERE event_id = $1) AS tournaments,
      (SELECT COUNT(*) FROM app_v3.tournament_stages WHERE tournament_id IN (SELECT id FROM event_tournaments)) AS tournament_stages,
      (SELECT COUNT(*) FROM app_v3.tournament_groups WHERE stage_id IN (SELECT id FROM app_v3.tournament_stages WHERE tournament_id IN (SELECT id FROM event_tournaments))) AS tournament_groups,
      (SELECT COUNT(*) FROM app_v3.tournament_matches WHERE stage_id IN (SELECT id FROM app_v3.tournament_stages WHERE tournament_id IN (SELECT id FROM event_tournaments))) AS tournament_matches,
      (SELECT COUNT(*) FROM app_v3.tournament_audit_logs WHERE tournament_id IN (SELECT id FROM event_tournaments)) AS tournament_audit_logs;
  `;

  const enriched = [];
  if (candidates.length > 0) {
    for (const event of candidates) {
      const countsResult = await pool.query(countSql, [event.id]);
      enriched.push({ ...event, counts: countsResult.rows[0] });
    }
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    process.cwd(),
    "reports",
    `candidate_events_for_deletion_${timestamp}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: now.toISOString(),
    dryRun,
    env: envName ?? null,
    slugPatterns,
    titlePatterns,
    ownerPatterns,
    limit,
    batchSize,
    candidates: enriched,
  }, null, 2));

  console.log(`[delete-test-events] Candidatos: ${candidates.length}`);
  console.log(`[delete-test-events] Report: ${reportPath}`);

  if (candidates.length === 0) {
    console.log("[delete-test-events] Nenhum evento candidato encontrado.");
    if (!dryRun) {
      const dateTag = new Date().toISOString().slice(0, 10);
      const deletedPath = path.join(
        process.cwd(),
        "reports",
        `deleted_events_${dateTag}.json`,
      );
      fs.writeFileSync(
        deletedPath,
        JSON.stringify({ deletedAt: new Date().toISOString(), env: envName, deletedEvents: [] }, null, 2),
      );
      console.log(`[delete-test-events] Report: ${deletedPath}`);
    }
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log("[delete-test-events] Dry-run concluido (nenhum dado removido).");
    await pool.end();
    return;
  }

  const deleteStatements = [
    {
      label: "PadelPairing.createdByTicketId -> null",
      sql: `UPDATE app_v3.padel_pairings SET created_by_ticket_id = NULL WHERE event_id = $1`,
    },
    {
      label: "Notifications",
      sql: `
        DELETE FROM app_v3.notifications
        WHERE event_id = $1
          OR ticket_id IN (SELECT id FROM app_v3.tickets WHERE event_id = $1)
      `,
    },
    {
      label: "EntitlementCheckin",
      sql: `DELETE FROM app_v3.entitlement_checkins WHERE event_id = $1`,
    },
    {
      label: "EntitlementQrToken",
      sql: `
        DELETE FROM app_v3.entitlement_qr_tokens
        WHERE entitlement_id IN (SELECT id FROM app_v3.entitlements WHERE event_id = $1)
      `,
    },
    {
      label: "Entitlement",
      sql: `DELETE FROM app_v3.entitlements WHERE event_id = $1`,
    },
    {
      label: "PadelPairingSlot",
      sql: `
        DELETE FROM app_v3.padel_pairing_slots
        WHERE pairing_id IN (SELECT id FROM app_v3.padel_pairings WHERE event_id = $1)
      `,
    },
    {
      label: "PadelPairingHold",
      sql: `DELETE FROM app_v3.padel_pairing_holds WHERE event_id = $1`,
    },
    {
      label: "PadelMatch",
      sql: `DELETE FROM app_v3.padel_matches WHERE event_id = $1`,
    },
    {
      label: "PadelWaitlistEntry",
      sql: `DELETE FROM app_v3.padel_waitlist_entries WHERE event_id = $1`,
    },
    {
      label: "TournamentEntry",
      sql: `DELETE FROM app_v3.tournament_entries WHERE event_id = $1`,
    },
    {
      label: "PadelRegistrationLine",
      sql: `
        DELETE FROM app_v3.padel_registration_lines
        WHERE padel_registration_id IN (SELECT id FROM app_v3.padel_registrations WHERE event_id = $1)
      `,
    },
    {
      label: "PadelRegistration",
      sql: `DELETE FROM app_v3.padel_registrations WHERE event_id = $1`,
    },
    {
      label: "TicketResale",
      sql: `
        DELETE FROM app_v3.ticket_resales
        WHERE ticket_id IN (SELECT id FROM app_v3.tickets WHERE event_id = $1)
      `,
    },
    {
      label: "GuestTicketLink",
      sql: `
        DELETE FROM app_v3.guest_ticket_links
        WHERE ticket_id IN (SELECT id FROM app_v3.tickets WHERE event_id = $1)
      `,
    },
    {
      label: "TicketReservation",
      sql: `DELETE FROM app_v3.ticket_reservations WHERE event_id = $1`,
    },
    {
      label: "TicketOrderLine",
      sql: `
        DELETE FROM app_v3.ticket_order_lines
        WHERE ticket_order_id IN (SELECT id FROM app_v3.ticket_orders WHERE event_id = $1)
      `,
    },
    {
      label: "TicketOrder",
      sql: `DELETE FROM app_v3.ticket_orders WHERE event_id = $1`,
    },
    {
      label: "SaleLine",
      sql: `DELETE FROM app_v3.sale_lines WHERE event_id = $1`,
    },
    {
      label: "SaleSummary",
      sql: `DELETE FROM app_v3.sale_summaries WHERE event_id = $1`,
    },
    {
      label: "Ticket",
      sql: `DELETE FROM app_v3.tickets WHERE event_id = $1`,
    },
    {
      label: "TicketType",
      sql: `DELETE FROM app_v3.ticket_types WHERE event_id = $1`,
    },
    {
      label: "PromoRedemption",
      sql: `
        DELETE FROM app_v3.promo_redemptions
        WHERE promo_code_id IN (SELECT id FROM app_v3.promo_codes WHERE event_id = $1)
      `,
    },
    {
      label: "PromoCode",
      sql: `DELETE FROM app_v3.promo_codes WHERE event_id = $1`,
    },
    {
      label: "Refund",
      sql: `DELETE FROM app_v3.refunds WHERE event_id = $1`,
    },
    {
      label: "PaymentEvent",
      sql: `DELETE FROM app_v3.payment_events WHERE event_id = $1`,
    },
    {
      label: "Operation",
      sql: `DELETE FROM app_v3.operations WHERE event_id = $1`,
    },
    {
      label: "EventInvite",
      sql: `DELETE FROM app_v3.event_invites WHERE event_id = $1`,
    },
    {
      label: "InviteToken",
      sql: `DELETE FROM app_v3.invite_tokens WHERE event_id = $1`,
    },
    {
      label: "EventAccessPolicy",
      sql: `DELETE FROM app_v3.event_access_policies WHERE event_id = $1`,
    },
    {
      label: "PadelAvailability",
      sql: `DELETE FROM app_v3.padel_availabilities WHERE event_id = $1`,
    },
    {
      label: "PadelCourtBlock",
      sql: `DELETE FROM app_v3.padel_court_blocks WHERE event_id = $1`,
    },
    {
      label: "PadelRankingEntry",
      sql: `DELETE FROM app_v3.padel_ranking_entries WHERE event_id = $1`,
    },
    {
      label: "PadelTournamentConfig",
      sql: `DELETE FROM app_v3.padel_tournament_configs WHERE event_id = $1`,
    },
    {
      label: "PadelEventCategoryLink",
      sql: `DELETE FROM app_v3.padel_event_category_links WHERE event_id = $1`,
    },
    {
      label: "TournamentMatch",
      sql: `
        DELETE FROM app_v3.tournament_matches
        WHERE stage_id IN (
          SELECT id FROM app_v3.tournament_stages
          WHERE tournament_id IN (SELECT id FROM app_v3.tournaments WHERE event_id = $1)
        )
      `,
    },
    {
      label: "TournamentGroup",
      sql: `
        DELETE FROM app_v3.tournament_groups
        WHERE stage_id IN (
          SELECT id FROM app_v3.tournament_stages
          WHERE tournament_id IN (SELECT id FROM app_v3.tournaments WHERE event_id = $1)
        )
      `,
    },
    {
      label: "TournamentStage",
      sql: `
        DELETE FROM app_v3.tournament_stages
        WHERE tournament_id IN (SELECT id FROM app_v3.tournaments WHERE event_id = $1)
      `,
    },
    {
      label: "TournamentAuditLog",
      sql: `
        DELETE FROM app_v3.tournament_audit_logs
        WHERE tournament_id IN (SELECT id FROM app_v3.tournaments WHERE event_id = $1)
      `,
    },
    {
      label: "Tournament",
      sql: `DELETE FROM app_v3.tournaments WHERE event_id = $1`,
    },
    {
      label: "PadelPairing",
      sql: `DELETE FROM app_v3.padel_pairings WHERE event_id = $1`,
    },
    {
      label: "Event",
      sql: `DELETE FROM app_v3.events WHERE id = $1`,
    },
  ];

  const deletedEvents = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    console.log(`[delete-test-events] Batch ${i / batchSize + 1}: ${batch.length} eventos`);
    for (const event of batch) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const step of deleteStatements) {
          const result = await client.query(step.sql, [event.id]);
          if (result?.rowCount != null) {
            console.log(`[delete-test-events][${event.id}] ${step.label}: ${result.rowCount}`);
          }
        }
        await client.query("COMMIT");
        deletedEvents.push({ id: event.id, slug: event.slug, title: event.title });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[delete-test-events][${event.id}] Erro ao apagar:`, err?.message ?? err);
        throw err;
      } finally {
        client.release();
      }
    }
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const deletedPath = path.join(
    process.cwd(),
    "reports",
    `deleted_events_${dateTag}.json`,
  );
  fs.writeFileSync(
    deletedPath,
    JSON.stringify({ deletedAt: new Date().toISOString(), env: envName, deletedEvents }, null, 2),
  );

  console.log(`[delete-test-events] Removidos: ${deletedEvents.length}`);
  console.log(`[delete-test-events] Report: ${deletedPath}`);

  await pool.end();
}

main().catch((err) => {
  console.error("[delete-test-events] Erro:", err);
  process.exit(1);
});
