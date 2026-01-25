DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'InvoicingMode'
  ) THEN
    CREATE TYPE app_v3."InvoicingMode" AS ENUM (
      'EXTERNAL_SOFTWARE',
      'MANUAL_OUTSIDE_ORYA'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.organization_settings (
  organization_id integer PRIMARY KEY,
  invoicing_mode app_v3."InvoicingMode",
  invoicing_software_name text,
  invoicing_notes text,
  invoicing_acknowledged_at timestamptz,
  invoicing_acknowledged_by_identity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_settings_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT organization_settings_ack_identity_fk
    FOREIGN KEY (invoicing_acknowledged_by_identity_id) REFERENCES app_v3.email_identities(id) ON DELETE SET NULL
);
