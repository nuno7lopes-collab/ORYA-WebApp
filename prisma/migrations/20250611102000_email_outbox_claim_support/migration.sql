-- Email identities + email outbox + adjustments
CREATE TABLE IF NOT EXISTS app_v3.email_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized citext UNIQUE NOT NULL,
  email_verified_at timestamptz,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_identities_user_fk'
  ) THEN
    ALTER TABLE app_v3.email_identities
      ADD CONSTRAINT email_identities_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS app_v3.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  recipient citext NOT NULL,
  purchase_id text NOT NULL,
  entitlement_id uuid,
  dedupe_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  error_code text
);

CREATE INDEX IF NOT EXISTS email_outbox_purchase_idx ON app_v3.email_outbox(purchase_id);
CREATE INDEX IF NOT EXISTS email_outbox_recipient_idx ON app_v3.email_outbox(recipient);

ALTER TABLE app_v3.email_outbox
  ADD CONSTRAINT email_outbox_entitlement_fk FOREIGN KEY (entitlement_id) REFERENCES app_v3.entitlements(id) ON DELETE SET NULL;
