DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname='app_v3' AND t.typname='AgendaSourceType') THEN
    ALTER TABLE app_v3.agenda_items
      ALTER COLUMN source_type TYPE app_v3."SourceType"
      USING (
        CASE source_type
          WHEN 'EVENT' THEN 'EVENT'::app_v3."SourceType"
          WHEN 'TOURNAMENT' THEN 'TOURNAMENT'::app_v3."SourceType"
          WHEN 'RESERVATION' THEN 'BOOKING'::app_v3."SourceType"
        END
      );
    DROP TYPE app_v3."AgendaSourceType";
  END IF;
END $$;
