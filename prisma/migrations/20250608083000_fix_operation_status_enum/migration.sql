-- Ensure OperationStatus enum exists in app_v3 schema and column uses it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OperationStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."OperationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER');
  END IF;
END$$;

ALTER TABLE app_v3.operations
  ALTER COLUMN status TYPE app_v3."OperationStatus" USING status::text::app_v3."OperationStatus";
