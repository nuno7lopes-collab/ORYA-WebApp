-- PadelRegistration status canonical (D12) + pairing link

ALTER TABLE app_v3.padel_registrations
  ADD COLUMN IF NOT EXISTS pairing_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'padel_registrations_pairing_fkey'
  ) THEN
    ALTER TABLE app_v3.padel_registrations
      ADD CONSTRAINT padel_registrations_pairing_fkey
      FOREIGN KEY (pairing_id) REFERENCES app_v3.padel_pairings(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS padel_registrations_pairing_unique
  ON app_v3.padel_registrations(pairing_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'PadelRegistrationStatus'
      AND e.enumlabel = 'PENDING_PARTNER'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM app_v3.padel_registrations
      WHERE status::text NOT IN (
        'READY_FOR_CHECKOUT',
        'CANCELLED',
        'PENDING_PARTNER',
        'PENDING_PAYMENT',
        'MATCHMAKING',
        'CONFIRMED',
        'EXPIRED',
        'REFUNDED'
      )
    ) THEN
      RAISE EXCEPTION 'PadelRegistration.status contém valores não mapeáveis para D12. Resolver antes da migração.';
    END IF;

    ALTER TYPE app_v3."PadelRegistrationStatus" RENAME TO "PadelRegistrationStatus_old";

    CREATE TYPE app_v3."PadelRegistrationStatus" AS ENUM (
      'PENDING_PARTNER',
      'PENDING_PAYMENT',
      'MATCHMAKING',
      'CONFIRMED',
      'EXPIRED',
      'CANCELLED',
      'REFUNDED'
    );

    ALTER TABLE app_v3.padel_registrations
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE app_v3."PadelRegistrationStatus"
      USING (
        CASE
          WHEN status::text = 'READY_FOR_CHECKOUT' THEN 'PENDING_PAYMENT'::app_v3."PadelRegistrationStatus"
          WHEN status::text = 'CANCELLED' THEN 'CANCELLED'::app_v3."PadelRegistrationStatus"
          WHEN status::text = 'PENDING_PARTNER' THEN 'PENDING_PARTNER'::app_v3."PadelRegistrationStatus"
          WHEN status::text = 'PENDING_PAYMENT' THEN 'PENDING_PAYMENT'::app_v3."PadelRegistrationStatus"
          WHEN status::text = 'MATCHMAKING' THEN 'MATCHMAKING'::app_v3."PadelRegistrationStatus"
          WHEN status::text = 'CONFIRMED' THEN 'CONFIRMED'::app_v3."PadelRegistrationStatus"
          WHEN status::text = 'EXPIRED' THEN 'EXPIRED'::app_v3."PadelRegistrationStatus"
          WHEN status::text = 'REFUNDED' THEN 'REFUNDED'::app_v3."PadelRegistrationStatus"
          ELSE NULL
        END
      );

    ALTER TABLE app_v3.padel_registrations
      ALTER COLUMN status SET DEFAULT 'PENDING_PARTNER';

    DROP TYPE app_v3."PadelRegistrationStatus_old";
  END IF;
END $$;
