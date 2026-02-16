DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OrganizationStepUpAction'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."OrganizationStepUpAction" AS ENUM (
      'ORG_SUSPEND',
      'ORG_REACTIVATE',
      'ORG_DELETE'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS app_v3.organization_step_up_challenges (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id integer NOT NULL,
  user_id uuid NOT NULL,
  action app_v3."OrganizationStepUpAction" NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz(6) NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  lockout_until timestamptz(6),
  consumed_at timestamptz(6),
  last_sent_at timestamptz(6),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT organization_step_up_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT organization_step_up_challenges_organization_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS organization_step_up_challenges_org_idx
  ON app_v3.organization_step_up_challenges (organization_id);

CREATE INDEX IF NOT EXISTS organization_step_up_challenges_user_idx
  ON app_v3.organization_step_up_challenges (user_id);

CREATE INDEX IF NOT EXISTS organization_step_up_challenges_action_idx
  ON app_v3.organization_step_up_challenges (action);

CREATE INDEX IF NOT EXISTS organization_step_up_challenges_scope_time_idx
  ON app_v3.organization_step_up_challenges (organization_id, user_id, action, created_at);
