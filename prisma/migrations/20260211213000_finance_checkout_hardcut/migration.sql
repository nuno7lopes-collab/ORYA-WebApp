-- Finance hard-cut: canonical ids, fee mode cleanup, source type constraints, entitlement policy version strictness.

-- 1) Entitlements policyVersionApplied strict rule
UPDATE app_v3.entitlements
SET policy_version_applied = NULL
WHERE event_id IS NULL
  AND policy_version_applied IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM app_v3.entitlements
    WHERE event_id IS NOT NULL
      AND (policy_version_applied IS NULL OR policy_version_applied <= 0)
  ) THEN
    RAISE EXCEPTION 'ENTITLEMENTS_POLICY_VERSION_INVALID_FOR_EVENT';
  END IF;
END;
$$;

ALTER TABLE app_v3.entitlements
  DROP CONSTRAINT IF EXISTS entitlements_policy_version_required;

ALTER TABLE app_v3.entitlements
  ALTER COLUMN policy_version_applied DROP DEFAULT,
  ALTER COLUMN policy_version_applied DROP NOT NULL;

ALTER TABLE app_v3.entitlements
  ADD CONSTRAINT entitlements_policy_version_required
  CHECK (
    (event_id IS NOT NULL AND policy_version_applied IS NOT NULL AND policy_version_applied > 0)
    OR
    (event_id IS NULL AND policy_version_applied IS NULL)
  );

-- 2) FeeMode hard-cut: ON_TOP -> ADDED then drop ON_TOP from enum
DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE udt_schema = 'app_v3'
      AND udt_name = 'FeeMode'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = ''ADDED''::app_v3."FeeMode" WHERE %I = ''ON_TOP''::app_v3."FeeMode"',
      col.table_schema,
      col.table_name,
      col.column_name,
      col.column_name
    );
  END LOOP;
END;
$$;

ALTER TYPE app_v3."FeeMode" RENAME TO "FeeMode_old";
CREATE TYPE app_v3."FeeMode" AS ENUM ('INCLUDED', 'ADDED');

DO $$
DECLARE
  col record;
  default_expr text;
  new_default text;
BEGIN
  FOR col IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE udt_schema = 'app_v3'
      AND udt_name = 'FeeMode_old'
  LOOP
    SELECT c.column_default
      INTO default_expr
    FROM information_schema.columns c
    WHERE c.table_schema = col.table_schema
      AND c.table_name = col.table_name
      AND c.column_name = col.column_name;

    IF default_expr IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT',
        col.table_schema,
        col.table_name,
        col.column_name
      );
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE app_v3."FeeMode" USING (%I::text::app_v3."FeeMode")',
      col.table_schema,
      col.table_name,
      col.column_name,
      col.column_name
    );

    IF default_expr IS NOT NULL THEN
      new_default := NULL;
      IF position('INCLUDED' in default_expr) > 0 THEN
        new_default := 'INCLUDED';
      ELSIF position('ADDED' in default_expr) > 0 OR position('ON_TOP' in default_expr) > 0 THEN
        new_default := 'ADDED';
      END IF;

      IF new_default IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %L::app_v3."FeeMode"',
          col.table_schema,
          col.table_name,
          col.column_name,
          new_default
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

DROP TYPE app_v3."FeeMode_old";

-- 3) Finance sourceType constraints on financial write models
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM app_v3.payments
    WHERE source_type::text NOT IN ('TICKET_ORDER','BOOKING','PADEL_REGISTRATION','STORE_ORDER','SUBSCRIPTION','MEMBERSHIP')
  ) THEN
    RAISE EXCEPTION 'PAYMENTS_SOURCE_TYPE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app_v3.ledger_entries
    WHERE source_type::text NOT IN ('TICKET_ORDER','BOOKING','PADEL_REGISTRATION','STORE_ORDER','SUBSCRIPTION','MEMBERSHIP')
  ) THEN
    RAISE EXCEPTION 'LEDGER_SOURCE_TYPE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app_v3.payment_snapshots
    WHERE source_type::text NOT IN ('TICKET_ORDER','BOOKING','PADEL_REGISTRATION','STORE_ORDER','SUBSCRIPTION','MEMBERSHIP')
  ) THEN
    RAISE EXCEPTION 'PAYMENT_SNAPSHOTS_SOURCE_TYPE_INVALID';
  END IF;
END;
$$;

ALTER TABLE app_v3.payments
  DROP CONSTRAINT IF EXISTS payments_finance_source_type_check,
  ADD CONSTRAINT payments_finance_source_type_check
  CHECK (source_type::text IN ('TICKET_ORDER','BOOKING','PADEL_REGISTRATION','STORE_ORDER','SUBSCRIPTION','MEMBERSHIP'));

ALTER TABLE app_v3.ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_finance_source_type_check,
  ADD CONSTRAINT ledger_entries_finance_source_type_check
  CHECK (source_type::text IN ('TICKET_ORDER','BOOKING','PADEL_REGISTRATION','STORE_ORDER','SUBSCRIPTION','MEMBERSHIP'));

ALTER TABLE app_v3.payment_snapshots
  DROP CONSTRAINT IF EXISTS payment_snapshots_finance_source_type_check,
  ADD CONSTRAINT payment_snapshots_finance_source_type_check
  CHECK (source_type::text IN ('TICKET_ORDER','BOOKING','PADEL_REGISTRATION','STORE_ORDER','SUBSCRIPTION','MEMBERSHIP'));
