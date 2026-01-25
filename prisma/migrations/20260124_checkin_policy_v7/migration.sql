DO $$ BEGIN
  CREATE TYPE app_v3.checkin_method AS ENUM ('QR_TICKET','QR_REGISTRATION','QR_BOOKING','MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app_v3.event_access_mode AS ENUM ('PUBLIC','INVITE_ONLY','UNLISTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app_v3.invite_identity_match AS ENUM ('EMAIL','USERNAME','BOTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app_v3.event_access_policies (
  id serial PRIMARY KEY,
  event_id integer NOT NULL,
  policy_version integer NOT NULL,
  mode app_v3.event_access_mode NOT NULL,
  guest_checkout_allowed boolean NOT NULL,
  invite_token_allowed boolean NOT NULL,
  invite_identity_match app_v3.invite_identity_match NOT NULL,
  invite_token_ttl_seconds integer,
  requires_entitlement_for_entry boolean NOT NULL,
  checkin_methods app_v3.checkin_method[] NOT NULL DEFAULT '{}'::app_v3.checkin_method[],
  scanner_required boolean NOT NULL DEFAULT false,
  allow_reentry boolean NOT NULL DEFAULT false,
  reentry_window_minutes integer NOT NULL DEFAULT 15,
  max_entries integer NOT NULL DEFAULT 1,
  undo_window_minutes integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE app_v3.event_access_policies
    ADD CONSTRAINT event_access_policies_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_v3.event_access_policies
    ADD CONSTRAINT event_access_policies_event_version_uq UNIQUE (event_id, policy_version);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS event_access_policies_event_idx
  ON app_v3.event_access_policies (event_id);

ALTER TABLE app_v3.entitlements
  ADD COLUMN IF NOT EXISTS policy_version_applied integer;

CREATE INDEX IF NOT EXISTS entitlements_event_policy_idx
  ON app_v3.entitlements (event_id, policy_version_applied);

ALTER TABLE app_v3.entitlement_checkins
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE app_v3.entitlement_checkins
  ADD COLUMN IF NOT EXISTS causation_id text;

ALTER TABLE app_v3.entitlement_checkins
  ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE INDEX IF NOT EXISTS entitlement_checkins_idempotency_idx
  ON app_v3.entitlement_checkins (idempotency_key);
