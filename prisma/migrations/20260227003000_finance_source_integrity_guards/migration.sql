-- Hard guardrails: prevent SQL/scripts from bypassing canonical finance source integrity.

CREATE OR REPLACE FUNCTION app_v3.enforce_payment_source_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_exists boolean := false;
BEGIN
  IF NEW.source_type = 'TICKET_ORDER'::app_v3."SourceType" THEN
    IF NEW.source_id !~ '^[0-9]+$' THEN
      RAISE EXCEPTION
        'PAYMENT_SOURCE_ID_INVALID: TICKET_ORDER requires numeric source_id (payment_id=% source_id=%).',
        NEW.id,
        NEW.source_id
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM app_v3.events e
      WHERE e.id = NEW.source_id::int
    )
    INTO source_exists;
  ELSIF NEW.source_type = 'BOOKING'::app_v3."SourceType" THEN
    IF NEW.source_id !~ '^[0-9]+$' THEN
      RAISE EXCEPTION
        'PAYMENT_SOURCE_ID_INVALID: BOOKING requires numeric source_id (payment_id=% source_id=%).',
        NEW.id,
        NEW.source_id
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM app_v3.bookings b
      WHERE b.id = NEW.source_id::int
    )
    INTO source_exists;
  ELSIF NEW.source_type = 'STORE_ORDER'::app_v3."SourceType" THEN
    IF NEW.source_id !~ '^[0-9]+$' THEN
      RAISE EXCEPTION
        'PAYMENT_SOURCE_ID_INVALID: STORE_ORDER requires numeric source_id (payment_id=% source_id=%).',
        NEW.id,
        NEW.source_id
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM app_v3.store_orders so
      WHERE so.id = NEW.source_id::int
    )
    INTO source_exists;
  ELSIF NEW.source_type = 'PADEL_REGISTRATION'::app_v3."SourceType" THEN
    SELECT EXISTS (
      SELECT 1
      FROM app_v3.padel_registrations pr
      WHERE pr.id::text = NEW.source_id
    )
    INTO source_exists;
  ELSE
    RETURN NEW;
  END IF;

  IF NOT source_exists THEN
    RAISE EXCEPTION
      'PAYMENT_SOURCE_NOT_FOUND: source_type=% source_id=% payment_id=%',
      NEW.source_type,
      NEW.source_id,
      NEW.id
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_source_integrity_trg ON app_v3.payments;

CREATE TRIGGER payments_source_integrity_trg
BEFORE INSERT OR UPDATE OF source_type, source_id
ON app_v3.payments
FOR EACH ROW
EXECUTE FUNCTION app_v3.enforce_payment_source_integrity();

CREATE OR REPLACE FUNCTION app_v3.enforce_ledger_entry_source_matches_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payment_source_type app_v3."SourceType";
  payment_source_id text;
BEGIN
  SELECT p.source_type, p.source_id
  INTO payment_source_type, payment_source_id
  FROM app_v3.payments p
  WHERE p.id = NEW.payment_id;

  IF NEW.source_type <> payment_source_type OR NEW.source_id <> payment_source_id THEN
    RAISE EXCEPTION
      'LEDGER_SOURCE_MISMATCH: payment_id=% payment_source=(%,%) ledger_source=(%,%)',
      NEW.payment_id,
      payment_source_type,
      payment_source_id,
      NEW.source_type,
      NEW.source_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_source_matches_payment_trg ON app_v3.ledger_entries;

CREATE TRIGGER ledger_entries_source_matches_payment_trg
BEFORE INSERT OR UPDATE OF payment_id, source_type, source_id
ON app_v3.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION app_v3.enforce_ledger_entry_source_matches_payment();

CREATE OR REPLACE FUNCTION app_v3.enforce_payment_snapshot_source_matches_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payment_source_type app_v3."SourceType";
  payment_source_id text;
BEGIN
  SELECT p.source_type, p.source_id
  INTO payment_source_type, payment_source_id
  FROM app_v3.payments p
  WHERE p.id = NEW.payment_id;

  IF NEW.source_type <> payment_source_type OR NEW.source_id <> payment_source_id THEN
    RAISE EXCEPTION
      'PAYMENT_SNAPSHOT_SOURCE_MISMATCH: payment_id=% payment_source=(%,%) snapshot_source=(%,%)',
      NEW.payment_id,
      payment_source_type,
      payment_source_id,
      NEW.source_type,
      NEW.source_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_snapshots_source_matches_payment_trg ON app_v3.payment_snapshots;

CREATE TRIGGER payment_snapshots_source_matches_payment_trg
BEFORE INSERT OR UPDATE OF payment_id, source_type, source_id
ON app_v3.payment_snapshots
FOR EACH ROW
EXECUTE FUNCTION app_v3.enforce_payment_snapshot_source_matches_payment();
