#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
require(path.join(__dirname, "load-env.js"));

const SOURCE_TYPES = (process.env.FINANCE_PROOF_SOURCE_TYPES ??
  "TICKET_ORDER,BOOKING,PADEL_REGISTRATION,STORE_ORDER")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const CYCLES_PER_SOURCE = Number(process.env.FINANCE_PROOF_CYCLES ?? "10");
const REFUND_RATIO = Number(process.env.FINANCE_PROOF_REFUND_RATIO ?? "0.5");
const RUN_TAG = process.env.FINANCE_PROOF_TAG ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");

if (!Number.isFinite(CYCLES_PER_SOURCE) || CYCLES_PER_SOURCE <= 0) {
  throw new Error("FINANCE_PROOF_CYCLES must be a positive number");
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL/DIRECT_URL missing");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

function deterministicCents(base, index, step = 37) {
  return base + index * step;
}

function buildPricingSnapshot(params) {
  return {
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    currency: "EUR",
    gross: params.grossCents,
    subtotal: params.grossCents,
    discount: 0,
    total: params.grossCents,
    platformFee: params.platformFeeCents,
    netToOrgPending: params.grossCents - params.platformFeeCents,
    feeMode: "ADDED",
    feePolicyVersion: "proof.v1",
    lines: [{ id: `${params.sourceId}:line:1`, qty: 1, unit: params.grossCents }],
  };
}

async function resolveContext() {
  const org = await client.query(
    `
      SELECT id
      FROM app_v3.organizations
      ORDER BY id ASC
      LIMIT 1
    `,
  );
  if (org.rowCount === 0) throw new Error("No organization found to seed proof cycles");

  const event = await client.query(
    `
      SELECT id
      FROM app_v3.events
      ORDER BY id ASC
      LIMIT 1
    `,
  );
  if (event.rowCount === 0) throw new Error("No event found to seed refund references");

  return { organizationId: Number(org.rows[0].id), refundEventId: Number(event.rows[0].id) };
}

async function createCycle(params) {
  const { sourceType, cycleIndex, organizationId, refundEventId, mode } = params;
  const createdAt = new Date();

  const suffix = `${RUN_TAG}_${sourceType}_${String(cycleIndex + 1).padStart(2, "0")}_${crypto
    .randomUUID()
    .slice(0, 8)}`;
  const paymentId = `proof_pay_${suffix}`;
  const sourceId = `proof_src_${suffix}`;
  const idempotencyKey = `proof_idem_${suffix}`;

  const grossCents = deterministicCents(12000, cycleIndex);
  const platformFeeCents = deterministicCents(1200, cycleIndex, 11);
  const processorFeesCents = deterministicCents(350, cycleIndex, 5);
  const disputeFeeCents = deterministicCents(180, cycleIndex, 3);
  const pricingSnapshot = buildPricingSnapshot({
    sourceType,
    sourceId,
    grossCents,
    platformFeeCents,
  });
  const pricingHash = crypto.createHash("sha256").update(JSON.stringify(pricingSnapshot)).digest("hex");

  const initialNet = grossCents - platformFeeCents - processorFeesCents;
  const finalStatus = mode === "REFUND" ? "REFUNDED" : "CHARGEBACK_LOST";
  const finalNet = mode === "REFUND" ? 0 : -(processorFeesCents + disputeFeeCents);

  const feesEventId = crypto.randomUUID();
  const statusEventId = crypto.randomUUID();
  const feesCausationId = `proof_fees_${suffix}`;
  const statusCausationId = `proof_status_${suffix}`;

  await client.query("BEGIN");
  try {
    await client.query(
      `
        INSERT INTO app_v3.payments (
          id,
          organization_id,
          source_type,
          source_id,
          customer_identity_id,
          status,
          fee_policy_version,
          pricing_snapshot_json,
          pricing_snapshot_hash,
          processor_fees_status,
          processor_fees_actual,
          idempotency_key,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3::app_v3."SourceType",
          $4,
          NULL,
          $5::app_v3."PaymentStatus",
          'proof.v1',
          $6::jsonb,
          $7,
          'FINAL'::app_v3."ProcessorFeesStatus",
          $8,
          $9,
          $10,
          $10
        )
      `,
      [
        paymentId,
        organizationId,
        sourceType,
        sourceId,
        finalStatus,
        JSON.stringify(pricingSnapshot),
        pricingHash,
        processorFeesCents,
        idempotencyKey,
        createdAt,
      ],
    );

    await client.query(
      `
        INSERT INTO app_v3.ledger_entries (
          payment_id,
          entry_type,
          amount,
          currency,
          source_type,
          source_id,
          causation_id,
          correlation_id,
          created_at
        )
        VALUES
          ($1, 'GROSS'::app_v3."LedgerEntryType", $2, 'EUR', $3::app_v3."SourceType", $4, $5, $1, $9),
          ($1, 'PLATFORM_FEE'::app_v3."LedgerEntryType", $6, 'EUR', $3::app_v3."SourceType", $4, $7, $1, $9),
          ($1, 'PROCESSOR_FEES_FINAL'::app_v3."LedgerEntryType", $8, 'EUR', $3::app_v3."SourceType", $4, $10, $1, $9)
      `,
      [
        paymentId,
        grossCents,
        sourceType,
        sourceId,
        `${feesCausationId}:gross`,
        -platformFeeCents,
        `${feesCausationId}:platform_fee`,
        -processorFeesCents,
        createdAt,
        `${feesCausationId}:processor_fee`,
      ],
    );

    if (mode === "REFUND") {
      const refundDedupeKey = `refund:${sourceType}:${paymentId}`;
      await client.query(
        `
          INSERT INTO app_v3.refunds (
            dedupe_key,
            purchase_id,
            payment_intent_id,
            event_id,
            base_amount_cents,
            fees_excluded_cents,
            reason,
            refunded_by,
            audit_payload,
            stripe_refund_id,
            refunded_at,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            NULL,
            $3,
            $4,
            $5,
            'CANCELLED'::app_v3."RefundReason",
            'finance-proof-script',
            $6::jsonb,
            NULL,
            $7,
            $7,
            $7
          )
        `,
        [
          refundDedupeKey,
          paymentId,
          refundEventId,
          Math.max(0, grossCents - platformFeeCents - processorFeesCents),
          platformFeeCents + processorFeesCents,
          JSON.stringify({ seeded: true, sourceType, runTag: RUN_TAG }),
          createdAt,
        ],
      );

      await client.query(
        `
          INSERT INTO app_v3.ledger_entries (
            payment_id,
            entry_type,
            amount,
            currency,
            source_type,
            source_id,
            causation_id,
            correlation_id,
            created_at
          )
          VALUES
            ($1, 'REFUND_GROSS'::app_v3."LedgerEntryType", $2, 'EUR', $3::app_v3."SourceType", $4, $5, $1, $8),
            ($1, 'REFUND_PLATFORM_FEE_REVERSAL'::app_v3."LedgerEntryType", $6, 'EUR', $3::app_v3."SourceType", $4, $7, $1, $8),
            ($1, 'REFUND_PROCESSOR_FEES_REVERSAL'::app_v3."LedgerEntryType", $9, 'EUR', $3::app_v3."SourceType", $4, $10, $1, $8)
        `,
        [
          paymentId,
          -grossCents,
          sourceType,
          sourceId,
          `${statusCausationId}:refund_gross`,
          platformFeeCents,
          `${statusCausationId}:refund_platform_fee`,
          createdAt,
          processorFeesCents,
          `${statusCausationId}:refund_processor_fee`,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO app_v3.ledger_entries (
            payment_id,
            entry_type,
            amount,
            currency,
            source_type,
            source_id,
            causation_id,
            correlation_id,
            created_at
          )
          VALUES
            ($1, 'CHARGEBACK_GROSS'::app_v3."LedgerEntryType", $2, 'EUR', $3::app_v3."SourceType", $4, $5, $1, $8),
            ($1, 'CHARGEBACK_PLATFORM_FEE_REVERSAL'::app_v3."LedgerEntryType", $6, 'EUR', $3::app_v3."SourceType", $4, $7, $1, $8),
            ($1, 'DISPUTE_FEE'::app_v3."LedgerEntryType", $9, 'EUR', $3::app_v3."SourceType", $4, $10, $1, $8)
        `,
        [
          paymentId,
          -grossCents,
          sourceType,
          sourceId,
          `${statusCausationId}:chargeback_gross`,
          platformFeeCents,
          `${statusCausationId}:chargeback_platform_fee`,
          createdAt,
          -disputeFeeCents,
          `${statusCausationId}:dispute_fee`,
        ],
      );
    }

    await client.query(
      `
        INSERT INTO app_v3.outbox_events (
          event_id,
          event_type,
          dedupe_key,
          payload,
          created_at,
          published_at,
          causation_id,
          correlation_id,
          first_seen_at,
          last_seen_at
        )
        VALUES (
          $1::uuid,
          'payment.fees.reconciled',
          $2,
          $3::jsonb,
          $4,
          $4,
          $5,
          $6,
          $4,
          $4
        )
      `,
      [
        feesEventId,
        `proof_outbox_fees:${suffix}:${crypto.randomUUID()}`,
        JSON.stringify({
          eventLogId: feesEventId,
          paymentId,
          processorFeesActual: processorFeesCents,
          netToOrgFinal: initialNet,
          orgId: organizationId,
          sourceType,
          sourceId,
        }),
        createdAt,
        feesCausationId,
        paymentId,
      ],
    );

    await client.query(
      `
        INSERT INTO app_v3.outbox_events (
          event_id,
          event_type,
          dedupe_key,
          payload,
          created_at,
          published_at,
          causation_id,
          correlation_id,
          first_seen_at,
          last_seen_at
        )
        VALUES (
          $1::uuid,
          'payment.status.changed',
          $2,
          $3::jsonb,
          $4,
          $4,
          $5,
          $6,
          $4,
          $4
        )
      `,
      [
        statusEventId,
        `proof_outbox_status:${suffix}:${crypto.randomUUID()}`,
        JSON.stringify({
          eventLogId: statusEventId,
          paymentId,
          status: finalStatus,
          source: "finance.seed.real.cycles",
          orgId: organizationId,
          sourceType,
          sourceId,
        }),
        createdAt,
        statusCausationId,
        paymentId,
      ],
    );

    await client.query(
      `
        INSERT INTO app_v3.payment_snapshots (
          payment_id,
          organization_id,
          source_type,
          source_id,
          status,
          currency,
          gross_cents,
          platform_fee_cents,
          processor_fees_cents,
          net_to_org_cents,
          last_event_id,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3::app_v3."SourceType",
          $4,
          $5::app_v3."PaymentStatus",
          'EUR',
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $11
        )
        ON CONFLICT (payment_id) DO UPDATE
        SET
          status = EXCLUDED.status,
          currency = EXCLUDED.currency,
          gross_cents = EXCLUDED.gross_cents,
          platform_fee_cents = EXCLUDED.platform_fee_cents,
          processor_fees_cents = EXCLUDED.processor_fees_cents,
          net_to_org_cents = EXCLUDED.net_to_org_cents,
          last_event_id = EXCLUDED.last_event_id,
          updated_at = EXCLUDED.updated_at
      `,
      [
        paymentId,
        organizationId,
        sourceType,
        sourceId,
        finalStatus,
        grossCents,
        platformFeeCents,
        processorFeesCents,
        finalNet,
        statusEventId,
        createdAt,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return { paymentId, sourceType, mode, finalStatus, finalNet };
}

async function main() {
  await client.connect();

  const { organizationId, refundEventId } = await resolveContext();
  const created = [];
  for (const sourceType of SOURCE_TYPES) {
    const refundTarget = Math.max(1, Math.round(CYCLES_PER_SOURCE * REFUND_RATIO));
    for (let i = 0; i < CYCLES_PER_SOURCE; i += 1) {
      const mode = i < refundTarget ? "REFUND" : "DISPUTE";
      const cycle = await createCycle({
        sourceType,
        cycleIndex: i,
        organizationId,
        refundEventId,
        mode,
      });
      created.push(cycle);
    }
  }

  const grouped = created.reduce((acc, row) => {
    if (!acc[row.sourceType]) acc[row.sourceType] = { total: 0, refund: 0, dispute: 0 };
    acc[row.sourceType].total += 1;
    if (row.mode === "REFUND") acc[row.sourceType].refund += 1;
    if (row.mode === "DISPUTE") acc[row.sourceType].dispute += 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        ok: true,
        runTag: RUN_TAG,
        organizationId,
        sourceTypes: SOURCE_TYPES,
        cyclesPerSource: CYCLES_PER_SOURCE,
        grouped,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[finance-seed-real-cycles] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
