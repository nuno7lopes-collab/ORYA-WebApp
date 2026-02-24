BEGIN;

-- Remove tabelas sem uso runtime confirmado (mantendo contratos ativos do core).
DROP TABLE IF EXISTS app_v3.crm_journey_runs CASCADE;
DROP TABLE IF EXISTS app_v3.crm_journey_enrollments CASCADE;
DROP TABLE IF EXISTS app_v3.refund_policy_versions CASCADE;

-- Limpa enums órfãos após remoção das tabelas.
DO $$
DECLARE
  enum_name text;
  enum_full text;
  enum_in_use boolean;
BEGIN
  FOR enum_name IN
    SELECT unnest(ARRAY[
      'CrmJourneyEnrollmentStatus',
      'CrmJourneyRunStatus',
      'RefundFeePayer'
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
