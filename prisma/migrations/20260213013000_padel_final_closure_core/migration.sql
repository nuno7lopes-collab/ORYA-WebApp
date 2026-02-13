-- Padel final closure core: compensation cases, rating v2 models, claim bundles and overlap constraint

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Override fields
ALTER TABLE app_v3.padel_partnership_overrides
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS executed_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS execution_status TEXT;

UPDATE app_v3.padel_partnership_overrides
SET reason_code = 'UNSPECIFIED'
WHERE reason_code IS NULL;

ALTER TABLE app_v3.padel_partnership_overrides
  ALTER COLUMN reason_code SET DEFAULT 'UNSPECIFIED',
  ALTER COLUMN reason_code SET NOT NULL;

-- 2) Compensation enum + table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelPartnershipCompensationStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelPartnershipCompensationStatus" AS ENUM (
      'OPEN',
      'AUTO_RESOLVED',
      'PENDING_COMPENSATION',
      'MANUAL_RESOLVED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.padel_partnership_compensation_cases (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  agreement_id INT NOT NULL,
  override_id INT,
  owner_organization_id INT NOT NULL,
  partner_organization_id INT NOT NULL,
  event_id INT,
  status app_v3."PadelPartnershipCompensationStatus" NOT NULL DEFAULT 'OPEN',
  reason_code TEXT,
  window_start TIMESTAMPTZ(6),
  window_end TIMESTAMPTZ(6),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_user_id UUID,
  resolved_by_user_id UUID,
  resolved_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_partnership_comp_cases_agreement_fk
    FOREIGN KEY (agreement_id) REFERENCES app_v3.padel_partnership_agreements(id) ON DELETE CASCADE,
  CONSTRAINT padel_partnership_comp_cases_override_fk
    FOREIGN KEY (override_id) REFERENCES app_v3.padel_partnership_overrides(id) ON DELETE SET NULL,
  CONSTRAINT padel_partnership_comp_cases_owner_org_fk
    FOREIGN KEY (owner_organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_partnership_comp_cases_partner_org_fk
    FOREIGN KEY (partner_organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_partnership_comp_cases_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS padel_partnership_comp_cases_agreement_idx
  ON app_v3.padel_partnership_compensation_cases (agreement_id);
CREATE INDEX IF NOT EXISTS padel_partnership_comp_cases_override_idx
  ON app_v3.padel_partnership_compensation_cases (override_id);
CREATE INDEX IF NOT EXISTS padel_partnership_comp_cases_owner_org_idx
  ON app_v3.padel_partnership_compensation_cases (owner_organization_id);
CREATE INDEX IF NOT EXISTS padel_partnership_comp_cases_partner_org_idx
  ON app_v3.padel_partnership_compensation_cases (partner_organization_id);
CREATE INDEX IF NOT EXISTS padel_partnership_comp_cases_event_idx
  ON app_v3.padel_partnership_compensation_cases (event_id);
CREATE INDEX IF NOT EXISTS padel_partnership_comp_cases_status_idx
  ON app_v3.padel_partnership_compensation_cases (status);

-- 3) Agenda claim bundle + overlap guard
ALTER TABLE app_v3.agenda_resource_claims
  ADD COLUMN IF NOT EXISTS bundle_id UUID;

CREATE INDEX IF NOT EXISTS agenda_resource_claims_bundle_idx
  ON app_v3.agenda_resource_claims (bundle_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'agenda_resource_claims_no_overlap_claimed'
      AND n.nspname = 'app_v3'
  ) THEN
    ALTER TABLE app_v3.agenda_resource_claims
      ADD CONSTRAINT agenda_resource_claims_no_overlap_claimed
      EXCLUDE USING gist (
        organization_id WITH =,
        resource_type WITH =,
        resource_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status = 'CLAIMED'::app_v3."AgendaResourceClaimStatus");
  END IF;
END $$;

-- 4) Rating enums
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelRatingSanctionType'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelRatingSanctionType" AS ENUM (
      'SUSPENSION',
      'BLOCK_NEW_MATCHES',
      'RESET_PARTIAL',
      'WARNING'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelRatingSanctionStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelRatingSanctionStatus" AS ENUM (
      'ACTIVE',
      'RESOLVED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelTournamentTierApprovalStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelTournamentTierApprovalStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END $$;

