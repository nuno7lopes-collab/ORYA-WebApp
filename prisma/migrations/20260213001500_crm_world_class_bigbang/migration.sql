-- CRM world-class big bang: policy + approvals + journeys + CrmContact hardcut

-- 1) Enums canónicos novos (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmCampaignApprovalState'
  ) THEN
    CREATE TYPE app_v3."CrmCampaignApprovalState" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmCampaignApprovalAction'
  ) THEN
    CREATE TYPE app_v3."CrmCampaignApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ESCALATED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmCampaignDeliveryChannel'
  ) THEN
    CREATE TYPE app_v3."CrmCampaignDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL');
  ELSE
    BEGIN
      ALTER TYPE app_v3."CrmCampaignDeliveryChannel" ADD VALUE IF NOT EXISTS 'EMAIL';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmJourneyStatus'
  ) THEN
    CREATE TYPE app_v3."CrmJourneyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmJourneyStepType'
  ) THEN
    CREATE TYPE app_v3."CrmJourneyStepType" AS ENUM ('TRIGGER', 'CONDITION', 'DELAY', 'ACTION');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmJourneyEnrollmentStatus'
  ) THEN
    CREATE TYPE app_v3."CrmJourneyEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmJourneyRunStatus'
  ) THEN
    CREATE TYPE app_v3."CrmJourneyRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SENT', 'SKIPPED', 'FAILED');
  END IF;
END $$;

-- 2) Política canónica por organização
CREATE TABLE IF NOT EXISTS app_v3."crm_organization_policies" (
  "organization_id" INTEGER PRIMARY KEY,
  "env" TEXT NOT NULL DEFAULT 'prod',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  "quiet_hours_start_minute" INTEGER NOT NULL DEFAULT 1320,
  "quiet_hours_end_minute" INTEGER NOT NULL DEFAULT 480,
  "cap_per_day" INTEGER NOT NULL DEFAULT 1,
  "cap_per_week" INTEGER NOT NULL DEFAULT 4,
  "cap_per_month" INTEGER NOT NULL DEFAULT 10,
  "approval_escalation_hours" INTEGER NOT NULL DEFAULT 24,
  "approval_expire_hours" INTEGER NOT NULL DEFAULT 48,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "crm_org_policy_quiet_hours_chk" CHECK (
    "quiet_hours_start_minute" >= 0 AND "quiet_hours_start_minute" <= 1439
    AND "quiet_hours_end_minute" >= 0 AND "quiet_hours_end_minute" <= 1439
  ),
  CONSTRAINT "crm_org_policy_caps_chk" CHECK (
    "cap_per_day" >= 0 AND "cap_per_week" >= 0 AND "cap_per_month" >= 0
  ),
  CONSTRAINT "crm_org_policy_approval_chk" CHECK (
    "approval_escalation_hours" > 0 AND "approval_expire_hours" >= "approval_escalation_hours"
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_org_policies_org_fk'
  ) THEN
    ALTER TABLE app_v3."crm_organization_policies"
      ADD CONSTRAINT "crm_org_policies_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

INSERT INTO app_v3."crm_organization_policies" (
  "organization_id",
  "env",
  "timezone",
  "quiet_hours_start_minute",
  "quiet_hours_end_minute",
  "cap_per_day",
  "cap_per_week",
  "cap_per_month",
  "approval_escalation_hours",
  "approval_expire_hours"
)
SELECT
  o."id",
  'prod',
  COALESCE(NULLIF(o."timezone", ''), 'Europe/Lisbon'),
  1320,
  480,
  1,
  4,
  10,
  24,
  48
FROM app_v3."organizations" o
LEFT JOIN app_v3."crm_organization_policies" p
  ON p."organization_id" = o."id"
WHERE p."organization_id" IS NULL;

-- 3) CrmCampaign hardening enterprise
ALTER TABLE app_v3."crm_campaigns"
  ADD COLUMN IF NOT EXISTS "channels" JSONB NOT NULL DEFAULT '{"inApp": true, "email": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS "approval_state" app_v3."CrmCampaignApprovalState" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "approval_submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "approval_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "approved_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rejected_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "audience_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6);

