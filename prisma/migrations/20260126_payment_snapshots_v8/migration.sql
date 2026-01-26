CREATE TABLE IF NOT EXISTS app_v3.payment_snapshots (
  payment_id TEXT PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  source_type app_v3."SourceType" NOT NULL,
  source_id TEXT NOT NULL,
  status app_v3."PaymentStatus" NOT NULL,
  currency TEXT NOT NULL,
  gross_cents INTEGER,
  platform_fee_cents INTEGER,
  processor_fees_cents INTEGER,
  net_to_org_cents INTEGER,
  last_event_id TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_snapshots_org_idx ON app_v3.payment_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS payment_snapshots_source_idx ON app_v3.payment_snapshots(source_type, source_id);

ALTER TABLE app_v3.payment_snapshots
  ADD CONSTRAINT payment_snapshots_payment_fk
  FOREIGN KEY (payment_id) REFERENCES app_v3.payments(id) ON DELETE CASCADE;