-- 5) Rating tables
CREATE TABLE IF NOT EXISTS app_v3.padel_rating_profiles (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  player_id INT NOT NULL,
  rating DOUBLE PRECISION NOT NULL DEFAULT 1200,
  rd DOUBLE PRECISION NOT NULL DEFAULT 350,
  sigma DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  tau DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  matches_played INT NOT NULL DEFAULT 0,
  level_visual NUMERIC(4,2),
  leaderboard_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  blocked_new_matches BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_ends_at TIMESTAMPTZ(6),
  last_match_at TIMESTAMPTZ(6),
  last_activity_at TIMESTAMPTZ(6),
  last_rebuild_at TIMESTAMPTZ(6),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_rating_profiles_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_rating_profiles_player_fk
    FOREIGN KEY (player_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_rating_profiles_player_uq
  ON app_v3.padel_rating_profiles (player_id);
CREATE INDEX IF NOT EXISTS padel_rating_profiles_org_idx
  ON app_v3.padel_rating_profiles (organization_id);
CREATE INDEX IF NOT EXISTS padel_rating_profiles_rating_idx
  ON app_v3.padel_rating_profiles (rating);
CREATE INDEX IF NOT EXISTS padel_rating_profiles_leaderboard_idx
  ON app_v3.padel_rating_profiles (leaderboard_eligible);

CREATE TABLE IF NOT EXISTS app_v3.padel_rating_events (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  event_id INT,
  match_id INT,
  player_id INT NOT NULL,
  opponent_avg_rating DOUBLE PRECISION,
  pre_rating DOUBLE PRECISION NOT NULL,
  pre_rd DOUBLE PRECISION NOT NULL,
  pre_sigma DOUBLE PRECISION NOT NULL,
  post_rating DOUBLE PRECISION NOT NULL,
  post_rd DOUBLE PRECISION NOT NULL,
  post_sigma DOUBLE PRECISION NOT NULL,
  expected_score DOUBLE PRECISION,
  actual_score DOUBLE PRECISION,
  games_for INT,
  games_against INT,
  tier_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
  carry_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_rating_events_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_rating_events_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE SET NULL,
  CONSTRAINT padel_rating_events_match_fk
    FOREIGN KEY (match_id) REFERENCES app_v3.padel_matches(id) ON DELETE SET NULL,
  CONSTRAINT padel_rating_events_player_fk
    FOREIGN KEY (player_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS padel_rating_events_org_idx
  ON app_v3.padel_rating_events (organization_id);
CREATE INDEX IF NOT EXISTS padel_rating_events_event_idx
  ON app_v3.padel_rating_events (event_id);
CREATE INDEX IF NOT EXISTS padel_rating_events_match_idx
  ON app_v3.padel_rating_events (match_id);
CREATE INDEX IF NOT EXISTS padel_rating_events_player_created_idx
  ON app_v3.padel_rating_events (player_id, created_at);

CREATE TABLE IF NOT EXISTS app_v3.padel_rating_sanctions (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  player_id INT NOT NULL,
  type app_v3."PadelRatingSanctionType" NOT NULL,
  status app_v3."PadelRatingSanctionStatus" NOT NULL DEFAULT 'ACTIVE',
  reason_code TEXT,
  reason TEXT,
  starts_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ(6),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_user_id UUID,
  resolved_by_user_id UUID,
  resolved_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_rating_sanctions_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_rating_sanctions_player_fk
    FOREIGN KEY (player_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS padel_rating_sanctions_org_idx
  ON app_v3.padel_rating_sanctions (organization_id);
CREATE INDEX IF NOT EXISTS padel_rating_sanctions_player_idx
  ON app_v3.padel_rating_sanctions (player_id);
CREATE INDEX IF NOT EXISTS padel_rating_sanctions_status_idx
  ON app_v3.padel_rating_sanctions (status);
CREATE INDEX IF NOT EXISTS padel_rating_sanctions_type_idx
  ON app_v3.padel_rating_sanctions (type);

CREATE TABLE IF NOT EXISTS app_v3.padel_tournament_tier_approvals (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  event_id INT NOT NULL,
  requested_tier TEXT NOT NULL,
  approved_tier TEXT,
  status app_v3."PadelTournamentTierApprovalStatus" NOT NULL DEFAULT 'PENDING',
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  requested_by_user_id UUID,
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_tier_approval_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_tier_approval_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_tier_approval_event_uq
  ON app_v3.padel_tournament_tier_approvals (event_id);
CREATE INDEX IF NOT EXISTS padel_tier_approval_org_idx
  ON app_v3.padel_tournament_tier_approvals (organization_id);
CREATE INDEX IF NOT EXISTS padel_tier_approval_status_idx
  ON app_v3.padel_tournament_tier_approvals (status);

COMMIT;
