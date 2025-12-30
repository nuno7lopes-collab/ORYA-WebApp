-- Enum for guarantee status
DO $$
BEGIN
  CREATE TYPE app_v3."PadelPairingGuaranteeStatus" AS ENUM ('NONE','ARMED','SCHEDULED','SUCCEEDED','REQUIRES_ACTION','FAILED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- New nullable columns for pairing metadata (prod-safe: all nullable, no defaults that would lock heavily except guarantee_status default)
ALTER TABLE app_v3.padel_pairings
  ADD COLUMN IF NOT EXISTS player2_identity_id uuid,
  ADD COLUMN IF NOT EXISTS partner_invite_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_link_token text,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_swap_allowed_until_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_until_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS captain_second_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS guarantee_status app_v3."PadelPairingGuaranteeStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS setup_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_method_id text,
  ADD COLUMN IF NOT EXISTS second_charge_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS captain_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS captain_first_sale_id integer,
  ADD COLUMN IF NOT EXISTS partner_sale_id integer,
  ADD COLUMN IF NOT EXISTS captain_second_sale_id integer;

-- partner_link_expires_at reused existing column invite_expires_at via @map; no DDL change needed
-- partner_invite_token reused existing invite_token via @map; no DDL change needed

-- Ensure partial index on player2 respects NULL semantics (allow many NULLs, enforce when NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'app_v3' AND indexname = 'padel_pairings_event_player2_active_idx'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS app_v3.padel_pairings_event_player2_active_idx';
  END IF;
END$$;

DO $$
BEGIN
  CREATE UNIQUE INDEX padel_pairings_event_player2_active_idx
    ON app_v3.padel_pairings(event_id, player2_user_id)
    WHERE lifecycle_status <> 'CANCELLED_INCOMPLETE' AND player2_user_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END$$;
