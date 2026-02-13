DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'LiveHubVisibility'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'LiveVisibility'
  ) THEN
    ALTER TYPE app_v3."LiveHubVisibility" RENAME TO "LiveVisibility";
  END IF;
END;
$$;
