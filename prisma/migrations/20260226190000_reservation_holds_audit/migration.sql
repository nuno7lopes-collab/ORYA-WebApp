CREATE TABLE IF NOT EXISTS app_v3.reservation_holds (
  id serial PRIMARY KEY,
  hold_id uuid NOT NULL UNIQUE,
  organization_id int NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_fingerprint text NOT NULL,
  client_session_hash text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  consumed_at timestamptz,
  dedupe_hash text NOT NULL UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS reservation_holds_org_idx
  ON app_v3.reservation_holds (organization_id);

CREATE INDEX IF NOT EXISTS reservation_holds_org_subject_idx
  ON app_v3.reservation_holds (organization_id, subject_fingerprint);

CREATE INDEX IF NOT EXISTS reservation_holds_status_expires_idx
  ON app_v3.reservation_holds (status, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS reservation_holds_active_subject_uidx
  ON app_v3.reservation_holds (organization_id, subject_fingerprint)
  WHERE status = 'ACTIVE';
