-- CRM padel-first: projecao 360 e observabilidade de journeys

ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_BOOKING_CONFIRMED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_BOOKING_CANCELLED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_BOOKING_NO_SHOW';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_MATCH_PLAYED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_MATCH_WIN';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_MATCH_LOSS';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_CLASS_ATTENDED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_CLASS_MISSED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_TOURNAMENT_REGISTERED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_TOURNAMENT_PLAYED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PADEL_TOURNAMENT_PODIUM';

ALTER TABLE IF EXISTS app_v3.crm_contact_padel
  ADD COLUMN IF NOT EXISTS last_match_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS matches_30d INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS win_rate_90d DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_rate_90d DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activity_status TEXT,
  ADD COLUMN IF NOT EXISTS competitive_tier TEXT,
  ADD COLUMN IF NOT EXISTS rfm_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS churn_risk_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reactivation_propensity_score INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS crm_contact_padel_org_activity_idx
  ON app_v3.crm_contact_padel (organization_id, activity_status);
CREATE INDEX IF NOT EXISTS crm_contact_padel_org_competitive_idx
  ON app_v3.crm_contact_padel (organization_id, competitive_tier);
CREATE INDEX IF NOT EXISTS crm_contact_padel_org_churn_idx
  ON app_v3.crm_contact_padel (organization_id, churn_risk_score);
CREATE INDEX IF NOT EXISTS crm_contact_padel_org_reactivation_idx
  ON app_v3.crm_contact_padel (organization_id, reactivation_propensity_score);

DO $$ BEGIN
  CREATE TYPE app_v3."CrmJourneyRunLifecycleStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."CrmJourneyStepLogStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS app_v3.crm_journey_runs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  journey_id UUID NOT NULL,
  contact_id UUID,
  trigger_event_id UUID,
  status app_v3."CrmJourneyRunLifecycleStatus" NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ(6),
  completed_at TIMESTAMPTZ(6),
  failed_at TIMESTAMPTZ(6),
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.crm_journey_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  journey_run_id UUID NOT NULL,
  journey_step_id UUID,
  step_key TEXT NOT NULL,
  step_type app_v3."CrmJourneyStepType" NOT NULL,
  status app_v3."CrmJourneyStepLogStatus" NOT NULL DEFAULT 'PENDING',
  attempt INTEGER NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMPTZ(6),
  executed_at TIMESTAMPTZ(6),
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_runs_v2_org_fk') THEN
    ALTER TABLE app_v3.crm_journey_runs_v2
      ADD CONSTRAINT crm_journey_runs_v2_org_fk
      FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_runs_v2_journey_fk') THEN
    ALTER TABLE app_v3.crm_journey_runs_v2
      ADD CONSTRAINT crm_journey_runs_v2_journey_fk
      FOREIGN KEY (journey_id) REFERENCES app_v3.crm_journeys(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_runs_v2_contact_fk') THEN
    ALTER TABLE app_v3.crm_journey_runs_v2
      ADD CONSTRAINT crm_journey_runs_v2_contact_fk
      FOREIGN KEY (contact_id) REFERENCES app_v3.crm_contacts(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_step_logs_org_fk') THEN
    ALTER TABLE app_v3.crm_journey_step_logs
      ADD CONSTRAINT crm_journey_step_logs_org_fk
      FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_step_logs_run_fk') THEN
    ALTER TABLE app_v3.crm_journey_step_logs
      ADD CONSTRAINT crm_journey_step_logs_run_fk
      FOREIGN KEY (journey_run_id) REFERENCES app_v3.crm_journey_runs_v2(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_step_logs_step_fk') THEN
    ALTER TABLE app_v3.crm_journey_step_logs
      ADD CONSTRAINT crm_journey_step_logs_step_fk
      FOREIGN KEY (journey_step_id) REFERENCES app_v3.crm_journey_steps(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS crm_journey_runs_v2_org_journey_status_idx
  ON app_v3.crm_journey_runs_v2 (organization_id, journey_id, status);
CREATE INDEX IF NOT EXISTS crm_journey_runs_v2_contact_created_idx
  ON app_v3.crm_journey_runs_v2 (contact_id, created_at);
CREATE INDEX IF NOT EXISTS crm_journey_step_logs_run_status_idx
  ON app_v3.crm_journey_step_logs (journey_run_id, status);
CREATE INDEX IF NOT EXISTS crm_journey_step_logs_org_created_idx
  ON app_v3.crm_journey_step_logs (organization_id, created_at);
