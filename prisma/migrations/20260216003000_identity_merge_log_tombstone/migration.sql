BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'IdentityMergeReason'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."IdentityMergeReason" AS ENUM (
      'EMAIL_VERIFIED_CLAIM',
      'PROFESSIONAL_AUTO_MERGE',
      'MANUAL_SYSTEM_FIX'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'IdentityMergeTriggerSource'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."IdentityMergeTriggerSource" AS ENUM (
      'AUTH_VERIFY',
      'PROFESSIONAL_LINK',
      'SYSTEM_JOB'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'IdentityMergeStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."IdentityMergeStatus" AS ENUM (
      'SUCCEEDED',
      'NOOP_ALREADY_MERGED',
      'FAILED'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS app_v3.identity_merge_logs (
  env TEXT NOT NULL DEFAULT 'prod',
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_identity_id UUID NOT NULL REFERENCES app_v3.email_identities(id) ON DELETE RESTRICT,
  to_identity_id UUID NOT NULL REFERENCES app_v3.email_identities(id) ON DELETE RESTRICT,
  reason app_v3."IdentityMergeReason" NOT NULL,
  email_normalized CITEXT NOT NULL,
  email_hash_hmac TEXT NOT NULL,
  trigger_source app_v3."IdentityMergeTriggerSource" NOT NULL,
  idempotency_key TEXT NOT NULL,
  merged_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  merged_by UUID NULL,
  artifacts_moved JSONB NOT NULL DEFAULT '{}'::jsonb,
  status app_v3."IdentityMergeStatus" NOT NULL,
  failure_code TEXT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_merge_logs_idempotency_key_key
  ON app_v3.identity_merge_logs (idempotency_key);

CREATE INDEX IF NOT EXISTS identity_merge_logs_from_idx
  ON app_v3.identity_merge_logs (from_identity_id);

CREATE INDEX IF NOT EXISTS identity_merge_logs_to_idx
  ON app_v3.identity_merge_logs (to_identity_id);

CREATE INDEX IF NOT EXISTS identity_merge_logs_status_idx
  ON app_v3.identity_merge_logs (status);

CREATE INDEX IF NOT EXISTS identity_merge_logs_email_idx
  ON app_v3.identity_merge_logs (email_normalized);

CREATE TABLE IF NOT EXISTS app_v3.identity_tombstones (
  env TEXT NOT NULL DEFAULT 'prod',
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_identity_id UUID NOT NULL REFERENCES app_v3.email_identities(id) ON DELETE CASCADE,
  to_identity_id UUID NOT NULL REFERENCES app_v3.email_identities(id) ON DELETE RESTRICT,
  merge_id UUID NULL REFERENCES app_v3.identity_merge_logs(id) ON DELETE SET NULL,
  reason app_v3."IdentityMergeReason" NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  created_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT identity_tombstones_from_to_ck CHECK (from_identity_id <> to_identity_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_tombstones_from_identity_id_key
  ON app_v3.identity_tombstones (from_identity_id);

CREATE INDEX IF NOT EXISTS identity_tombstones_to_idx
  ON app_v3.identity_tombstones (to_identity_id);

CREATE INDEX IF NOT EXISTS identity_tombstones_merge_idx
  ON app_v3.identity_tombstones (merge_id);

COMMIT;
