#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

require(path.join(__dirname, "load-env.js"));

const DRIFT_TOLERANCE_CENTS = Number(process.env.FINANCE_DRIFT_TOLERANCE_CENTS ?? "1");
const STATUS_SUCCESS_VALUES = [
  "SUCCEEDED",
  "PARTIAL_REFUND",
  "REFUNDED",
  "DISPUTED",
  "CHARGEBACK_WON",
  "CHARGEBACK_LOST",
];

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const APPLY = hasFlag("--apply");
const CREATE_UNIQUE_INDEX = hasFlag("--create-index");
const JSON_OUTPUT = hasFlag("--json");

async function queryDuplicateStats(client) {
  const result = await client.query(`
    SELECT
      COUNT(*)::int AS duplicate_groups,
      COALESCE(SUM(group_size - 1), 0)::int AS duplicate_rows
    FROM (
      SELECT payment_id, causation_id, COUNT(*)::int AS group_size
      FROM app_v3.ledger_entries
      GROUP BY payment_id, causation_id
      HAVING COUNT(*) > 1
    ) d
  `);
  return {
    duplicateGroups: Number(result.rows[0]?.duplicate_groups ?? 0),
    duplicateRows: Number(result.rows[0]?.duplicate_rows ?? 0),
  };
}

async function queryAliasStats(client) {
  const result = await client.query(`
    SELECT
      COUNT(*)::int AS alias_groups,
      COALESCE(SUM(group_size - 1), 0)::int AS alias_rows
    FROM (
      SELECT
        organization_id,
        source_type,
        source_id,
        COUNT(*)::int AS group_size
      FROM app_v3.payments
      GROUP BY organization_id, source_type, source_id
      HAVING COUNT(*) > 1
    ) d
  `);
  return {
    aliasGroups: Number(result.rows[0]?.alias_groups ?? 0),
    aliasRows: Number(result.rows[0]?.alias_rows ?? 0),
  };
}

async function queryDriftStats(client) {
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
      ),
      cycle_scope AS (
        SELECT
          source_type,
          cycle_key,
          BOOL_OR(status = ANY($1::text[])) AS has_success_status
        FROM payment_state
        GROUP BY source_type, cycle_key
      ),
      ledger_rollup AS (
        SELECT
          ps.source_type,
          ps.cycle_key,
          COALESCE(SUM(CASE WHEN entry_type = 'GROSS' THEN amount ELSE 0 END), 0)::int AS gross_from_ledger,
          ABS(COALESCE(SUM(CASE WHEN entry_type = 'PLATFORM_FEE' THEN amount ELSE 0 END), 0))::int AS platform_fee_from_ledger,
          ABS(COALESCE(SUM(CASE WHEN entry_type IN ('PROCESSOR_FEES_FINAL', 'PROCESSOR_FEES_ADJUSTMENT') THEN amount ELSE 0 END), 0))::int AS processor_fees_from_ledger,
          COALESCE(SUM(amount), 0)::int AS net_from_ledger
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
      SELECT COUNT(*)::int AS drift_count
      FROM cycle_scope cs
      LEFT JOIN snapshots sp
        ON sp.source_type = cs.source_type
       AND sp.cycle_key = cs.cycle_key
      LEFT JOIN ledger_rollup lr
        ON lr.source_type = cs.source_type
       AND lr.cycle_key = cs.cycle_key
      WHERE cs.has_success_status
        AND sp.cycle_key IS NOT NULL
        AND lr.cycle_key IS NOT NULL
        AND (
          (sp.gross_cents IS NOT NULL AND ABS(sp.gross_cents - lr.gross_from_ledger) > $2)
          OR (sp.platform_fee_cents IS NOT NULL AND ABS(sp.platform_fee_cents - lr.platform_fee_from_ledger) > $2)
          OR (sp.processor_fees_cents IS NOT NULL AND ABS(sp.processor_fees_cents - lr.processor_fees_from_ledger) > $2)
          OR (sp.net_to_org_cents IS NOT NULL AND ABS(sp.net_to_org_cents - lr.net_from_ledger) > $2)
        )
    `,
    [
      STATUS_SUCCESS_VALUES,
      DRIFT_TOLERANCE_CENTS,
    ],
  );
  return Number(result.rows[0]?.drift_count ?? 0);
}

async function dedupeLedgerEntries(client) {
  const result = await client.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY payment_id, causation_id
          ORDER BY id ASC
        ) AS row_no
      FROM app_v3.ledger_entries
    )
    DELETE FROM app_v3.ledger_entries le
    USING ranked r
    WHERE le.id = r.id
      AND r.row_no > 1
  `);
  return result.rowCount ?? 0;
}