UPDATE app_v3."crm_campaigns"
SET "channels" =
  CASE
    WHEN jsonb_typeof("payload"::jsonb -> 'channels') = 'object' THEN
      jsonb_build_object(
        'inApp',
          COALESCE(
            CASE LOWER(COALESCE("payload"::jsonb -> 'channels' ->> 'inApp', ''))
              WHEN 'true' THEN TRUE
              WHEN 'false' THEN FALSE
              ELSE NULL
            END,
            CASE LOWER(COALESCE("payload"::jsonb -> 'channels' ->> 'in_app', ''))
              WHEN 'true' THEN TRUE
              WHEN 'false' THEN FALSE
              ELSE NULL
            END,
            TRUE
          ),
        'email',
          COALESCE(
            CASE LOWER(COALESCE("payload"::jsonb -> 'channels' ->> 'email', ''))
              WHEN 'true' THEN TRUE
              WHEN 'false' THEN FALSE
              ELSE NULL
            END,
            FALSE
          )
      )
    ELSE '{"inApp": true, "email": false}'::jsonb
  END
WHERE "channels" = '{}'::jsonb;

UPDATE app_v3."crm_campaigns"
SET
  "approval_state" = 'APPROVED'::app_v3."CrmCampaignApprovalState",
  "approved_at" = COALESCE("approved_at", "created_at")
WHERE "approval_state" = 'DRAFT'::app_v3."CrmCampaignApprovalState"
  AND "status" IN (
    'SCHEDULED'::app_v3."CrmCampaignStatus",
    'SENDING'::app_v3."CrmCampaignStatus",
    'SENT'::app_v3."CrmCampaignStatus"
  );

CREATE INDEX IF NOT EXISTS "crm_campaigns_org_approval_state_idx"
  ON app_v3."crm_campaigns"("organization_id", "approval_state");

-- 4) Histórico de aprovações
CREATE TABLE IF NOT EXISTS app_v3."crm_campaign_approvals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" TEXT NOT NULL DEFAULT 'prod',
  "organization_id" INTEGER NOT NULL,
  "campaign_id" UUID NOT NULL,
  "state" app_v3."CrmCampaignApprovalState" NOT NULL,
  "action" app_v3."CrmCampaignApprovalAction" NOT NULL,
  "actor_user_id" UUID,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_campaign_approvals_org_fk'
  ) THEN
    ALTER TABLE app_v3."crm_campaign_approvals"
      ADD CONSTRAINT "crm_campaign_approvals_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_campaign_approvals_campaign_fk'
  ) THEN
    ALTER TABLE app_v3."crm_campaign_approvals"
      ADD CONSTRAINT "crm_campaign_approvals_campaign_fk"
      FOREIGN KEY ("campaign_id") REFERENCES app_v3."crm_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "crm_campaign_approvals_org_created_idx"
  ON app_v3."crm_campaign_approvals"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "crm_campaign_approvals_campaign_created_idx"
  ON app_v3."crm_campaign_approvals"("campaign_id", "created_at");

