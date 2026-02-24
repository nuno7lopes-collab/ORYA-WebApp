BEGIN;

-- Remove checkout legacy source tables (substituídas por pricing snapshot canónico).
DROP TABLE IF EXISTS app_v3.ticket_order_lines CASCADE;
DROP TABLE IF EXISTS app_v3.ticket_orders CASCADE;

-- Remove enum órfão se já não estiver referenciado.
DO $$
DECLARE
  enum_full text := 'app_v3."TicketOrderStatus"';
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
    EXECUTE format('DROP TYPE %s', enum_full);
  END IF;
END $$;

COMMIT;
