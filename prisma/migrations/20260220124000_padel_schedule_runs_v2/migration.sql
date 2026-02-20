CREATE TABLE app_v3.padel_schedule_runs (
  env text NOT NULL DEFAULT 'prod',
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id integer NOT NULL,
  organization_id integer NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED',
  strategy text NOT NULL DEFAULT 'BALANCED_BY_CATEGORY',
  partial_mode text NOT NULL DEFAULT 'ALLOW_PARTIAL',
  execution_mode text NOT NULL DEFAULT 'SYNC',
  dry_run boolean NOT NULL DEFAULT false,
  scheduled_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  unscheduled_by_reason jsonb,
  by_category jsonb,
  warnings jsonb,
  error_code text,
  requested_by_user_id uuid,
  requested_at timestamptz(6) NOT NULL DEFAULT now(),
  started_at timestamptz(6),
  finished_at timestamptz(6),
  applied boolean NOT NULL DEFAULT false,
  queued boolean NOT NULL DEFAULT false,
  outbox_event_id text,
  category_ids jsonb,
  match_ids jsonb,
  request_meta jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_schedule_runs_pkey PRIMARY KEY (id),
  CONSTRAINT padel_schedule_runs_event_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT padel_schedule_runs_organization_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_schedule_runs_outbox_event_id_key UNIQUE (outbox_event_id)
);

CREATE INDEX padel_schedule_runs_event_idx ON app_v3.padel_schedule_runs(event_id);
CREATE INDEX padel_schedule_runs_org_idx ON app_v3.padel_schedule_runs(organization_id);
CREATE INDEX padel_schedule_runs_status_idx ON app_v3.padel_schedule_runs(status);
CREATE INDEX padel_schedule_runs_requested_at_idx ON app_v3.padel_schedule_runs(requested_at);

CREATE TABLE app_v3.padel_schedule_run_decisions (
  env text NOT NULL DEFAULT 'prod',
  id serial NOT NULL,
  run_id uuid NOT NULL,
  event_id integer NOT NULL,
  organization_id integer NOT NULL,
  match_id integer,
  category_id integer,
  decision_type text NOT NULL,
  reason text,
  court_id integer,
  starts_at timestamptz(6),
  ends_at timestamptz(6),
  details jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_schedule_run_decisions_pkey PRIMARY KEY (id),
  CONSTRAINT padel_schedule_run_decisions_run_fkey FOREIGN KEY (run_id) REFERENCES app_v3.padel_schedule_runs(id) ON DELETE CASCADE,
  CONSTRAINT padel_schedule_run_decisions_event_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT padel_schedule_run_decisions_organization_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE
);

CREATE INDEX padel_schedule_run_decisions_run_idx ON app_v3.padel_schedule_run_decisions(run_id);
CREATE INDEX padel_schedule_run_decisions_event_idx ON app_v3.padel_schedule_run_decisions(event_id);
CREATE INDEX padel_schedule_run_decisions_org_idx ON app_v3.padel_schedule_run_decisions(organization_id);
CREATE INDEX padel_schedule_run_decisions_match_idx ON app_v3.padel_schedule_run_decisions(match_id);