async function rebuildSnapshotsFromLedger(client) {
  const result = await client.query(`
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
    UPDATE app_v3.payment_snapshots ps
    SET
      gross_cents = lr.gross_from_ledger,
      platform_fee_cents = lr.platform_fee_from_ledger,
      processor_fees_cents = lr.processor_fees_from_ledger,
      net_to_org_cents = lr.net_from_ledger,
      updated_at = NOW()
    FROM ledger_rollup lr
    WHERE ps.payment_id = lr.payment_id
      AND (
        COALESCE(ps.gross_cents, 0) <> lr.gross_from_ledger
        OR COALESCE(ps.platform_fee_cents, 0) <> lr.platform_fee_from_ledger
        OR COALESCE(ps.processor_fees_cents, 0) <> lr.processor_fees_from_ledger
        OR COALESCE(ps.net_to_org_cents, 0) <> lr.net_from_ledger
      )
  `);
  return result.rowCount ?? 0;
}

async function rebuildSnapshotsFromSourceLedger(client) {
  const result = await client.query(`
    WITH alias_candidates AS (
      SELECT
        p.source_type::text AS source_type,
        p.source_id::text AS source_id
      FROM app_v3.payments p
      LEFT JOIN app_v3.payment_snapshots ps ON ps.payment_id = p.id
      LEFT JOIN LATERAL (
        SELECT 1 AS has_ledger
        FROM app_v3.ledger_entries le
        WHERE le.payment_id = p.id
        LIMIT 1
      ) le ON TRUE
      GROUP BY p.source_type::text, p.source_id::text
      HAVING COUNT(*) > 1
         AND BOOL_OR(ps.payment_id IS NOT NULL)
         AND BOOL_OR(le.has_ledger = 1)
         AND NOT BOOL_OR(ps.payment_id IS NOT NULL AND le.has_ledger = 1)
    ),
    source_rollup AS (
      SELECT
        p.source_type::text AS source_type,
        p.source_id::text AS source_id,
        COALESCE(SUM(CASE WHEN le.entry_type = 'GROSS' THEN le.amount ELSE 0 END), 0)::int AS gross_from_ledger,
        ABS(COALESCE(SUM(CASE WHEN le.entry_type = 'PLATFORM_FEE' THEN le.amount ELSE 0 END), 0))::int AS platform_fee_from_ledger,
        ABS(COALESCE(SUM(CASE WHEN le.entry_type IN ('PROCESSOR_FEES_FINAL', 'PROCESSOR_FEES_ADJUSTMENT') THEN le.amount ELSE 0 END), 0))::int AS processor_fees_from_ledger,
        COALESCE(SUM(le.amount), 0)::int AS net_from_ledger
      FROM app_v3.ledger_entries le
      JOIN app_v3.payments p ON p.id = le.payment_id
      JOIN alias_candidates ac
        ON ac.source_type = p.source_type::text
       AND ac.source_id = p.source_id::text
      GROUP BY p.source_type::text, p.source_id::text
    ),
    targets AS (
      SELECT
        ps.payment_id,
        sr.gross_from_ledger,
        sr.platform_fee_from_ledger,
        sr.processor_fees_from_ledger,
        sr.net_from_ledger
      FROM app_v3.payment_snapshots ps
      JOIN app_v3.payments p ON p.id = ps.payment_id
      JOIN source_rollup sr
        ON sr.source_type = p.source_type::text
       AND sr.source_id = p.source_id::text
    )
    UPDATE app_v3.payment_snapshots ps
    SET
      gross_cents = t.gross_from_ledger,
      platform_fee_cents = t.platform_fee_from_ledger,
      processor_fees_cents = t.processor_fees_from_ledger,
      net_to_org_cents = t.net_from_ledger,
      updated_at = NOW()
    FROM targets t
    WHERE ps.payment_id = t.payment_id
      AND (
        COALESCE(ps.gross_cents, 0) <> t.gross_from_ledger
        OR COALESCE(ps.platform_fee_cents, 0) <> t.platform_fee_from_ledger
        OR COALESCE(ps.processor_fees_cents, 0) <> t.processor_fees_from_ledger
        OR COALESCE(ps.net_to_org_cents, 0) <> t.net_from_ledger
      )
  `);
  return result.rowCount ?? 0;
}

