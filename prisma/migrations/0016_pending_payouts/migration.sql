DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PendingPayoutStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PendingPayoutStatus" AS ENUM ('HELD', 'RELEASING', 'RELEASED', 'BLOCKED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.pending_payouts (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  charge_id TEXT,
  recipient_connect_account_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  fee_mode app_v3."FeeMode" NOT NULL,
  amount_cents INTEGER NOT NULL,
  hold_until TIMESTAMPTZ NOT NULL,
  status app_v3."PendingPayoutStatus" NOT NULL DEFAULT 'HELD',
  blocked_reason TEXT,
  released_at TIMESTAMPTZ,
  transfer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_payouts_payment_intent_id_key
  ON app_v3.pending_payouts (payment_intent_id);

CREATE INDEX IF NOT EXISTS pending_payouts_status_hold_idx
  ON app_v3.pending_payouts (status, hold_until);

CREATE INDEX IF NOT EXISTS pending_payouts_recipient_idx
  ON app_v3.pending_payouts (recipient_connect_account_id);
