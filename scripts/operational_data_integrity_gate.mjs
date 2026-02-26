#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

require(path.join(__dirname, "load-env.js"));

async function runGate() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[operational-data-integrity-gate] Missing DATABASE_URL/DIRECT_URL.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const summary = await client.query(`
      WITH booking_integrity AS (
        WITH mapped AS (
          SELECT
            p.id,
            CASE
              WHEN p.source_id ~ '^[0-9]+$' THEN p.source_id::int
              WHEN p.source_id ~ '^booking_[0-9]+_v[0-9]+$'
                THEN regexp_replace(p.source_id, '^booking_([0-9]+)_v[0-9]+$', '\\1')::int
              ELSE NULL
            END AS booking_id
          FROM app_v3.payments p
          WHERE p.source_type = 'BOOKING'
        )
        SELECT COUNT(*) FILTER (WHERE booking_id IS NULL OR b.id IS NULL)::int AS missing
        FROM mapped m
        LEFT JOIN app_v3.bookings b ON b.id = m.booking_id
      ),
      store_integrity AS (
        WITH mapped AS (
          SELECT
            p.id,
            CASE
              WHEN p.source_id ~ '^[0-9]+$' THEN p.source_id::int
              WHEN p.source_id ~ '^store_order_[0-9]+$'
                THEN regexp_replace(p.source_id, '^store_order_([0-9]+)$', '\\1')::int
              ELSE NULL
            END AS order_id
          FROM app_v3.payments p
          WHERE p.source_type = 'STORE_ORDER'
        )
        SELECT COUNT(*) FILTER (WHERE order_id IS NULL OR so.id IS NULL)::int AS missing
        FROM mapped m
        LEFT JOIN app_v3.store_orders so ON so.id = m.order_id
      ),
      padel_integrity AS (
        SELECT COUNT(*) FILTER (WHERE pr.id IS NULL)::int AS missing
        FROM app_v3.payments p
        LEFT JOIN app_v3.padel_registrations pr ON pr.id::text = p.source_id
        WHERE p.source_type = 'PADEL_REGISTRATION'
      ),
      ticket_integrity AS (
        WITH ss AS (
          SELECT purchase_id AS payment_id, MIN(event_id)::int AS event_id
          FROM app_v3.sale_summaries
          WHERE purchase_id IS NOT NULL
          GROUP BY purchase_id
        ),
        tk AS (
          SELECT purchase_id AS payment_id, MIN(event_id)::int AS event_id
          FROM app_v3.tickets
          WHERE purchase_id IS NOT NULL
          GROUP BY purchase_id
        ),
        mapped AS (
          SELECT
            p.id,
            p.source_id,
            COALESCE(
              ss.event_id,
              tk.event_id,
              CASE WHEN p.source_id ~ '^[0-9]+$' THEN p.source_id::int ELSE NULL END
            ) AS resolved_event_id
          FROM app_v3.payments p
          LEFT JOIN ss ON ss.payment_id = p.id
          LEFT JOIN tk ON tk.payment_id = p.id
          WHERE p.source_type = 'TICKET_ORDER'
        )
        SELECT
          COUNT(*) FILTER (WHERE resolved_event_id IS NULL OR e.id IS NULL)::int AS missing,
          COUNT(*) FILTER (
            WHERE resolved_event_id IS NOT NULL
              AND source_id <> resolved_event_id::text
          )::int AS non_canonical
        FROM mapped m
        LEFT JOIN app_v3.events e ON e.id = m.resolved_event_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM app_v3.operations WHERE status = 'FAILED') AS operations_failed,
        (SELECT COUNT(*)::int FROM app_v3.operations WHERE status = 'DEAD_LETTER') AS operations_dead_letter,
        (SELECT COUNT(*)::int FROM app_v3.outbox_events WHERE published_at IS NULL AND dead_lettered_at IS NULL) AS outbox_pending,
        (SELECT COUNT(*)::int FROM app_v3.outbox_events WHERE dead_lettered_at IS NOT NULL) AS outbox_dead_letter,
        (
          SELECT COUNT(*)::int
          FROM app_v3.payments p
          WHERE p.status IN ('SUCCEEDED', 'PARTIAL_REFUND', 'REFUNDED', 'DISPUTED', 'CHARGEBACK_WON', 'CHARGEBACK_LOST')
            AND NOT EXISTS (
              SELECT 1
              FROM app_v3.ledger_entries le
              WHERE le.payment_id = p.id
            )
        ) AS succeeded_missing_ledger,
        (
          SELECT COUNT(*)::int
          FROM app_v3.payments p
          WHERE p.status IN ('SUCCEEDED', 'PARTIAL_REFUND', 'REFUNDED', 'DISPUTED', 'CHARGEBACK_WON', 'CHARGEBACK_LOST')
            AND NOT EXISTS (
              SELECT 1
              FROM app_v3.payment_snapshots ps
              WHERE ps.payment_id = p.id
            )
        ) AS succeeded_missing_snapshot,
        (SELECT missing FROM booking_integrity) AS booking_source_missing,
        (SELECT missing FROM store_integrity) AS store_source_missing,
        (SELECT missing FROM padel_integrity) AS padel_source_missing,
        (SELECT missing FROM ticket_integrity) AS ticket_source_missing,
        (SELECT non_canonical FROM ticket_integrity) AS ticket_non_canonical,
        (
          SELECT COUNT(*)::int
          FROM app_v3.profiles p
          WHERE NOT EXISTS (
            SELECT 1
            FROM app_v3.user_identities ui
            WHERE ui.user_id = p.id
          )
        ) AS profiles_without_identity,
        (
          SELECT COUNT(*)::int
          FROM app_v3.search_index_items sii
          WHERE sii.source_type = 'EVENT'
            AND NOT EXISTS (
              SELECT 1
              FROM app_v3.events e
              WHERE e.id::text = sii.source_id
            )
        ) AS search_orphan_events
    `);

    const row = summary.rows[0] ?? {};
    const checks = [
      ["operations_failed", Number(row.operations_failed ?? 0)],
      ["operations_dead_letter", Number(row.operations_dead_letter ?? 0)],
      ["outbox_pending", Number(row.outbox_pending ?? 0)],
      ["outbox_dead_letter", Number(row.outbox_dead_letter ?? 0)],
      ["succeeded_missing_ledger", Number(row.succeeded_missing_ledger ?? 0)],
      ["succeeded_missing_snapshot", Number(row.succeeded_missing_snapshot ?? 0)],
      ["booking_source_missing", Number(row.booking_source_missing ?? 0)],
      ["store_source_missing", Number(row.store_source_missing ?? 0)],
      ["padel_source_missing", Number(row.padel_source_missing ?? 0)],
      ["ticket_source_missing", Number(row.ticket_source_missing ?? 0)],
      ["ticket_non_canonical", Number(row.ticket_non_canonical ?? 0)],
      ["profiles_without_identity", Number(row.profiles_without_identity ?? 0)],
      ["search_orphan_events", Number(row.search_orphan_events ?? 0)],
    ];

    const violations = checks.filter(([, value]) => value > 0);
    const result = {
      ok: violations.length === 0,
      summary: Object.fromEntries(checks),
      violations: violations.map(([name, value]) => ({ name, value })),
      generatedAt: new Date().toISOString(),
    };

    console.log(JSON.stringify(result, null, 2));

    if (violations.length > 0) {
      console.error("[operational-data-integrity-gate] FAIL");
      process.exit(1);
    }

    console.log("[operational-data-integrity-gate] PASS");
  } finally {
    await client.end();
  }
}

runGate().catch((error) => {
  console.error("[operational-data-integrity-gate] failed", error);
  process.exit(1);
});