async function ensureLedgerUniqueIndex(client) {
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_causation_unique
      ON app_v3.ledger_entries (payment_id, causation_id)
  `);
}

async function run() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[finance-ledger-hygiene] DATABASE_URL/DIRECT_URL missing.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const beforeDuplicates = await queryDuplicateStats(client);
    const beforeAliases = await queryAliasStats(client);
    const beforeDrift = await queryDriftStats(client);

    let removedDuplicateRows = 0;
    let updatedSnapshots = 0;
    let updatedSourceSnapshots = 0;
    let indexEnsured = false;

    if (APPLY) {
      removedDuplicateRows = await dedupeLedgerEntries(client);
      updatedSnapshots = await rebuildSnapshotsFromLedger(client);
      updatedSourceSnapshots = await rebuildSnapshotsFromSourceLedger(client);
      if (CREATE_UNIQUE_INDEX) {
        await ensureLedgerUniqueIndex(client);
        indexEnsured = true;
      }
    }

    const afterDuplicates = await queryDuplicateStats(client);
    const afterAliases = await queryAliasStats(client);
    const afterDrift = await queryDriftStats(client);

    const summary = {
      ok: afterDuplicates.duplicateRows === 0,
      apply: APPLY,
      indexRequested: CREATE_UNIQUE_INDEX,
      indexEnsured,
      before: {
        ...beforeDuplicates,
        ...beforeAliases,
        driftCount: beforeDrift,
      },
      actions: {
        removedDuplicateRows,
        updatedSnapshots,
        updatedSourceSnapshots,
      },
      after: {
        ...afterDuplicates,
        ...afterAliases,
        driftCount: afterDrift,
      },
    };

    if (JSON_OUTPUT) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log("# Finance Ledger Hygiene");
      console.log(`- mode: ${APPLY ? "APPLY" : "DRY_RUN"}`);
      console.log(`- unique index requested: ${CREATE_UNIQUE_INDEX ? "yes" : "no"}`);
      console.log(
        `- before: duplicateGroups=${beforeDuplicates.duplicateGroups} duplicateRows=${beforeDuplicates.duplicateRows} aliasGroups=${beforeAliases.aliasGroups} aliasRows=${beforeAliases.aliasRows} drift=${beforeDrift}`,
      );
      console.log(
        `- actions: removedDuplicateRows=${removedDuplicateRows} updatedSnapshots=${updatedSnapshots} updatedSourceSnapshots=${updatedSourceSnapshots} indexEnsured=${indexEnsured}`,
      );
      console.log(
        `- after: duplicateGroups=${afterDuplicates.duplicateGroups} duplicateRows=${afterDuplicates.duplicateRows} aliasGroups=${afterAliases.aliasGroups} aliasRows=${afterAliases.aliasRows} drift=${afterDrift}`,
      );
      console.log(`- status: ${summary.ok ? "OK" : "PENDING"}`);
    }

    if (!summary.ok) {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("[finance-ledger-hygiene] failed", error);
  process.exit(1);
});
