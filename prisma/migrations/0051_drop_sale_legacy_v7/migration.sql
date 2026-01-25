-- v7 cleanup: drop legacy sale tables + stripe_payment_intent_id columns

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'app_v3'
      AND column_name = 'stripe_payment_intent_id'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS stripe_payment_intent_id', r.table_schema, r.table_name);
  END LOOP;
END $$;

DROP TABLE IF EXISTS app_v3.sale_lines CASCADE;
DROP TABLE IF EXISTS app_v3.sale_summaries CASCADE;
