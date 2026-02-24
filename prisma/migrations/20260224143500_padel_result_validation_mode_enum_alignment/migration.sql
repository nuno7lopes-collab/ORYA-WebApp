BEGIN;

-- Alinha o enum canónico esperado pelo Prisma para result_validation_mode.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'PadelResultValidationMode'
  ) THEN
    CREATE TYPE app_v3."PadelResultValidationMode" AS ENUM (
      'IMMEDIATE_OFFICIAL',
      'IMMEDIATE_PENDING_THEN_OFFICIAL'
    );
  END IF;
END $$;

DO $$
DECLARE
  current_udt text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_v3'
      AND table_name = 'padel_tournament_configs'
      AND column_name = 'result_validation_mode'
  ) THEN
    SELECT c.udt_name
    INTO current_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'app_v3'
      AND c.table_name = 'padel_tournament_configs'
      AND c.column_name = 'result_validation_mode';

    IF current_udt <> 'PadelResultValidationMode' THEN
      EXECUTE $sql$
        ALTER TABLE app_v3.padel_tournament_configs
        ALTER COLUMN result_validation_mode
        TYPE app_v3."PadelResultValidationMode"
        USING result_validation_mode::text::app_v3."PadelResultValidationMode"
      $sql$;
    END IF;

    EXECUTE $sql$
      ALTER TABLE app_v3.padel_tournament_configs
      ALTER COLUMN result_validation_mode
      SET DEFAULT 'IMMEDIATE_OFFICIAL'::app_v3."PadelResultValidationMode"
    $sql$;
  END IF;
END $$;

-- Remove o enum legado se já não existir qualquer coluna a referenciá-lo.
DO $$
DECLARE
  legacy_type_oid oid;
  legacy_in_use boolean := false;
BEGIN
  SELECT t.oid
  INTO legacy_type_oid
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'app_v3'
    AND t.typname = 'padel_result_validation_mode';

  IF legacy_type_oid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE a.atttypid = legacy_type_oid
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    )
    INTO legacy_in_use;

    IF NOT legacy_in_use THEN
      BEGIN
        EXECUTE 'DROP TYPE app_v3.padel_result_validation_mode';
      EXCEPTION
        WHEN dependent_objects_still_exist THEN
          NULL;
      END;
    END IF;
  END IF;
END $$;

COMMIT;
