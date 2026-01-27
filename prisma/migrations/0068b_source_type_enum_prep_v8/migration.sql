DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname='app_v3' AND t.typname='SourceType') THEN
    ALTER TYPE app_v3."SourceType" ADD VALUE IF NOT EXISTS 'EVENT';
    ALTER TYPE app_v3."SourceType" ADD VALUE IF NOT EXISTS 'TOURNAMENT';
    ALTER TYPE app_v3."SourceType" ADD VALUE IF NOT EXISTS 'MATCH';
    ALTER TYPE app_v3."SourceType" ADD VALUE IF NOT EXISTS 'LOYALTY_TX';
  END IF;
END $$;
