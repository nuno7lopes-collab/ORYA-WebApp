-- Email identities
CREATE TABLE IF NOT EXISTS app_v3.email_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized citext UNIQUE NOT NULL,
  email_verified_at timestamptz,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_identities_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

-- Ownership columns
ALTER TABLE app_v3.tickets
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS owner_identity_id uuid,
  ADD COLUMN IF NOT EXISTS tournament_entry_id integer;

ALTER TABLE app_v3.sale_summaries
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS owner_identity_id uuid;

ALTER TABLE app_v3.tournament_entries
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS owner_identity_id uuid;

-- FKs for ownership (soft, no cascade)
ALTER TABLE app_v3.tickets
  ADD CONSTRAINT tickets_owner_user_fk FOREIGN KEY (owner_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT tickets_owner_identity_fk FOREIGN KEY (owner_identity_id) REFERENCES app_v3.email_identities(id) ON DELETE SET NULL;

ALTER TABLE app_v3.sale_summaries
  ADD CONSTRAINT sale_summaries_owner_user_fk FOREIGN KEY (owner_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT sale_summaries_owner_identity_fk FOREIGN KEY (owner_identity_id) REFERENCES app_v3.email_identities(id) ON DELETE SET NULL;

ALTER TABLE app_v3.tournament_entries
  ADD CONSTRAINT tournament_entries_owner_user_fk FOREIGN KEY (owner_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT tournament_entries_owner_identity_fk FOREIGN KEY (owner_identity_id) REFERENCES app_v3.email_identities(id) ON DELETE SET NULL;

-- FK ticket -> tournament_entries
ALTER TABLE app_v3.tickets
  ADD CONSTRAINT tickets_tournament_entry_fk FOREIGN KEY (tournament_entry_id) REFERENCES app_v3.tournament_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_tournament_entry_idx ON app_v3.tickets(tournament_entry_id);

-- Check constraints: only one owner set
DO $$
BEGIN
  ALTER TABLE app_v3.tickets
    ADD CONSTRAINT tickets_owner_exclusive_chk CHECK (NOT (owner_user_id IS NOT NULL AND owner_identity_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END$$;

DO $$
BEGIN
  ALTER TABLE app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_owner_exclusive_chk CHECK (NOT (owner_user_id IS NOT NULL AND owner_identity_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END$$;

DO $$
BEGIN
  ALTER TABLE app_v3.tournament_entries
    ADD CONSTRAINT tournament_entries_owner_exclusive_chk CHECK (NOT (owner_user_id IS NOT NULL AND owner_identity_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END$$;
