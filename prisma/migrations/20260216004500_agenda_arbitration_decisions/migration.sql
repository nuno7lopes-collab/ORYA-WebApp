BEGIN;

CREATE TABLE IF NOT EXISTS app_v3.agenda_arbitration_decisions (
  env TEXT NOT NULL DEFAULT 'prod',
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key TEXT NOT NULL,
  authority_org_id INT NOT NULL,
  priority_rule_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  decision TEXT NOT NULL,
  rule_applied TEXT NOT NULL,
  winner_claim_id UUID NULL,
  blocked_claim_id UUID NULL,
  reason_code TEXT NULL,
  actor_user_id UUID NULL,
  actor_organization_id INT NULL,
  bundle_id UUID NULL,
  compensation_status TEXT NULL,
  correlation_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_arbitration_decisions_resource_idx
  ON app_v3.agenda_arbitration_decisions (resource_key, created_at);

CREATE INDEX IF NOT EXISTS agenda_arbitration_decisions_authority_idx
  ON app_v3.agenda_arbitration_decisions (authority_org_id);

CREATE INDEX IF NOT EXISTS agenda_arbitration_decisions_bundle_idx
  ON app_v3.agenda_arbitration_decisions (bundle_id);

CREATE INDEX IF NOT EXISTS agenda_arbitration_decisions_decision_idx
  ON app_v3.agenda_arbitration_decisions (decision);

COMMIT;
