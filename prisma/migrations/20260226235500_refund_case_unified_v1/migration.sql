BEGIN;

DO $$
BEGIN
  IF to_regtype('app_v3."RefundCasePolicyCause"') IS NULL THEN
    CREATE TYPE app_v3."RefundCasePolicyCause" AS ENUM (
      'BOOKING_ORG_CANCEL',
      'BOOKING_FORCED_RESCHEDULE',
      'BOOKING_CLIENT_CANCEL',
      'BOOKING_NO_SHOW',
      'EVENT_CANCELLED',
      'EVENT_DELETED',
      'EVENT_DATE_CHANGED',
      'PADEL_SYSTEM_CANCEL',
      'PADEL_EVENT_CANCEL',
      'STORE_ORG_CANCEL',
      'STORE_CLIENT_CANCEL',
      'ADMIN_MANUAL',
      'WEBHOOK_RECONCILED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('app_v3."RefundCaseCulpability"') IS NULL THEN
    CREATE TYPE app_v3."RefundCaseCulpability" AS ENUM (
      'ORG',
      'CLIENT',
      'SYSTEM',
      'NONE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('app_v3."RefundCaseStatus"') IS NULL THEN
    CREATE TYPE app_v3."RefundCaseStatus" AS ENUM (
      'REQUESTED',
      'WAITING_PROCESSOR_FEE',
      'QUEUED',
      'PROCESSING',
      'RETRYING',
      'SUCCEEDED',
      'MANUAL_REVIEW',
      'FAILED_FINAL'
    );
  END IF;
END $$;

ALTER TYPE app_v3."OrganizationStepUpAction"
  ADD VALUE IF NOT EXISTS 'REFUND_EXECUTE';

ALTER TYPE app_v3."OrganizationStepUpAction"
  ADD VALUE IF NOT EXISTS 'REFUND_OVERRIDE';

CREATE TABLE IF NOT EXISTS app_v3.refund_cases (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id integer NOT NULL,
  source_type app_v3."SourceType" NOT NULL,
  source_id text NOT NULL,
  payment_id text NOT NULL,
  payment_intent_id text,
  policy_cause app_v3."RefundCasePolicyCause" NOT NULL,
  culpability app_v3."RefundCaseCulpability" NOT NULL DEFAULT 'SYSTEM',
  requested_by text,
  reason_code text,
  amounts_breakdown jsonb NOT NULL,
  status app_v3."RefundCaseStatus" NOT NULL DEFAULT 'REQUESTED',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error text,
  stripe_refund_id text,
  idempotency_key text NOT NULL,
  override_payload jsonb,
  override_by text,
  override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refund_cases_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refund_cases_organization_id_fkey'
      AND connamespace = 'app_v3'::regnamespace
  ) THEN
    ALTER TABLE app_v3.refund_cases
      ADD CONSTRAINT refund_cases_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES app_v3.organizations(id)
      ON DELETE CASCADE
      ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refund_cases_payment_id_fkey'
      AND connamespace = 'app_v3'::regnamespace
  ) THEN
    ALTER TABLE app_v3.refund_cases
      ADD CONSTRAINT refund_cases_payment_id_fkey
      FOREIGN KEY (payment_id)
      REFERENCES app_v3.payments(id)
      ON DELETE CASCADE
      ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refund_cases_idempotency_key_unique'
      AND connamespace = 'app_v3'::regnamespace
  ) THEN
    ALTER TABLE app_v3.refund_cases
      ADD CONSTRAINT refund_cases_idempotency_key_unique
      UNIQUE (idempotency_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS refund_cases_org_idx
  ON app_v3.refund_cases (organization_id);

CREATE INDEX IF NOT EXISTS refund_cases_org_status_idx
  ON app_v3.refund_cases (organization_id, status);

CREATE INDEX IF NOT EXISTS refund_cases_source_idx
  ON app_v3.refund_cases (source_type, source_id);

CREATE INDEX IF NOT EXISTS refund_cases_payment_idx
  ON app_v3.refund_cases (payment_id);

CREATE INDEX IF NOT EXISTS refund_cases_payment_intent_idx
  ON app_v3.refund_cases (payment_intent_id);

COMMIT;
