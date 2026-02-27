BEGIN;

-- Normaliza estados legacy de eventos para o estado terminal suportado.
UPDATE app_v3.events
SET status = 'FINISHED'::app_v3."EventStatus"
WHERE status::text = 'ARCHIVED';

-- Remove colunas legacy sem uso no runtime atual.
ALTER TABLE app_v3.events
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS resale_mode;

-- Remove tabela legacy de revenda (descontinuada).
DROP TABLE IF EXISTS app_v3.ticket_resales CASCADE;

-- Limpa enums órfãos após remoção da revenda.
DO $$
DECLARE
  enum_name text;
  enum_full text;
  enum_in_use boolean;
BEGIN
  FOR enum_name IN
    SELECT unnest(ARRAY[
      'ResaleMode',
      'ResaleStatus'
    ])
  LOOP
    enum_full := format('app_v3.%I', enum_name);

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
      EXECUTE format('DROP TYPE %s', enum_full);
    END IF;
  END LOOP;
END $$;

COMMIT;
