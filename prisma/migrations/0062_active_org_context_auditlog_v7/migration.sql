ALTER TABLE app_v3.profiles
  ADD COLUMN IF NOT EXISTS active_organization_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='app_v3' AND indexname='profiles_active_org_idx'
  ) THEN
    CREATE INDEX profiles_active_org_idx ON app_v3.profiles (active_organization_id);
  END IF;
END$$;

ALTER TABLE app_v3.organization_audit_logs
  ADD COLUMN IF NOT EXISTS group_id integer,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS correlation_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='app_v3' AND indexname='organization_audit_logs_group_idx'
  ) THEN
    CREATE INDEX organization_audit_logs_group_idx ON app_v3.organization_audit_logs (group_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='app_v3' AND indexname='organization_audit_logs_entity_idx'
  ) THEN
    CREATE INDEX organization_audit_logs_entity_idx ON app_v3.organization_audit_logs (entity_type, entity_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='app_v3' AND indexname='organization_audit_logs_corr_idx'
  ) THEN
    CREATE INDEX organization_audit_logs_corr_idx ON app_v3.organization_audit_logs (correlation_id);
  END IF;
END$$;
