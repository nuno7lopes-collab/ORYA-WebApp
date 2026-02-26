DO $$ BEGIN
  CREATE TYPE app_v3."TelemetrySourceType" AS ENUM ('WEB', 'MOBILE', 'API', 'WORKER', 'CRON', 'INTERNAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."TelemetryActorType" AS ENUM ('ANONYMOUS', 'USER', 'SYSTEM', 'SERVICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."TelemetrySeverity" AS ENUM ('INFO', 'WARN', 'ERROR', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."TelemetryBucketUnit" AS ENUM ('HOUR', 'DAY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."TelemetryMetricKey" AS ENUM ('EVENT_COUNT', 'UNIQUE_ACTORS', 'ERROR_COUNT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."TelemetryIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.telemetry_events (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id int,
  event_name text NOT NULL,
  event_version text NOT NULL,
  source_type app_v3."TelemetrySourceType" NOT NULL,
  severity app_v3."TelemetrySeverity" NOT NULL DEFAULT 'INFO',
  actor_type app_v3."TelemetryActorType" NOT NULL,
  actor_user_id uuid,
  actor_key text,
  request_id text,
  correlation_id text,
  idempotency_key text,
  session_id text,
  surface text,
  outcome text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_events_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_events_source_idempotency_unique
  ON app_v3.telemetry_events (env, source_type, idempotency_key);

CREATE INDEX IF NOT EXISTS telemetry_events_org_time_idx
  ON app_v3.telemetry_events (env, organization_id, occurred_at);

CREATE INDEX IF NOT EXISTS telemetry_events_name_time_idx
  ON app_v3.telemetry_events (env, event_name, occurred_at);

CREATE INDEX IF NOT EXISTS telemetry_events_source_time_idx
  ON app_v3.telemetry_events (env, source_type, occurred_at);

CREATE INDEX IF NOT EXISTS telemetry_events_severity_time_idx
  ON app_v3.telemetry_events (env, severity, occurred_at);

CREATE INDEX IF NOT EXISTS telemetry_events_actor_user_time_idx
  ON app_v3.telemetry_events (env, actor_user_id, occurred_at);

CREATE INDEX IF NOT EXISTS telemetry_events_actor_key_time_idx
  ON app_v3.telemetry_events (env, actor_key, occurred_at);

CREATE INDEX IF NOT EXISTS telemetry_events_request_idx
  ON app_v3.telemetry_events (env, request_id);

CREATE INDEX IF NOT EXISTS telemetry_events_correlation_idx
  ON app_v3.telemetry_events (env, correlation_id);

CREATE TABLE IF NOT EXISTS app_v3.telemetry_metric_rollups (
  env text NOT NULL DEFAULT 'prod',
  id serial PRIMARY KEY,
  organization_id int NOT NULL,
  bucket_start timestamptz NOT NULL,
  bucket_unit app_v3."TelemetryBucketUnit" NOT NULL,
  metric_key app_v3."TelemetryMetricKey" NOT NULL,
  dimension_key text NOT NULL,
  dimension_value text NOT NULL,
  value int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_metric_rollups_unique
  ON app_v3.telemetry_metric_rollups (
    env,
    organization_id,
    bucket_start,
    bucket_unit,
    metric_key,
    dimension_key,
    dimension_value
  );

CREATE INDEX IF NOT EXISTS telemetry_metric_rollups_org_bucket_idx
  ON app_v3.telemetry_metric_rollups (env, organization_id, bucket_start);

CREATE INDEX IF NOT EXISTS telemetry_metric_rollups_metric_bucket_idx
  ON app_v3.telemetry_metric_rollups (env, metric_key, bucket_start);

CREATE TABLE IF NOT EXISTS app_v3.telemetry_alert_rules (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id int,
  name text NOT NULL,
  description text,
  metric_key app_v3."TelemetryMetricKey" NOT NULL,
  dimension_key text,
  dimension_value text,
  comparison_operator text NOT NULL DEFAULT 'GTE',
  threshold int NOT NULL,
  window_minutes int NOT NULL DEFAULT 15,
  cooldown_minutes int NOT NULL DEFAULT 30,
  severity app_v3."TelemetrySeverity" NOT NULL DEFAULT 'WARN',
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_alert_rules_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS telemetry_alert_rules_org_active_idx
  ON app_v3.telemetry_alert_rules (env, organization_id, is_active);

CREATE INDEX IF NOT EXISTS telemetry_alert_rules_metric_active_idx
  ON app_v3.telemetry_alert_rules (env, metric_key, is_active);

CREATE TABLE IF NOT EXISTS app_v3.telemetry_alert_incidents (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid,
  organization_id int,
  status app_v3."TelemetryIncidentStatus" NOT NULL DEFAULT 'OPEN',
  severity app_v3."TelemetrySeverity" NOT NULL,
  title text NOT NULL,
  description text,
  metric_key app_v3."TelemetryMetricKey",
  dimension_key text,
  dimension_value text,
  observed_value int,
  threshold_value int,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  acknowledged_by_user_id uuid,
  resolved_by_user_id uuid,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_alert_incidents_pkey PRIMARY KEY (id),
  CONSTRAINT telemetry_alert_incidents_rule_id_fkey
    FOREIGN KEY (rule_id)
    REFERENCES app_v3.telemetry_alert_rules (id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS telemetry_alert_incidents_status_time_idx
  ON app_v3.telemetry_alert_incidents (env, status, triggered_at);

CREATE INDEX IF NOT EXISTS telemetry_alert_incidents_org_time_idx
  ON app_v3.telemetry_alert_incidents (env, organization_id, triggered_at);

CREATE INDEX IF NOT EXISTS telemetry_alert_incidents_rule_time_idx
  ON app_v3.telemetry_alert_incidents (env, rule_id, triggered_at);

CREATE TABLE IF NOT EXISTS app_v3.telemetry_ingest_errors (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id int,
  source_type app_v3."TelemetrySourceType" NOT NULL,
  event_name text,
  reason text NOT NULL,
  request_id text,
  correlation_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_ingest_errors_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS telemetry_ingest_errors_time_idx
  ON app_v3.telemetry_ingest_errors (env, created_at);

CREATE INDEX IF NOT EXISTS telemetry_ingest_errors_org_time_idx
  ON app_v3.telemetry_ingest_errors (env, organization_id, created_at);

CREATE INDEX IF NOT EXISTS telemetry_ingest_errors_source_time_idx
  ON app_v3.telemetry_ingest_errors (env, source_type, created_at);
