DO $$
DECLARE
  tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables
  FROM pg_tables
  WHERE schemaname = 'app_v3'
    AND tablename NOT IN ('profiles');

  IF tables IS NULL THEN
    RAISE NOTICE 'No tables to truncate.';
  ELSE
    EXECUTE 'TRUNCATE TABLE ' || tables || ' CASCADE;';
  END IF;
END $$;