-- 5) Journeys visuais
CREATE TABLE IF NOT EXISTS app_v3."crm_journeys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" TEXT NOT NULL DEFAULT 'prod',
  "organization_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" app_v3."CrmJourneyStatus" NOT NULL DEFAULT 'DRAFT',
  "definition" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_by_user_id" UUID,
  "published_at" TIMESTAMPTZ(6),
  "paused_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3."crm_journey_steps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" TEXT NOT NULL DEFAULT 'prod',
  "organization_id" INTEGER NOT NULL,
  "journey_id" UUID NOT NULL,
  "step_key" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "step_type" app_v3."CrmJourneyStepType" NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3."crm_journey_enrollments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" TEXT NOT NULL DEFAULT 'prod',
  "organization_id" INTEGER NOT NULL,
  "journey_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "trigger_event_id" TEXT,
  "dedupe_key" TEXT NOT NULL,
  "status" app_v3."CrmJourneyEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_step" INTEGER NOT NULL DEFAULT 0,
  "last_evaluated_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3."crm_journey_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" TEXT NOT NULL DEFAULT 'prod',
  "organization_id" INTEGER NOT NULL,
  "journey_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "step_id" UUID NOT NULL,
  "status" app_v3."CrmJourneyRunStatus" NOT NULL DEFAULT 'PENDING',
  "scheduled_for" TIMESTAMPTZ(6),
  "executed_at" TIMESTAMPTZ(6),
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journeys_org_fk') THEN
    ALTER TABLE app_v3."crm_journeys"
      ADD CONSTRAINT "crm_journeys_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_steps_org_fk') THEN
    ALTER TABLE app_v3."crm_journey_steps"
      ADD CONSTRAINT "crm_journey_steps_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_steps_journey_fk') THEN
    ALTER TABLE app_v3."crm_journey_steps"
      ADD CONSTRAINT "crm_journey_steps_journey_fk"
      FOREIGN KEY ("journey_id") REFERENCES app_v3."crm_journeys"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_enrollments_org_fk') THEN
    ALTER TABLE app_v3."crm_journey_enrollments"
      ADD CONSTRAINT "crm_journey_enrollments_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_enrollments_journey_fk') THEN
    ALTER TABLE app_v3."crm_journey_enrollments"
      ADD CONSTRAINT "crm_journey_enrollments_journey_fk"
      FOREIGN KEY ("journey_id") REFERENCES app_v3."crm_journeys"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_enrollments_contact_fk') THEN
    ALTER TABLE app_v3."crm_journey_enrollments"
      ADD CONSTRAINT "crm_journey_enrollments_contact_fk"
      FOREIGN KEY ("contact_id") REFERENCES app_v3."crm_contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_runs_org_fk') THEN
    ALTER TABLE app_v3."crm_journey_runs"
      ADD CONSTRAINT "crm_journey_runs_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_runs_journey_fk') THEN
    ALTER TABLE app_v3."crm_journey_runs"
      ADD CONSTRAINT "crm_journey_runs_journey_fk"
      FOREIGN KEY ("journey_id") REFERENCES app_v3."crm_journeys"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_runs_enrollment_fk') THEN
    ALTER TABLE app_v3."crm_journey_runs"
      ADD CONSTRAINT "crm_journey_runs_enrollment_fk"
      FOREIGN KEY ("enrollment_id") REFERENCES app_v3."crm_journey_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_journey_runs_step_fk') THEN
    ALTER TABLE app_v3."crm_journey_runs"
      ADD CONSTRAINT "crm_journey_runs_step_fk"
      FOREIGN KEY ("step_id") REFERENCES app_v3."crm_journey_steps"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "crm_journey_steps_journey_step_key_uq"
  ON app_v3."crm_journey_steps"("journey_id", "step_key");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_journey_steps_journey_position_uq"
  ON app_v3."crm_journey_steps"("journey_id", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_journey_enrollments_journey_dedupe_key_uq"
  ON app_v3."crm_journey_enrollments"("journey_id", "dedupe_key");

CREATE INDEX IF NOT EXISTS "crm_journeys_org_status_idx"
  ON app_v3."crm_journeys"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "crm_journey_steps_org_journey_idx"
  ON app_v3."crm_journey_steps"("organization_id", "journey_id");
CREATE INDEX IF NOT EXISTS "crm_journey_enrollments_org_status_idx"
  ON app_v3."crm_journey_enrollments"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "crm_journey_enrollments_org_contact_idx"
  ON app_v3."crm_journey_enrollments"("organization_id", "contact_id");
CREATE INDEX IF NOT EXISTS "crm_journey_runs_org_status_idx"
  ON app_v3."crm_journey_runs"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "crm_journey_runs_enrollment_created_idx"
  ON app_v3."crm_journey_runs"("enrollment_id", "created_at");

-- 6) Campanha delivery por canal
ALTER TABLE app_v3."crm_campaign_deliveries"
  ADD COLUMN IF NOT EXISTS "channel" app_v3."CrmCampaignDeliveryChannel" NOT NULL DEFAULT 'IN_APP';

ALTER TABLE app_v3."crm_campaign_deliveries"
  DROP CONSTRAINT IF EXISTS "crm_campaign_deliveries_campaign_contact_unique";
DROP INDEX IF EXISTS app_v3."crm_campaign_deliveries_campaign_contact_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "crm_campaign_deliveries_campaign_contact_channel_unique"
  ON app_v3."crm_campaign_deliveries"("campaign_id", "contact_id", "channel");

-- 7) Hardcut modelo legado CrmCustomer
DROP TABLE IF EXISTS app_v3."crm_customer_notes";
DROP TABLE IF EXISTS app_v3."crm_customers";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmCustomerStatus'
  ) THEN
    DROP TYPE app_v3."CrmCustomerStatus";
  END IF;
END $$;
