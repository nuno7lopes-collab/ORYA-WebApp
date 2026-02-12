#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

require(path.join(__dirname, "load-env.js"));

const SOURCE_TYPES = (process.env.FINANCE_SOURCE_TYPES ??
  "TICKET_ORDER,BOOKING,PADEL_REGISTRATION,STORE_ORDER")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const MIN_CYCLES = Number(process.env.FINANCE_MIN_CYCLES ?? "10");
const LOOKBACK_DAYS = Number(process.env.FINANCE_LOOKBACK_DAYS ?? "30");
const DRIFT_TOLERANCE_CENTS = Number(process.env.FINANCE_DRIFT_TOLERANCE_CENTS ?? "1");
const MAX_DLQ_24H = Number(process.env.FINANCE_MAX_DLQ_24H ?? "0");
const MAX_PENDING_OUTBOX_OLDEST_MIN = Number(process.env.FINANCE_MAX_PENDING_OUTBOX_OLDEST_MIN ?? "15");
const STRICT_MODE = process.env.FINANCE_CYCLES_STRICT !== "0";

const STATUS_SUCCESS = new Set([
  "SUCCEEDED",
  "PARTIAL_REFUND",
  "REFUNDED",
  "DISPUTED",
  "CHARGEBACK_WON",
  "CHARGEBACK_LOST",
]);

const STATUS_REFUND = new Set(["PARTIAL_REFUND", "REFUNDED"]);
const STATUS_DISPUTE = new Set(["DISPUTED", "CHARGEBACK_WON", "CHARGEBACK_LOST"]);

