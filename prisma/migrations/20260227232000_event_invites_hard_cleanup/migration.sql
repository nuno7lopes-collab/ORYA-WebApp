BEGIN;

-- Remove legado de convites por evento (substituído por invite_tokens por bilhete).
DROP TABLE IF EXISTS app_v3.event_invites CASCADE;

-- Limpa enum órfão, se já não houver referências.
DO $$
DECLARE
  enum_full text := 'app_v3."EventInviteScope"';
  enum_in_use boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE a.atttypid = to_regtype(enum_full)
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND n.nspname = 'app_v3'
  )
  INTO enum_in_use;

  IF to_regtype(enum_full) IS NOT NULL AND NOT enum_in_use THEN
    EXECUTE 'DROP TYPE app_v3."EventInviteScope"';
  END IF;
END $$;

COMMIT;
