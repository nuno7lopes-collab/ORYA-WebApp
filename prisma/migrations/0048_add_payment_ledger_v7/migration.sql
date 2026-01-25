DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PaymentStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PaymentStatus" AS ENUM (
      'CREATED',
      'REQUIRES_ACTION',
      'PROCESSING',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'PARTIAL_REFUND',
      'REFUNDED',
      'DISPUTED',
      'CHARGEBACK_WON',
      'CHARGEBACK_LOST'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ProcessorFeesStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ProcessorFeesStatus" AS ENUM ('PENDING', 'FINAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'LedgerEntryType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."LedgerEntryType" AS ENUM (
      'GROSS',
      'PLATFORM_FEE',
      'PROCESSOR_FEES_FINAL',
      'PROCESSOR_FEES_ADJUSTMENT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SourceType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."SourceType" AS ENUM (
      'TICKET_ORDER',
      'BOOKING',
      'PADEL_REGISTRATION',
      'STORE_ORDER',
      'SUBSCRIPTION',
      'MEMBERSHIP'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.payments (
  id text PRIMARY KEY,
  organization_id integer NOT NULL,
  source_type app_v3."SourceType" NOT NULL,
  source_id text NOT NULL,
  customer_identity_id uuid,
  status app_v3."PaymentStatus" NOT NULL DEFAULT 'CREATED',
  fee_policy_version text NOT NULL,
  pricing_snapshot_json jsonb NOT NULL,
  pricing_snapshot_hash text,
  processor_fees_status app_v3."ProcessorFeesStatus" NOT NULL DEFAULT 'PENDING',
  processor_fees_actual integer,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_organization_fk FOREIGN KEY (organization_id)
    REFERENCES app_v3.organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_unique
  ON app_v3.payments (idempotency_key);

CREATE INDEX IF NOT EXISTS payments_org_idx
  ON app_v3.payments (organization_id);

CREATE INDEX IF NOT EXISTS payments_source_idx
  ON app_v3.payments (source_type, source_id);

CREATE TABLE IF NOT EXISTS app_v3.ledger_entries (
  id serial PRIMARY KEY,
  payment_id text NOT NULL,
  entry_type app_v3."LedgerEntryType" NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL,
  source_type app_v3."SourceType" NOT NULL,
  source_id text NOT NULL,
  causation_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_payment_fk FOREIGN KEY (payment_id)
    REFERENCES app_v3.payments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ledger_entries_payment_idx
  ON app_v3.ledger_entries (payment_id);

CREATE INDEX IF NOT EXISTS ledger_entries_source_idx
  ON app_v3.ledger_entries (source_type, source_id);

CREATE INDEX IF NOT EXISTS ledger_entries_causation_idx
  ON app_v3.ledger_entries (causation_id);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_causation_unique
  ON app_v3.ledger_entries (payment_id, causation_id);
