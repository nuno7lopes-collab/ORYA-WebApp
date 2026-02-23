DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OrganizationFormFieldType'
      AND n.nspname = 'app_v3'
  ) THEN
    ALTER TYPE app_v3."OrganizationFormFieldType" ADD VALUE IF NOT EXISTS 'MULTI_SELECT';
    ALTER TYPE app_v3."OrganizationFormFieldType" ADD VALUE IF NOT EXISTS 'TIME';
  END IF;
END $$;
