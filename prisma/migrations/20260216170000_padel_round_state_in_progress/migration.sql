-- Hard-cut estrutural: substituir estado LIVE por IN_PROGRESS no enum canónico de rounds.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'PadelRoundState'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3'
        AND t.typname = 'PadelRoundState'
        AND e.enumlabel = 'LIVE'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3'
        AND t.typname = 'PadelRoundState'
        AND e.enumlabel = 'IN_PROGRESS'
    ) THEN
      ALTER TYPE app_v3."PadelRoundState" RENAME VALUE 'LIVE' TO 'IN_PROGRESS';
    END IF;
  END IF;
END $$;
