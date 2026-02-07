-- Add invoice/payout models and normalize entitlement status enum

CREATE TYPE app_v3."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID', 'CANCELLED');
CREATE TYPE app_v3."InvoiceKind" AS ENUM ('CONSUMER', 'PLATFORM_FEE');
CREATE TYPE app_v3."PayoutStatus" AS ENUM ('PENDING', 'RELEASED', 'FAILED', 'CANCELLED');

ALTER TYPE app_v3.entitlement_status RENAME TO entitlement_status_old;
CREATE TYPE app_v3.entitlement_status AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED', 'SUSPENDED');

ALTER TABLE app_v3.entitlements
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE app_v3.entitlements
  ALTER COLUMN status TYPE app_v3.entitlement_status
  USING (
    CASE
      WHEN status::text = 'USED' THEN 'ACTIVE'
      WHEN status::text = 'REFUNDED' THEN 'REVOKED'
      ELSE status::text
    END
  )::app_v3.entitlement_status;

ALTER TABLE app_v3.entitlements
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

DROP TYPE app_v3.entitlement_status_old;

CREATE TABLE app_v3.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id integer NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  customer_identity_id uuid,
  source_type app_v3."SourceType" NOT NULL,
  source_id text NOT NULL,
  kind app_v3."InvoiceKind" NOT NULL DEFAULT 'CONSUMER',
  status app_v3."InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  invoice_number text,
  currency text NOT NULL DEFAULT 'EUR',
  amount_cents integer NOT NULL,
  issued_at timestamptz,
  paid_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_org_idx ON app_v3.invoices (organization_id);
CREATE INDEX invoices_source_idx ON app_v3.invoices (source_type, source_id);
CREATE INDEX invoices_number_idx ON app_v3.invoices (invoice_number);

CREATE TABLE app_v3.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id integer NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  source_type text,
  source_id text,
  payment_id text,
  payment_intent_id text,
  pending_payout_id integer,
  transfer_id text,
  currency text NOT NULL DEFAULT 'EUR',
  gross_amount_cents integer,
  platform_fee_cents integer,
  fee_mode app_v3."FeeMode",
  amount_cents integer NOT NULL,
  status app_v3."PayoutStatus" NOT NULL DEFAULT 'PENDING',
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payouts_org_idx ON app_v3.payouts (organization_id);
CREATE INDEX payouts_pi_idx ON app_v3.payouts (payment_intent_id);
CREATE INDEX payouts_pending_idx ON app_v3.payouts (pending_payout_id);
