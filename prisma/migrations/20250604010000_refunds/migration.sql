-- Refunds table for idempotent, audited refunds
DO $$
BEGIN
  CREATE TYPE app_v3."RefundReason" AS ENUM ('CANCELLED', 'DELETED', 'DATE_CHANGED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

CREATE TABLE IF NOT EXISTS app_v3.refunds (
  id                SERIAL PRIMARY KEY,
  dedupe_key        TEXT NOT NULL UNIQUE,
  purchase_id       UUID,
  payment_intent_id TEXT,
  event_id          INTEGER NOT NULL,
  base_amount_cents INTEGER NOT NULL DEFAULT 0,
  fees_excluded_cents INTEGER NOT NULL DEFAULT 0,
  reason            app_v3."RefundReason" NOT NULL,
  refunded_by       TEXT,
  refunded_at       TIMESTAMPTZ(6) DEFAULT now(),
  stripe_refund_id  TEXT,
  audit_payload     JSONB,
  created_at        TIMESTAMPTZ(6) DEFAULT now(),
  updated_at        TIMESTAMPTZ(6) DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refunds_event_idx ON app_v3.refunds (event_id);
CREATE INDEX IF NOT EXISTS refunds_purchase_idx ON app_v3.refunds (purchase_id);
CREATE INDEX IF NOT EXISTS refunds_payment_intent_idx ON app_v3.refunds (payment_intent_id);
