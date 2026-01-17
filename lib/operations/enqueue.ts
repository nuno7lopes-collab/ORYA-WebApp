import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type OperationStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "DEAD_LETTER";

type EnqueueParams = {
  operationType: string;
  dedupeKey: string;
  status?: OperationStatus;
  payload?: Record<string, unknown> | null;
  correlations?: {
    purchaseId?: string | null;
    paymentIntentId?: string | null;
    stripeEventId?: string | null;
    eventId?: number | null;
    organizationId?: number | null;
    pairingId?: number | null;
  };
};

/**
 * Upsert Operation with dedupe guarantees. Safe to call from ingest surfaces.
 * Uses raw SQL to avoid depending on generated Prisma types during rollout.
 */
export async function enqueueOperation(params: EnqueueParams) {
  const {
    operationType,
    dedupeKey,
    status = "PENDING",
    payload = {},
    correlations = {},
  } = params;

  const insert = async () =>
    prisma.$executeRaw(
      Prisma.sql`
          INSERT INTO app_v3.operations (
            operation_type,
            dedupe_key,
            status,
            attempts,
            payload,
            purchase_id,
            payment_intent_id,
            stripe_event_id,
            event_id,
            organization_id,
            pairing_id
          )
          VALUES (
            ${operationType},
            ${dedupeKey},
          ${status}::app_v3."OperationStatus",
            0,
            ${payload as Prisma.JsonObject}::jsonb,
            ${correlations.purchaseId ?? null},
            ${correlations.paymentIntentId ?? null},
            ${correlations.stripeEventId ?? null},
            ${correlations.eventId ?? null},
            ${correlations.organizationId ?? null},
            ${correlations.pairingId ?? null}
          )
          ON CONFLICT (dedupe_key)
          DO UPDATE SET
            status = EXCLUDED.status,
            payload = EXCLUDED.payload,
            updated_at = now(),
            purchase_id = COALESCE(operations.purchase_id, EXCLUDED.purchase_id),
            payment_intent_id = COALESCE(operations.payment_intent_id, EXCLUDED.payment_intent_id),
            stripe_event_id = COALESCE(operations.stripe_event_id, EXCLUDED.stripe_event_id),
            event_id = COALESCE(operations.event_id, EXCLUDED.event_id),
            organization_id = COALESCE(operations.organization_id, EXCLUDED.organization_id),
            pairing_id = COALESCE(operations.pairing_id, EXCLUDED.pairing_id);
        `,
    );

  try {
    await insert();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Auto-heal missing enum in case migrations não correram a tempo
    if (message.includes('OperationStatus')) {
      try {
        await prisma.$executeRawUnsafe(
          `DO $$ BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'OperationStatus' AND n.nspname = 'app_v3') THEN
               CREATE TYPE app_v3."OperationStatus" AS ENUM ('PENDING','RUNNING','SUCCEEDED','FAILED','DEAD_LETTER');
             END IF;
           END $$;`,
        );
        await insert();
        return;
      } catch (healErr) {
        console.error("[operations][enqueue] heal OperationStatus failed", { dedupeKey, healErr });
      }
    }
    console.error("[operations][enqueue] failed", { operationType, dedupeKey, err });
  }
}
