CREATE TABLE IF NOT EXISTS app_v3.telemetry_funnel_definitions (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id int,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_funnel_definitions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS telemetry_funnel_definitions_org_active_idx
  ON app_v3.telemetry_funnel_definitions (env, organization_id, is_active);

CREATE TABLE IF NOT EXISTS app_v3.telemetry_funnel_results (
  env text NOT NULL DEFAULT 'prod',
  id serial PRIMARY KEY,
  funnel_id uuid NOT NULL,
  organization_id int,
  bucket_start timestamptz NOT NULL,
  bucket_unit app_v3."TelemetryBucketUnit" NOT NULL,
  step_key text NOT NULL,
  entered_count int NOT NULL,
  converted_count int NOT NULL,
  conversion_rate_bps int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_funnel_results_funnel_id_fkey
    FOREIGN KEY (funnel_id)
    REFERENCES app_v3.telemetry_funnel_definitions (id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_funnel_results_unique
  ON app_v3.telemetry_funnel_results (
    env,
    funnel_id,
    organization_id,
    bucket_start,
    bucket_unit,
    step_key
  );

CREATE INDEX IF NOT EXISTS telemetry_funnel_results_org_bucket_idx
  ON app_v3.telemetry_funnel_results (env, organization_id, bucket_start);

CREATE INDEX IF NOT EXISTS telemetry_funnel_results_funnel_bucket_idx
  ON app_v3.telemetry_funnel_results (env, funnel_id, bucket_start);
