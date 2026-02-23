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
const MIN_REFUND_CYCLES = Number(process.env.FINANCE_MIN_REFUND_CYCLES ?? "1");
const MIN_DISPUTE_CYCLES = Number(process.env.FINANCE_MIN_DISPUTE_CYCLES ?? "1");
const LOOKBACK_DAYS = Number(process.env.FINANCE_LOOKBACK_DAYS ?? "30");
const DRIFT_TOLERANCE_CENTS = Number(process.env.FINANCE_DRIFT_TOLERANCE_CENTS ?? "1");
const MAX_DLQ_24H = Number(process.env.FINANCE_MAX_DLQ_24H ?? "0");
const MAX_PENDING_OUTBOX_OLDEST_MIN = Number(process.env.FINANCE_MAX_PENDING_OUTBOX_OLDEST_MIN ?? "15");
const STRICT_MODE = process.env.FINANCE_CYCLES_STRICT !== "0";
const REQUIRE_MIN_SCANNED = process.env.FINANCE_REQUIRE_MIN_SCANNED === "1";
const REQUIRE_STATUS_EVENT = process.env.FINANCE_REQUIRE_STATUS_EVENT === "1";

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
const STATUS_SUCCESS_VALUES = Array.from(STATUS_SUCCESS);

function toInt(value, fallback = 0) {
  if (value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function buildMarkdownReport(summary) {
  const lines = [];
  lines.push("# Finance Operational Gate");
  lines.push("");
  lines.push("## Config");
  lines.push(`- sourceTypes: ${SOURCE_TYPES.join(", ")}`);
  lines.push(`- minCyclesPerSourceType: ${MIN_CYCLES}`);
  lines.push(`- minRefundCyclesPerSourceType: ${MIN_REFUND_CYCLES}`);
  lines.push(`- minDisputeCyclesPerSourceType: ${MIN_DISPUTE_CYCLES}`);
  lines.push(`- lookbackDays: ${LOOKBACK_DAYS}`);
  lines.push(`- driftToleranceCents: ${DRIFT_TOLERANCE_CENTS}`);
  lines.push(`- requireMinScanned: ${REQUIRE_MIN_SCANNED ? "true" : "false"}`);
  lines.push(`- requireStatusEvent: ${REQUIRE_STATUS_EVENT ? "true" : "false"}`);
  lines.push(`- strictMode: ${STRICT_MODE ? "true" : "false"}`);
  lines.push("");
  lines.push("## Cycle Coverage");
  for (const row of summary.cycleRows) {
    lines.push(
      `- ${row.sourceType}: completed=${row.completedCycles}, refund=${row.refundCycles}, dispute=${row.disputeCycles}, scanned=${row.scannedPayments}, required=${MIN_CYCLES}, statusEvidence=${row.statusEvidenceCycles}, legacyAliases=${row.legacyAliasCycles}`,
    );
  }
  if (Array.isArray(summary.cycleNotes) && summary.cycleNotes.length > 0) {
    lines.push("- notes:");
    for (const note of summary.cycleNotes) {
      lines.push(`  - ${note}`);
    }
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
      payment_event_flags AS (
        SELECT
          purchase_id AS payment_id,
          BOOL_OR(status IS NOT NULL) AS has_payment_event
        FROM app_v3.payment_events
        WHERE purchase_id IS NOT NULL
        GROUP BY purchase_id
      ),
      ledger_counts AS (
        SELECT payment_id, COUNT(*)::int AS ledger_entries
        FROM app_v3.ledger_entries
        GROUP BY payment_id
      ),
      payment_rows AS (
        SELECT
          p.id,
          p.source_type::text AS source_type,
          p.source_id::text AS source_id,
          p.status::text AS status,
          p.processor_fees_status::text AS processor_fees_status,
          ps.payment_id IS NOT NULL AS has_snapshot,
          ps.gross_cents,
          COALESCE(lc.ledger_entries, 0) AS ledger_entries,
          COALESCE(ofg.has_fees_reconciled, FALSE) AS has_fees_reconciled,
          COALESCE(ofg.has_status_changed, FALSE) AS has_status_changed,
          COALESCE(pef.has_payment_event, FALSE) AS has_payment_event,
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
        LEFT JOIN payment_event_flags pef ON pef.payment_id = p.id
        LEFT JOIN payment_intents pi ON pi.purchase_id = p.id
        WHERE p.source_type::text = ANY($1::text[])
          AND p.created_at >= NOW() - ($2::text || ' days')::interval
      ),
      cycle_rows AS (
        SELECT
          source_type,
          source_id,
          CASE
            WHEN has_snapshot AND ledger_entries > 0 THEN id
            ELSE source_type || '::' || source_id
          END AS cycle_key,
          status,
          processor_fees_status,
          has_snapshot,
          gross_cents,
          ledger_entries,
          has_fees_reconciled,
          has_status_changed,
          has_payment_event,
          refund_count
        FROM payment_rows
      )
      SELECT
        source_type,
        cycle_key,
        COUNT(*)::int AS payment_aliases,
        BOOL_OR(status = ANY($3::text[])) AS has_success_status,
        BOOL_OR(has_snapshot) AS has_snapshot,
        BOOL_OR(ledger_entries > 0) AS has_ledger,
        BOOL_OR(
          processor_fees_status = 'FINAL'
          OR has_fees_reconciled
          OR COALESCE(gross_cents, 1) <= 0
        ) AS reconciled,
        BOOL_OR(has_status_changed) AS has_status_changed,
        BOOL_OR(has_payment_event) AS has_payment_event,
        BOOL_OR(refund_count > 0 OR status = ANY($4::text[])) AS is_refund_candidate,
        BOOL_OR(status = ANY($5::text[])) AS is_dispute_candidate
      FROM cycle_rows
      GROUP BY source_type, cycle_key
    `,
    [
      SOURCE_TYPES,
      String(LOOKBACK_DAYS),
      STATUS_SUCCESS_VALUES,
      Array.from(STATUS_REFUND),
      Array.from(STATUS_DISPUTE),
    ],
  );

  const rowsBySource = new Map(SOURCE_TYPES.map((sourceType) => [sourceType, []]));
  for (const row of result.rows) {
    if (!rowsBySource.has(row.source_type)) continue;
    rowsBySource.get(row.source_type).push(row);
  }

  return SOURCE_TYPES.map((sourceType) => {
    const rows = rowsBySource.get(sourceType) ?? [];
    const completed = rows.filter((row) => {
      if (!bool(row.has_success_status)) return false;
      const hasSnapshot = bool(row.has_snapshot);
      const hasLedger = bool(row.has_ledger);
      const hasStatusEvent = bool(row.has_status_changed);
      const hasPaymentEvent = bool(row.has_payment_event);
      const reconciled = bool(row.reconciled);
      const hasStatusEvidence = REQUIRE_STATUS_EVENT
        ? hasStatusEvent
        : hasStatusEvent || hasPaymentEvent || bool(row.has_success_status);
      return hasSnapshot && hasLedger && reconciled && hasStatusEvidence;
    });

    const refundCycles = completed.filter((row) => bool(row.is_refund_candidate)).length;
    const disputeCycles = completed.filter((row) => bool(row.is_dispute_candidate)).length;
    const refundCandidates = rows.filter((row) => bool(row.is_refund_candidate)).length;
    const disputeCandidates = rows.filter((row) => bool(row.is_dispute_candidate)).length;
    const statusEvidenceCycles = completed.filter((row) => {
      return (
        bool(row.has_status_changed) ||
        bool(row.has_payment_event) ||
        bool(row.has_success_status)
      );
    }).length;
    const legacyAliasCycles = rows.filter((row) => toInt(row.payment_aliases) > 1).length;

    return {
      sourceType,
      completedCycles: completed.length,
      refundCycles,
      disputeCycles,
      refundCandidates,
      disputeCandidates,
      statusEvidenceCycles,
      legacyAliasCycles,
      scannedPayments: rows.length,
    };
  });
}

async function queryDriftRows(client) {
  const result = await client.query(
    `
      WITH payment_state AS (
        SELECT
          p.source_type::text AS source_type,
          p.id,
          p.status::text AS status,
          p.source_id::text AS source_id,
          EXISTS (
            SELECT 1
            FROM app_v3.payment_snapshots ps
            WHERE ps.payment_id = p.id
          ) AS has_snapshot,
          EXISTS (
            SELECT 1
            FROM app_v3.ledger_entries le
            WHERE le.payment_id = p.id
          ) AS has_ledger,
          CASE
            WHEN EXISTS (SELECT 1 FROM app_v3.payment_snapshots ps WHERE ps.payment_id = p.id)
              AND EXISTS (SELECT 1 FROM app_v3.ledger_entries le WHERE le.payment_id = p.id)
            THEN p.id
            ELSE p.source_type::text || '::' || p.source_id::text
          END AS cycle_key
        FROM app_v3.payments p
        WHERE p.source_type::text = ANY($1::text[])
          AND p.created_at >= NOW() - ($2::text || ' days')::interval
      ),
      cycle_scope AS (
        SELECT
          source_type,
          cycle_key,
          BOOL_OR(status = ANY($4::text[])) AS has_success_status
        FROM payment_state
        GROUP BY source_type, cycle_key
      ),
      ledger_rollup AS (
        SELECT
          ps.source_type,
          ps.cycle_key,
          COALESCE(SUM(CASE WHEN le.entry_type = 'GROSS' THEN le.amount ELSE 0 END), 0)::int AS gross_from_ledger,
          ABS(COALESCE(SUM(CASE WHEN le.entry_type = 'PLATFORM_FEE' THEN le.amount ELSE 0 END), 0))::int AS platform_fee_from_ledger,
          ABS(COALESCE(SUM(CASE WHEN le.entry_type IN ('PROCESSOR_FEES_FINAL', 'PROCESSOR_FEES_ADJUSTMENT') THEN le.amount ELSE 0 END), 0))::int AS processor_fees_from_ledger,
          COALESCE(SUM(le.amount), 0)::int AS net_from_ledger
        FROM app_v3.ledger_entries le
        JOIN payment_state ps ON ps.id = le.payment_id
        GROUP BY ps.source_type, ps.cycle_key
      ),
      snapshot_ranked AS (
        SELECT
          ps2.source_type,
          ps2.cycle_key,
          ps.gross_cents,
          ps.platform_fee_cents,
          ps.processor_fees_cents,
          ps.net_to_org_cents,
          ROW_NUMBER() OVER (
            PARTITION BY ps2.source_type, ps2.cycle_key
            ORDER BY ps.updated_at DESC, ps.created_at DESC, ps.payment_id DESC
          ) AS row_no
        FROM app_v3.payment_snapshots ps
        JOIN payment_state ps2 ON ps2.id = ps.payment_id
      ),
      snapshots AS (
        SELECT
          source_type,
          cycle_key,
          gross_cents,
          platform_fee_cents,
          processor_fees_cents,
          net_to_org_cents
        FROM snapshot_ranked
        WHERE row_no = 1
      )
      SELECT
        cs.source_type,
        COUNT(*) FILTER (
          WHERE sp.cycle_key IS NOT NULL
            AND lr.cycle_key IS NOT NULL
            AND (
              (sp.gross_cents IS NOT NULL AND ABS(sp.gross_cents - lr.gross_from_ledger) > $3)
              OR (sp.platform_fee_cents IS NOT NULL AND ABS(sp.platform_fee_cents - lr.platform_fee_from_ledger) > $3)
              OR (sp.processor_fees_cents IS NOT NULL AND ABS(sp.processor_fees_cents - lr.processor_fees_from_ledger) > $3)
              OR (sp.net_to_org_cents IS NOT NULL AND ABS(sp.net_to_org_cents - lr.net_from_ledger) > $3)
            )
        )::int AS drift_count
      FROM cycle_scope cs
      LEFT JOIN snapshots sp
        ON sp.source_type = cs.source_type
       AND sp.cycle_key = cs.cycle_key
      LEFT JOIN ledger_rollup lr
        ON lr.source_type = cs.source_type
       AND lr.cycle_key = cs.cycle_key
      WHERE cs.has_success_status
      GROUP BY cs.source_type
    `,
    [SOURCE_TYPES, String(LOOKBACK_DAYS), DRIFT_TOLERANCE_CENTS, STATUS_SUCCESS_VALUES],
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
    const cycleNotes = [];
    for (const row of cycleRows) {
      const hasEnoughSample = row.scannedPayments >= MIN_CYCLES;
      if (REQUIRE_MIN_SCANNED && !hasEnoughSample) {
        violations.push(
          `sourceType ${row.sourceType} tem amostra insuficiente (${row.scannedPayments}/${MIN_CYCLES}).`,
        );
      } else if (!hasEnoughSample) {
        cycleNotes.push(
          `sourceType ${row.sourceType} com amostra parcial (${row.scannedPayments}/${MIN_CYCLES}); cobertura não bloqueante.`,
        );
      } else if (row.completedCycles < MIN_CYCLES) {
        violations.push(
          `sourceType ${row.sourceType} tem ${row.completedCycles}/${MIN_CYCLES} ciclos completos no lookback.`,
        );
      }

      if (row.refundCandidates > 0) {
        if (row.refundCycles < MIN_REFUND_CYCLES) {
          violations.push(
            `sourceType ${row.sourceType} tem ${row.refundCycles}/${MIN_REFUND_CYCLES} ciclos com refund no lookback.`,
          );
        }
      } else if (MIN_REFUND_CYCLES > 0) {
        cycleNotes.push(
          `sourceType ${row.sourceType} sem candidatos de refund no lookback (${LOOKBACK_DAYS}d).`,
        );
      }

      if (row.disputeCandidates > 0) {
        if (row.disputeCycles < MIN_DISPUTE_CYCLES) {
          violations.push(
            `sourceType ${row.sourceType} tem ${row.disputeCycles}/${MIN_DISPUTE_CYCLES} ciclos com dispute no lookback.`,
          );
        }
      } else if (MIN_DISPUTE_CYCLES > 0) {
        cycleNotes.push(
          `sourceType ${row.sourceType} sem candidatos de dispute no lookback (${LOOKBACK_DAYS}d).`,
        );
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
    const summary = { ok, cycleRows, cycleNotes, driftRows, alerts, hygiene, violations };

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
