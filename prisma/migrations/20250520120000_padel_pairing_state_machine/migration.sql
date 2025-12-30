-- Add gender enum and field to profiles
DO $$
BEGIN
  CREATE TYPE app_v3."Gender" AS ENUM ('MALE','FEMALE');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE app_v3.profiles
  ADD COLUMN IF NOT EXISTS gender app_v3."Gender";

-- Eligibility type for padel tournaments
DO $$
BEGIN
  CREATE TYPE app_v3."PadelEligibilityType" AS ENUM ('OPEN','MALE_ONLY','FEMALE_ONLY','MIXED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE app_v3.padel_tournament_configs
  ADD COLUMN IF NOT EXISTS eligibility_type app_v3."PadelEligibilityType" NOT NULL DEFAULT 'OPEN';

-- Lifecycle/join mode enums for pairings
DO $$
BEGIN
  CREATE TYPE app_v3."PadelPairingLifecycleStatus" AS ENUM ('PENDING_ONE_PAID','PENDING_PARTNER_PAYMENT','CONFIRMED_BOTH_PAID','CONFIRMED_CAPTAIN_FULL','CANCELLED_INCOMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE app_v3."PadelPairingJoinMode" AS ENUM ('INVITE_PARTNER','LOOKING_FOR_PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE app_v3.padel_pairings
  ADD COLUMN IF NOT EXISTS player1_user_id uuid,
  ADD COLUMN IF NOT EXISTS player2_user_id uuid,
  ADD COLUMN IF NOT EXISTS lifecycle_status app_v3."PadelPairingLifecycleStatus" NOT NULL DEFAULT 'PENDING_ONE_PAID',
  ADD COLUMN IF NOT EXISTS pairing_join_mode app_v3."PadelPairingJoinMode" NOT NULL DEFAULT 'INVITE_PARTNER';

CREATE INDEX IF NOT EXISTS padel_pairings_player1_idx ON app_v3.padel_pairings(player1_user_id);
CREATE INDEX IF NOT EXISTS padel_pairings_player2_idx ON app_v3.padel_pairings(player2_user_id);

-- Partial unique indexes to enforce one active pairing per event+user (active = lifecycle_status <> CANCELLED_INCOMPLETE)
DO $$
BEGIN
  CREATE UNIQUE INDEX padel_pairings_event_player1_active_idx
    ON app_v3.padel_pairings(event_id, player1_user_id)
    WHERE lifecycle_status <> 'CANCELLED_INCOMPLETE' AND player1_user_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END$$;

DO $$
BEGIN
  CREATE UNIQUE INDEX padel_pairings_event_player2_active_idx
    ON app_v3.padel_pairings(event_id, player2_user_id)
    WHERE lifecycle_status <> 'CANCELLED_INCOMPLETE' AND player2_user_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END$$;
