DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TicketOrderStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."TicketOrderStatus" AS ENUM (
      'DRAFT',
      'READY_FOR_CHECKOUT',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelRegistrationStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelRegistrationStatus" AS ENUM (
      'DRAFT',
      'READY_FOR_CHECKOUT',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'LedgerEntryType' AND n.nspname = 'app_v3'
  ) THEN
    ALTER TYPE app_v3."LedgerEntryType" ADD VALUE IF NOT EXISTS 'DISPUTE_FEE';
    ALTER TYPE app_v3."LedgerEntryType" ADD VALUE IF NOT EXISTS 'DISPUTE_FEE_REVERSAL';
    ALTER TYPE app_v3."LedgerEntryType" ADD VALUE IF NOT EXISTS 'REFUND_GROSS';
    ALTER TYPE app_v3."LedgerEntryType" ADD VALUE IF NOT EXISTS 'REFUND_PLATFORM_FEE_REVERSAL';
    ALTER TYPE app_v3."LedgerEntryType" ADD VALUE IF NOT EXISTS 'REFUND_PROCESSOR_FEES_REVERSAL';
    ALTER TYPE app_v3."LedgerEntryType" ADD VALUE IF NOT EXISTS 'CHARGEBACK_GROSS';
    ALTER TYPE app_v3."LedgerEntryType" ADD VALUE IF NOT EXISTS 'CHARGEBACK_PLATFORM_FEE_REVERSAL';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.ticket_orders (
  id uuid PRIMARY KEY,
  organization_id integer NOT NULL,
  event_id uuid NOT NULL,
  buyer_identity_id uuid,
  currency text NOT NULL DEFAULT 'EUR',
  status app_v3."TicketOrderStatus" NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_orders_organization_fk FOREIGN KEY (organization_id)
    REFERENCES app_v3.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ticket_orders_org_idx
  ON app_v3.ticket_orders (organization_id);

CREATE INDEX IF NOT EXISTS ticket_orders_event_idx
  ON app_v3.ticket_orders (event_id);

CREATE TABLE IF NOT EXISTS app_v3.ticket_order_lines (
  id serial PRIMARY KEY,
  ticket_order_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  qty integer NOT NULL,
  unit_amount integer NOT NULL,
  total_amount integer NOT NULL,
  CONSTRAINT ticket_order_lines_order_fk FOREIGN KEY (ticket_order_id)
    REFERENCES app_v3.ticket_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ticket_order_lines_order_idx
  ON app_v3.ticket_order_lines (ticket_order_id);

CREATE INDEX IF NOT EXISTS ticket_order_lines_ticket_type_idx
  ON app_v3.ticket_order_lines (ticket_type_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_registrations (
  id uuid PRIMARY KEY,
  organization_id integer NOT NULL,
  event_id uuid NOT NULL,
  buyer_identity_id uuid,
  currency text NOT NULL DEFAULT 'EUR',
  status app_v3."PadelRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT padel_registrations_organization_fk FOREIGN KEY (organization_id)
    REFERENCES app_v3.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS padel_registrations_org_idx
  ON app_v3.padel_registrations (organization_id);

CREATE INDEX IF NOT EXISTS padel_registrations_event_idx
  ON app_v3.padel_registrations (event_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_registration_lines (
  id serial PRIMARY KEY,
  padel_registration_id uuid NOT NULL,
  label text NOT NULL,
  qty integer NOT NULL,
  unit_amount integer NOT NULL,
  total_amount integer NOT NULL,
  CONSTRAINT padel_registration_lines_reg_fk FOREIGN KEY (padel_registration_id)
    REFERENCES app_v3.padel_registrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS padel_registration_lines_reg_idx
  ON app_v3.padel_registration_lines (padel_registration_id);
