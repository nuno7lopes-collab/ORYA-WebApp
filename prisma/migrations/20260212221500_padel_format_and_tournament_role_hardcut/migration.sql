-- Padel hard cut: formatos oficiais + papel operacional de torneio
-- 1) Adiciona AMERICANO/MEXICANO em padel_format
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'padel_format'
  ) THEN
    BEGIN
      ALTER TYPE app_v3."padel_format" ADD VALUE IF NOT EXISTS 'AMERICANO';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      ALTER TYPE app_v3."padel_format" ADD VALUE IF NOT EXISTS 'MEXICANO';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- 2) Renomeia DIRECTOR -> DIRETOR_PROVA em PadelTournamentRole
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'PadelTournamentRole'
      AND e.enumlabel = 'DIRECTOR'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'PadelTournamentRole'
      AND e.enumlabel = 'DIRETOR_PROVA'
  ) THEN
    ALTER TYPE app_v3."PadelTournamentRole" RENAME VALUE 'DIRECTOR' TO 'DIRETOR_PROVA';
  END IF;
END $$;