function toInt(value, fallback = 0) {
  if (value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isFreeLikeGross(value) {
  if (value == null) return false;
  const num = Number(value);
  return Number.isFinite(num) && num <= 0;
}

function buildMarkdownReport(summary) {
  const lines = [];
  lines.push("# Finance Operational Gate");
  lines.push("");
  lines.push("## Config");
  lines.push(`- sourceTypes: ${SOURCE_TYPES.join(", ")}`);
  lines.push(`- minCyclesPerSourceType: ${MIN_CYCLES}`);
  lines.push(`- lookbackDays: ${LOOKBACK_DAYS}`);
  lines.push(`- driftToleranceCents: ${DRIFT_TOLERANCE_CENTS}`);
  lines.push(`- strictMode: ${STRICT_MODE ? "true" : "false"}`);
  lines.push("");
  lines.push("## Cycle Coverage");
  for (const row of summary.cycleRows) {
    lines.push(
      `- ${row.sourceType}: completed=${row.completedCycles}, refund=${row.refundCycles}, dispute=${row.disputeCycles}, required=${MIN_CYCLES}`,
    );
  }
  lines.push("");
  lines.push("## Drift");
  for (const row of summary.driftRows) {
    lines.push(`- ${row.sourceType}: drift=${row.driftCount}`);
  }
  lines.push("");
  lines.push("## Queue/Alerts");
  lines.push(`- DLQ total: ${summary.alerts.dlqTotal}`);
  lines.push(`- DLQ last 24h: ${summary.alerts.dlq24h}`);
  lines.push(`- Outbox pending: ${summary.alerts.pendingOutbox}`);
  lines.push(`- Pending oldest (min): ${summary.alerts.pendingOldestMinutes}`);
  lines.push(`- ORG_NOT_RESOLVED last 7d: ${summary.alerts.orgNotResolved7d}`);
  lines.push("");
  lines.push("## Hygiene");
  lines.push(`- Non-canonical payload hits: ${summary.hygiene.nonCanonicalPayloadHits}`);
  lines.push(`- Entitlement policy violations: ${summary.hygiene.badPolicy}`);
  if (
    Array.isArray(summary.hygiene.nonCanonicalSamples) &&
    summary.hygiene.nonCanonicalSamples.length > 0
  ) {
    lines.push("- Non-canonical payload sample events:");
    for (const sample of summary.hygiene.nonCanonicalSamples) {
      lines.push(`  - ${sample.eventType} (${sample.eventId}) @ ${sample.createdAt}`);
    }
  }
  lines.push("");
  lines.push("## Result");
  lines.push(`- status: ${summary.ok ? "PASS" : "FAIL"}`);
  if (!summary.ok) {
    lines.push("- violations:");
    for (const violation of summary.violations) {
      lines.push(`  - ${violation}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function queryCycleRows(client) {
  const result = await client.query(
    `
      WITH payment_intents AS (
        SELECT
          purchase_id,
          MAX(stripe_payment_intent_id) FILTER (WHERE stripe_payment_intent_id IS NOT NULL) AS payment_intent_id
        FROM app_v3.payment_events
        WHERE purchase_id IS NOT NULL
        GROUP BY purchase_id
      ),
      outbox_flags AS (
        SELECT
          payload->>'paymentId' AS payment_id,
          BOOL_OR(event_type = 'payment.fees.reconciled') AS has_fees_reconciled,
          BOOL_OR(event_type = 'payment.status.changed') AS has_status_changed
        FROM app_v3.outbox_events
        WHERE payload ? 'paymentId'
        GROUP BY payload->>'paymentId'
      ),
      ledger_counts AS (
        SELECT payment_id, COUNT(*)::int AS ledger_entries
        FROM app_v3.ledger_entries
        GROUP BY payment_id
      )
      SELECT
        p.id,
        p.source_type::text AS source_type,
        p.status::text AS status,
        p.processor_fees_status::text AS processor_fees_status,
        p.created_at,
        ps.payment_id IS NOT NULL AS has_snapshot,
        ps.gross_cents,
        COALESCE(lc.ledger_entries, 0) AS ledger_entries,
        COALESCE(ofg.has_fees_reconciled, FALSE) AS has_fees_reconciled,
        COALESCE(ofg.has_status_changed, FALSE) AS has_status_changed,
        (
          SELECT COUNT(*)::int
          FROM app_v3.refunds r
          WHERE r.purchase_id = p.id
             OR (pi.payment_intent_id IS NOT NULL AND r.payment_intent_id = pi.payment_intent_id)
        ) AS refund_count
      FROM app_v3.payments p
      LEFT JOIN app_v3.payment_snapshots ps ON ps.payment_id = p.id
      LEFT JOIN ledger_counts lc ON lc.payment_id = p.id
      LEFT JOIN outbox_flags ofg ON ofg.payment_id = p.id
      LEFT JOIN payment_intents pi ON pi.purchase_id = p.id
      WHERE p.source_type::text = ANY($1::text[])
        AND p.created_at >= NOW() - ($2::text || ' days')::interval
    `,
    [SOURCE_TYPES, String(LOOKBACK_DAYS)],
  );

  const rowsBySource = new Map(SOURCE_TYPES.map((sourceType) => [sourceType, []]));
  for (const row of result.rows) {
    if (!rowsBySource.has(row.source_type)) continue;
    rowsBySource.get(row.source_type).push(row);
  }

  return SOURCE_TYPES.map((sourceType) => {
    const rows = rowsBySource.get(sourceType) ?? [];
    const completed = rows.filter((row) => {
      const status = String(row.status ?? "");
      if (!STATUS_SUCCESS.has(status)) return false;
      const hasSnapshot = bool(row.has_snapshot);
      const hasLedger = toInt(row.ledger_entries) > 0;
      const hasStatusEvent = bool(row.has_status_changed);
      const reconciled =
        String(row.processor_fees_status ?? "") === "FINAL" ||
        bool(row.has_fees_reconciled) ||
        isFreeLikeGross(row.gross_cents);
      const hasRefund = toInt(row.refund_count) > 0 || STATUS_REFUND.has(status);
      const hasDispute = STATUS_DISPUTE.has(status);
      return hasSnapshot && hasLedger && hasStatusEvent && reconciled && (hasRefund || hasDispute);
    });

    const refundCycles = completed.filter((row) => {
      const status = String(row.status ?? "");
      return toInt(row.refund_count) > 0 || STATUS_REFUND.has(status);
    }).length;

    const disputeCycles = completed.filter((row) => STATUS_DISPUTE.has(String(row.status ?? ""))).length;

    return {
      sourceType,
      completedCycles: completed.length,
      refundCycles,
      disputeCycles,
      scannedPayments: rows.length,
    };
  });
}

async function queryDriftRows(client) {
  const result = await client.query(
    `
      WITH ledger_rollup AS (
        SELECT
          payment_id,
          COALESCE(SUM(CASE WHEN entry_type = 'GROSS' THEN amount ELSE 0 END), 0)::int AS gross_from_ledger,
          ABS(COALESCE(SUM(CASE WHEN entry_type = 'PLATFORM_FEE' THEN amount ELSE 0 END), 0))::int AS platform_fee_from_ledger,
          ABS(COALESCE(SUM(CASE WHEN entry_type IN ('PROCESSOR_FEES_FINAL', 'PROCESSOR_FEES_ADJUSTMENT') THEN amount ELSE 0 END), 0))::int AS processor_fees_from_ledger,
          COALESCE(SUM(amount), 0)::int AS net_from_ledger
        FROM app_v3.ledger_entries
        GROUP BY payment_id
      )
      SELECT
        p.source_type::text AS source_type,
        COUNT(*) FILTER (
          WHERE ps.payment_id IS NOT NULL
            AND lr.payment_id IS NOT NULL
            AND (
              (ps.gross_cents IS NOT NULL AND ABS(ps.gross_cents - lr.gross_from_ledger) > $3)
              OR (ps.platform_fee_cents IS NOT NULL AND ABS(ps.platform_fee_cents - lr.platform_fee_from_ledger) > $3)
              OR (ps.processor_fees_cents IS NOT NULL AND ABS(ps.processor_fees_cents - lr.processor_fees_from_ledger) > $3)
              OR (ps.net_to_org_cents IS NOT NULL AND ABS(ps.net_to_org_cents - lr.net_from_ledger) > $3)
            )
        )::int AS drift_count
      FROM app_v3.payments p
      LEFT JOIN app_v3.payment_snapshots ps ON ps.payment_id = p.id
      LEFT JOIN ledger_rollup lr ON lr.payment_id = p.id
      WHERE p.source_type::text = ANY($1::text[])
        AND p.created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY p.source_type::text
    `,
    [SOURCE_TYPES, String(LOOKBACK_DAYS), DRIFT_TOLERANCE_CENTS],
  );

  const rowMap = new Map(result.rows.map((row) => [row.source_type, row]));
  return SOURCE_TYPES.map((sourceType) => ({
    sourceType,
    driftCount: toInt(rowMap.get(sourceType)?.drift_count),
  }));
}

async function queryAlerts(client) {
  const result = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE dead_lettered_at IS NOT NULL)::int AS dlq_total,
      COUNT(*) FILTER (WHERE dead_lettered_at IS NOT NULL AND created_at > NOW() - interval '24 hours')::int AS dlq_24h,
      COUNT(*) FILTER (WHERE published_at IS NULL AND dead_lettered_at IS NULL)::int AS pending_outbox,
      COALESCE(
        ROUND(
          EXTRACT(EPOCH FROM NOW() - MIN(created_at) FILTER (WHERE published_at IS NULL AND dead_lettered_at IS NULL)) / 60.0
        ),
        0
      )::int AS pending_oldest_minutes,
      COUNT(*) FILTER (
        WHERE dead_lettered_at IS NOT NULL
          AND reason_code = 'ORG_NOT_RESOLVED'
          AND created_at > NOW() - interval '7 days'
      )::int AS org_not_resolved_7d
    FROM app_v3.outbox_events
  `);
  const row = result.rows[0] ?? {};
  return {
    dlqTotal: toInt(row.dlq_total),
    dlq24h: toInt(row.dlq_24h),
    pendingOutbox: toInt(row.pending_outbox),
    pendingOldestMinutes: toInt(row.pending_oldest_minutes),
    orgNotResolved7d: toInt(row.org_not_resolved_7d),
  };
}

async function queryHygiene(client) {
  const nonCanonicalPayload = await client.query(
    `
      SELECT
        COUNT(*)::int AS count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'eventId', event_id,
              'eventType', event_type,
              'createdAt', created_at
            )
            ORDER BY created_at DESC
          ) FILTER (WHERE true),
          '[]'::json
        ) AS samples
      FROM (
        SELECT event_id, event_type, created_at
        FROM app_v3.outbox_events
        WHERE created_at >= NOW() - ($1::text || ' days')::interval
          AND event_type IN ('payment.created', 'payment.status.changed', 'payment.fees.reconciled')
          AND (
            payload ? 'organizationId'
            OR (payload ? 'feeMode' AND payload->>'feeMode' IN ('ON_TOP', 'ABSORBED'))
          )
        ORDER BY created_at DESC
        LIMIT 10
      ) s
    `,
    [String(LOOKBACK_DAYS)],
  );

  const badPolicy = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM app_v3.entitlements
    WHERE (event_id IS NOT NULL AND (policy_version_applied IS NULL OR policy_version_applied <= 0))
       OR (event_id IS NULL AND policy_version_applied IS NOT NULL)
  `);

  return {
    nonCanonicalPayloadHits: toInt(nonCanonicalPayload.rows[0]?.count),
    nonCanonicalSamples: nonCanonicalPayload.rows[0]?.samples ?? [],
    badPolicy: toInt(badPolicy.rows[0]?.count),
  };
}

async function run() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[finance-operational-gate] DATABASE_URL/DIRECT_URL missing.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const [cycleRows, driftRows, alerts, hygiene] = await Promise.all([
      queryCycleRows(client),
      queryDriftRows(client),
      queryAlerts(client),
      queryHygiene(client),
    ]);

    const violations = [];
    for (const row of cycleRows) {
      if (row.completedCycles < MIN_CYCLES) {
        violations.push(
          `sourceType ${row.sourceType} tem ${row.completedCycles}/${MIN_CYCLES} ciclos completos no lookback.`,
        );
      }
      if (row.refundCycles < 1) {
        violations.push(`sourceType ${row.sourceType} não tem ciclo com refund no lookback.`);
      }
      if (row.disputeCycles < 1) {
        violations.push(`sourceType ${row.sourceType} não tem ciclo com dispute no lookback.`);
      }
    }

    for (const row of driftRows) {
      if (row.driftCount > 0) {
        violations.push(`sourceType ${row.sourceType} tem drift ledger/snapshot (${row.driftCount}).`);
      }
    }

    if (alerts.dlq24h > MAX_DLQ_24H) {
      violations.push(`DLQ nas últimas 24h acima do limite: ${alerts.dlq24h} > ${MAX_DLQ_24H}.`);
    }

    if (alerts.pendingOldestMinutes > MAX_PENDING_OUTBOX_OLDEST_MIN) {
      violations.push(
        `Outbox pendente com lag acima do limite: ${alerts.pendingOldestMinutes}min > ${MAX_PENDING_OUTBOX_OLDEST_MIN}min.`,
      );
    }

    if (hygiene.nonCanonicalPayloadHits > 0) {
      violations.push(
        `Foram encontrados payloads não canónicos no outbox: ${hygiene.nonCanonicalPayloadHits}.`,
      );
    }

    if (hygiene.badPolicy > 0) {
      violations.push(`Foram encontrados entitlements com policy inválida: ${hygiene.badPolicy}.`);
    }

    const ok = violations.length === 0;
    const summary = { ok, cycleRows, driftRows, alerts, hygiene, violations };

    console.log(JSON.stringify(summary, null, 2));
    console.log("");
    console.log(buildMarkdownReport(summary));

    if (!ok && STRICT_MODE) {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("[finance-operational-gate] failed", error);
  process.exit(1);
});
