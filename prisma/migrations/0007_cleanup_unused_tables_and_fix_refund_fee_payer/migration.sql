-- Fix enum drift for RefundFeePayer (ORGANIZER -> ORGANIZATION)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'RefundFeePayer'
      AND e.enumlabel = 'ORGANIZER'
  ) THEN
    ALTER TYPE app_v3."RefundFeePayer" RENAME VALUE 'ORGANIZER' TO 'ORGANIZATION';
  END IF;
END $$;

-- Drop unused tables (no data and no code references)
DROP TABLE IF EXISTS app_v3.split_payment_participants;
DROP TABLE IF EXISTS app_v3.split_payments;
DROP TABLE IF EXISTS app_v3.payout_records;
DROP TABLE IF EXISTS app_v3.service_staff;
DROP TABLE IF EXISTS app_v3.organization_reviews;
DROP TABLE IF EXISTS app_v3.connect_accounts;
DROP TABLE IF EXISTS app_v3.payment_customers;

-- Drop unused enums
DROP TYPE IF EXISTS app_v3."SplitPaymentParticipantStatus";
DROP TYPE IF EXISTS app_v3."SplitPaymentStatus";
DROP TYPE IF EXISTS app_v3."PayoutRecordStatus";
DROP TYPE IF EXISTS app_v3."OrganizationReviewStatus";
